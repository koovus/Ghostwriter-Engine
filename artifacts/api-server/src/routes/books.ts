import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  booksTable,
  chaptersTable,
  toneSamplesTable,
} from "@workspace/db";
import {
  CreateBookBody,
  UpdateBookBody,
  UpdateChapterBody,
  CreateToneSampleBody,
} from "@workspace/api-zod";
import { parseOutline, countWords } from "../lib/outlineParser.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ── LIST BOOKS ──────────────────────────────────────────────────────────────
router.get("/books", async (req, res) => {
  const books = await db.select().from(booksTable).orderBy(desc(booksTable.updatedAt));

  const results = await Promise.all(
    books.map(async (book) => {
      const chapters = await db
        .select()
        .from(chaptersTable)
        .where(eq(chaptersTable.bookId, book.id));

      const totalWordCount = chapters.reduce((sum, c) => sum + (c.wordCount ?? 0), 0);
      const generatedChapterCount = chapters.filter((c) => c.generatedText).length;

      return {
        id: book.id,
        title: book.title,
        genre: book.genre,
        audience: book.audience,
        chapterCount: chapters.length,
        generatedChapterCount,
        totalWordCount,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
      };
    })
  );

  res.json(results);
});

// ── CREATE BOOK ─────────────────────────────────────────────────────────────
router.post("/books", async (req, res) => {
  const parse = CreateBookBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.message });
    return;
  }

  const { outlineMarkdown } = parse.data;
  const parsed = parseOutline(outlineMarkdown);

  const [book] = await db
    .insert(booksTable)
    .values({
      title: parsed.title,
      genre: parsed.genre,
      audience: parsed.audience,
      logline: parsed.logline,
      rawOutlineMd: outlineMarkdown,
    })
    .returning();

  if (parsed.chapters.length > 0) {
    await db.insert(chaptersTable).values(
      parsed.chapters.map((ch) => ({
        bookId: book.id,
        chapterNumber: ch.chapterNumber,
        chapterLabel: ch.label ?? null,
        title: ch.title,
        description: ch.description,
        beatsJson: ch.beats,
      }))
    );
  }

  res.status(201).json(book);
});

// ── GET BOOK ─────────────────────────────────────────────────────────────────
router.get("/books/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, id))
    .orderBy(chaptersTable.chapterNumber);

  const toneSamples = await db
    .select()
    .from(toneSamplesTable)
    .where(eq(toneSamplesTable.bookId, id));

  res.json({ ...book, chapters, toneSamples });
});

// ── UPDATE BOOK METADATA ─────────────────────────────────────────────────────
router.patch("/books/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parse = UpdateBookBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.message });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parse.data.title !== undefined) updates.title = parse.data.title;
  if (parse.data.genre !== undefined) updates.genre = parse.data.genre;
  if (parse.data.audience !== undefined) updates.audience = parse.data.audience;
  if (parse.data.logline !== undefined) updates.logline = parse.data.logline;

  const [updated] = await db
    .update(booksTable)
    .set(updates)
    .where(eq(booksTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  res.json(updated);
});

// ── DELETE BOOK ──────────────────────────────────────────────────────────────
router.delete("/books/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(booksTable).where(eq(booksTable.id, id));
  res.status(204).end();
});

// ── UPDATE CHAPTER (save edited text) ────────────────────────────────────────
router.put("/books/:id/chapters/:chapterNumber", async (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  const chapterNumber = parseInt(req.params.chapterNumber, 10);

  const parse = UpdateChapterBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.message });
    return;
  }

  const { generatedText, beatsJson, targetWordCount } = parse.data;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (generatedText !== undefined) {
    patch.generatedText = generatedText;
    patch.wordCount = countWords(generatedText);
  }
  if (beatsJson !== undefined) {
    patch.beatsJson = beatsJson;
  }
  if (targetWordCount !== undefined) {
    patch.targetWordCount = targetWordCount;
  }

  const [updated] = await db
    .update(chaptersTable)
    .set(patch)
    .where(
      and(
        eq(chaptersTable.bookId, bookId),
        eq(chaptersTable.chapterNumber, chapterNumber)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }

  res.json(updated);
});

// ── GENERATE CHAPTER (SSE streaming) ─────────────────────────────────────────
router.post("/books/:id/chapters/:chapterNumber/generate", async (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  const chapterNumber = parseInt(req.params.chapterNumber, 10);

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, bookId));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const [chapter] = await db
    .select()
    .from(chaptersTable)
    .where(
      and(
        eq(chaptersTable.bookId, bookId),
        eq(chaptersTable.chapterNumber, chapterNumber)
      )
    );

  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }

  const toneSamples = await db
    .select()
    .from(toneSamplesTable)
    .where(eq(toneSamplesTable.bookId, bookId));

  // Build system prompt
  const openerTechniques = [
    "CINEMATIC SCENE OPENER: Drop the reader directly into a vivid, sensory scene mid-action. No preamble. Ground them in a specific moment with precise physical details.",
    "PERSONAL CONFESSIONAL OPENER: Begin with a first-person revelation or admission that feels vulnerable and honest. Make the reader feel trusted.",
    "IN MEDIAS RES OPENER: Start in the middle of the action. The reader catches up. Build urgency from the first sentence.",
    "ACTION COLD OPEN: Something is already happening. Stakes are already in play. The reader must keep reading to understand how we got here.",
    "ATMOSPHERIC DREAD OPENER: Something feels wrong before anything goes wrong. Build unease through environment, sensation, and suppressed knowledge.",
  ];

  const techniqueIndex = (chapter.chapterNumber - 1) % openerTechniques.length;
  const selectedTechnique = openerTechniques[techniqueIndex];
  const techniqueName = selectedTechnique.split(":")[0];

  let toneBlock = "";
  if (toneSamples.length > 0) {
    const sampleText = toneSamples
      .map((s, i) => `--- WRITING SAMPLE ${i + 1} (${s.label}) ---\n${s.sampleText}`)
      .join("\n\n");

    toneBlock = `
## VOICE MATCHING INSTRUCTION
The author has provided their own writing samples. Analyze these samples carefully for:
- Sentence rhythm and length patterns
- Vocabulary register (formal vs. casual, technical vs. accessible)
- Use of metaphor, simile, and sensory language
- Narrative distance and point of view
- Emotional register and pacing
- Paragraph structure and white space
- Specific word choices or verbal tics

Apply ALL of these stylistic traits throughout the chapter. The chapter should feel like it was written by the same person who wrote these samples.

${sampleText}

---
`;
  }

  const beats = (chapter.beatsJson as string[] | null) ?? [];
  const hasBeats = beats.length > 0;

  const beatsText = beats
    .map((b, i) => `  Beat ${i + 1}: ${b}`)
    .join("\n");

  let targetWordMin: number;
  let targetWordMax: number;
  if (chapter.targetWordCount && chapter.targetWordCount > 0) {
    const margin = Math.round(chapter.targetWordCount * 0.1);
    targetWordMin = chapter.targetWordCount - margin;
    targetWordMax = chapter.targetWordCount + margin;
  } else if (hasBeats) {
    targetWordMin = Math.max(600, beats.length * 350);
    targetWordMax = Math.max(900, beats.length * 500);
  } else {
    targetWordMin = 600;
    targetWordMax = 900;
  }

  const chapterContentBlock = hasBeats
    ? `## THIS CHAPTER
${chapter.title}

Chapter description: ${chapter.description || ""}

## BEATS TO HIT (in order — these are the plot/character beats you must deliver):
${beatsText}`
    : `## THIS CHAPTER
${chapter.title}

Chapter description: ${chapter.description || ""}

Write the chapter based on the title and description above. Follow the craft rules and opener technique.`;

  const systemPrompt = `You are a master ghostwriter specializing in ${book.genre || "science fiction"} novels. You write prose that makes readers feel something on every page.

## YOUR CRAFT RULES

### OPENER TECHNIQUE — USE THIS FOR THE CHAPTER OPENING:
${selectedTechnique}

### EMOTIONAL DENSITY RULE:
Every 300 words, there must be a deliberate emotional moment — a revelation, a physical sensation the reader can feel, a decision that costs something, a memory that aches, a beat of dark humor, or a moment of unexpected tenderness. Do not let 300 words pass without hitting the reader in some way.

### CLIFFHANGER RULE:
If it serves the story, end the chapter on a cliffhanger. This could be a revelation, a threat, an unanswered question, a door opening, or a sudden change in power. The reader must feel compelled to turn the page.

### PROSE QUALITY STANDARDS:
- Write in deep third-person limited POV unless the beat requires otherwise
- Use specific, concrete sensory details — not "she felt afraid" but the physical manifestation of fear
- Vary sentence length — long sentences for immersion, short sentences for impact
- Avoid passive voice, filler adverbs, and clichés
- Show character psychology through action and thought, not exposition
- Dialogue should reveal character and advance tension simultaneously
- Use white space — paragraph breaks are a pacing tool

### CHAPTER TARGET:
Write a complete chapter of approximately ${targetWordMin}–${targetWordMax} words. This is real prose, not an outline or summary.${hasBeats ? " Scale naturally: more beats require more pages to honour every story moment." : ""}

${toneBlock}

## BOOK CONTEXT
Title: ${book.title}
Genre: ${book.genre || "Science Fiction"}
Audience: ${book.audience || "General adult readers"}
Logline: ${book.logline || ""}

${chapterContentBlock}

## OUTPUT FORMAT
Write only the chapter prose. No chapter title header. No beat labels. No meta-commentary. Just the story. Begin immediately with the chapter's first sentence.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let fullText = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: Math.min(8192, Math.max(2048, beats.length * 700)),
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Write ${chapter.title} now. Use the ${techniqueName} opener. Hit all the beats. Make every 300 words emotionally resonant.`,
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullText += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Save to DB
    const wc = countWords(fullText);
    await db
      .update(chaptersTable)
      .set({
        generatedText: fullText,
        wordCount: wc,
        openerTechnique: techniqueName,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(chaptersTable.bookId, bookId),
          eq(chaptersTable.chapterNumber, chapterNumber)
        )
      );

    res.write(`data: ${JSON.stringify({ done: true, wordCount: wc, openerTechnique: techniqueName })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "Error generating chapter");
    res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
  }

  res.end();
});

// ── TONE SAMPLES ─────────────────────────────────────────────────────────────
router.get("/books/:id/tone-samples", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const samples = await db
    .select()
    .from(toneSamplesTable)
    .where(eq(toneSamplesTable.bookId, id))
    .orderBy(toneSamplesTable.createdAt);
  res.json(samples);
});

router.post("/books/:id/tone-samples", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parse = CreateToneSampleBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.message });
    return;
  }

  const [sample] = await db
    .insert(toneSamplesTable)
    .values({ bookId: id, label: parse.data.label, sampleText: parse.data.sampleText })
    .returning();

  res.status(201).json(sample);
});

router.delete("/books/:id/tone-samples/:sampleId", async (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  const sampleId = parseInt(req.params.sampleId, 10);
  await db.delete(toneSamplesTable).where(
    and(
      eq(toneSamplesTable.id, sampleId),
      eq(toneSamplesTable.bookId, bookId)
    )
  );
  res.status(204).end();
});

// ── BOOK STATS ────────────────────────────────────────────────────────────────
router.get("/books/:id/stats", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, id));
  const toneSamples = await db
    .select()
    .from(toneSamplesTable)
    .where(eq(toneSamplesTable.bookId, id));

  const totalChapters = chapters.length;
  const generatedChapters = chapters.filter((c) => c.generatedText).length;
  const totalWordCount = chapters.reduce((s, c) => s + (c.wordCount ?? 0), 0);
  const completionPercent = totalChapters > 0 ? (generatedChapters / totalChapters) * 100 : 0;

  res.json({
    bookId: id,
    totalChapters,
    generatedChapters,
    totalWordCount,
    toneSampleCount: toneSamples.length,
    completionPercent,
  });
});

export default router;
