export interface ParsedChapter {
  chapterNumber: number;
  label?: string;
  title: string;
  description: string;
  beats: string[];
  targetWordCount?: number;
}

export interface ParsedOutline {
  title: string;
  genre: string;
  audience: string;
  logline: string;
  chapters: ParsedChapter[];
}

export function parseOutline(markdown: string): ParsedOutline {
  const lines = markdown.split("\n");

  let title = "";
  let genre = "";
  let audience = "";
  let logline = "";
  const chapters: ParsedChapter[] = [];

  let i = 0;

  // Extract title from first H1
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("# ")) {
      title = line.replace(/^#\s+/, "").trim();
      i++;
      break;
    }
    i++;
  }

  // Extract metadata — handles both "Key: value" and "**Key:** value" forms
  // Also handles "Target Audience" variant used in the structured outline format
  for (let j = 0; j < lines.length; j++) {
    const t = lines[j].trim();

    const genreMatch = t.match(/^\*?\*?-?\s*\*?\*?Genre\*?\*?:?\*?\*?\s*(.+)/i);
    if (genreMatch && !genre) {
      genre = genreMatch[1].replace(/\*\*/g, "").trim();
    }

    // Match "Audience: …", "**Audience:** …", "**Target Audience:** …"
    const audienceMatch = t.match(/^\*?\*?-?\s*\*?\*?(?:Target\s+)?Audience\*?\*?:?\*?\*?\s*(.+)/i);
    if (audienceMatch && !audience) {
      audience = audienceMatch[1].replace(/\*\*/g, "").trim();
    }

    const loglineMatch = t.match(/^\*?\*?-?\s*\*?\*?Logline\*?\*?:?\*?\*?\s*(.+)/i);
    if (loglineMatch && !logline) {
      logline = loglineMatch[1].replace(/\*\*/g, "").trim();
    }

    if (t === "## Logline" && !logline) {
      for (let k = j + 1; k < lines.length; k++) {
        if (lines[k].trim()) {
          logline = lines[k].trim();
          break;
        }
      }
    }

    // New format: ### Target Audience heading inside INTRODUCTION
    if (t === "### Target Audience" && !audience) {
      for (let k = j + 1; k < lines.length; k++) {
        const next = lines[k].trim();
        if (next && !next.startsWith("#")) {
          audience = next.replace(/\*\*/g, "").split(/\.\s+/)[0].trim();
          break;
        }
      }
    }
  }

  // Detect which format the document uses.
  // "Structured" format uses #### N.M — Sub-chapter headings as the actual chapters.
  const isStructured = lines.some(l => /^####\s+\d+\.\d+/.test(l.trim()));

  const pushCurrent = (cur: ParsedChapter | null): void => {
    if (cur) chapters.push(cur);
  };

  if (isStructured) {
    // ── STRUCTURED FORMAT ─────────────────────────────────────────────────────
    // ## INTRODUCTION        → chapter 0; H3 sub-sections become beats
    // ## CHAPTER N: Title    → one chapter per section
    // #### N.M — SubTitle    → beat on the current chapter ("N.M — SubTitle")
    // **Key Points:**        → comma-list appended as additional beats
    // **Supporting Examples/Evidence:** → first paragraph → description
    // *Target: N words*      → targetWordCount on current chapter

    let currentChapter: ParsedChapter | null = null;
    let autoChapterNum = 0;
    let inIntroduction = false;
    let awaitingIntroContent = false;
    let currentIntroSection = "";
    let awaitingKeyPoints = false;
    let awaitingEvidence = false;

    for (let j = 0; j < lines.length; j++) {
      const t = lines[j].trim();

      if (t === "---" || t === "***" || t === "___") continue;
      if (t.startsWith("# ")) continue;

      // ## INTRODUCTION → chapter 0
      if (t.match(/^##\s+INTRODUCTION$/i)) {
        pushCurrent(currentChapter);
        currentChapter = { chapterNumber: 0, title: "Introduction", description: "", beats: [] };
        inIntroduction = true;
        awaitingIntroContent = false;
        awaitingKeyPoints = false;
        awaitingEvidence = false;
        continue;
      }

      // ## CHAPTER N: Title → one real chapter
      const chapterMatch = t.match(/^##\s+CHAPTER\s+(\d+)[:\s–—-]+(.+)$/i);
      if (chapterMatch) {
        pushCurrent(currentChapter);
        autoChapterNum++;
        currentChapter = {
          chapterNumber: autoChapterNum,
          title: chapterMatch[2].trim(),
          description: "",
          beats: [],
        };
        inIntroduction = false;
        awaitingIntroContent = false;
        awaitingKeyPoints = false;
        awaitingEvidence = false;
        continue;
      }

      // ### Sub-Chapters label — skip
      if (t.match(/^###\s+Sub-Chapters?$/i)) continue;

      // H3 inside INTRODUCTION — each section heading becomes a beat label
      if (inIntroduction && t.startsWith("### ")) {
        currentIntroSection = t.replace(/^###\s+/, "").trim();
        awaitingIntroContent = true;
        continue;
      }

      // Content line following an INTRODUCTION H3 section heading
      if (awaitingIntroContent && currentChapter && t && !t.startsWith("#")) {
        const firstSentence = t.replace(/\*\*/g, "").split(/\.\s+/)[0].trim();
        currentChapter.beats.push(`${currentIntroSection}: ${firstSentence}`);
        awaitingIntroContent = false;
        continue;
      }

      // #### N.M — Sub-section title → beat on current chapter
      const h4Match = t.match(/^####\s+(\d+\.\d+)\s*[–—\-]?\s*(.+)$/);
      if (h4Match && currentChapter && !inIntroduction) {
        const beatLabel = `${h4Match[1].trim()} — ${h4Match[2].trim()}`;
        currentChapter.beats.push(beatLabel);
        awaitingKeyPoints = false;
        awaitingEvidence = false;
        continue;
      }

      if (currentChapter && !inIntroduction) {
        // **Key Points:** marker — next content line appended to current sub-section beat
        if (t.match(/^\*\*Key Points:\*\*\s*$/i)) {
          awaitingKeyPoints = true;
          awaitingEvidence = false;
          continue;
        }

        // **Supporting Examples/Evidence:** marker
        if (t.match(/^\*\*Supporting Examples(?:\/Evidence)?:\*\*\s*$/i)) {
          awaitingEvidence = true;
          awaitingKeyPoints = false;
          continue;
        }

        // Any other bold header resets awaiting flags
        if (t.startsWith("**") && t.endsWith("**")) {
          awaitingKeyPoints = false;
          awaitingEvidence = false;
        }

        // Key Points content: merge into the last beat (sub-section title) as detail
        if (awaitingKeyPoints && t && !t.startsWith("#") && !t.startsWith("*Target:") && !t.startsWith("**")) {
          if (currentChapter.beats.length > 0) {
            currentChapter.beats[currentChapter.beats.length - 1] += `: ${t}`;
          }
          awaitingKeyPoints = false;
          continue;
        }

        // Supporting Examples → description (use first sub-section's evidence as chapter description)
        if (awaitingEvidence && t && !t.startsWith("#") && !t.startsWith("*Target:") && !t.startsWith("**") && !currentChapter.description) {
          currentChapter.description = t.replace(/\*\*/g, "").trim();
          awaitingEvidence = false;
          continue;
        }

        // *Target: N,XXX words* — use last sub-section target as the chapter target
        const targetMatch = t.match(/^\*Target:\s*([\d,]+)\s*words?\*$/i);
        if (targetMatch) {
          const wc = parseInt(targetMatch[1].replace(/,/g, ""), 10);
          if (!isNaN(wc)) currentChapter.targetWordCount = wc;
          continue;
        }
      }
    }

    pushCurrent(currentChapter);

  } else {
    // ── FLAT FORMAT (original logic, unchanged) ───────────────────────────────
    let currentChapter: ParsedChapter | null = null;
    let inChapterOutline = false;
    let autoChapterNum = 0;

    const pushFlat = () => {
      if (currentChapter) {
        chapters.push(currentChapter);
        currentChapter = null;
      }
    };

    for (let j = 0; j < lines.length; j++) {
      const raw = lines[j];
      const t = raw.trim();

      if (t === "## Chapter Outline" || t === "## Chapters") {
        inChapterOutline = true;
        continue;
      }

      if (t.startsWith("# ") && t !== `# ${title}`) {
        continue;
      }

      const h2ChapterMatch = t.match(/^##\s+(?:Chapter\s+)?(\d+)[.:]?\s*(?:Chapter\s+)?(\d+)?[.:]?\s*(.+)?$/i);
      if (h2ChapterMatch && t.startsWith("## ") && !t.startsWith("## Chapter Outline") && !t.startsWith("## Chapters")) {
        const h2ExactMatch = t.match(/^##\s+(?:Chapter\s+)?(\d+)[:\s–-]+(.+)$/i);
        if (h2ExactMatch) {
          pushFlat();
          autoChapterNum = parseInt(h2ExactMatch[1], 10);
          currentChapter = {
            chapterNumber: autoChapterNum,
            title: h2ExactMatch[2].trim(),
            description: "",
            beats: [],
          };
          continue;
        }
      }

      const h3ChapterMatch = t.match(/^###\s+(?:Chapter\s+)?(\d+)[:\s–-]+(.+)$/i);
      if (h3ChapterMatch) {
        pushFlat();
        autoChapterNum = parseInt(h3ChapterMatch[1], 10);
        currentChapter = {
          chapterNumber: autoChapterNum,
          title: h3ChapterMatch[2].trim(),
          description: "",
          beats: [],
        };
        continue;
      }

      if (inChapterOutline && t.startsWith("### ") && !t.match(/^###\s+Chapter\s+\d+/i)) {
        pushFlat();
        autoChapterNum++;
        currentChapter = {
          chapterNumber: autoChapterNum,
          title: t.replace(/^###\s+/, ""),
          description: "",
          beats: [],
        };
        continue;
      }

      if (currentChapter) {
        const beatMatch = t.match(/^[\-\*]\s+\*?\*?(?:Beat|Scene|Hook|Cliffhanger|Opener|Emotional Moment)?\*?\*?:?\s*(.+)/i);
        if (beatMatch) {
          currentChapter.beats.push(beatMatch[1].replace(/\*\*/g, "").trim());
          continue;
        }

        const boldBeatMatch = t.match(/^\*\*(?:Beat|Scene|Hook|Cliffhanger|Opener|Emotional Moment)[:\s]+\*\*\s*(.+)/i);
        if (boldBeatMatch) {
          currentChapter.beats.push(boldBeatMatch[1].replace(/\*\*/g, "").trim());
          continue;
        }

        if (t === "---" || t === "***" || t === "___") {
          continue;
        }

        if (t && !t.startsWith("#") && !currentChapter.description) {
          currentChapter.description = t.replace(/\*\*/g, "").trim();
        }
      }
    }

    pushFlat();

    // Fallback: pull any H2/H3 as chapters if still empty
    if (chapters.length === 0) {
      let fallbackNum = 0;
      let fallbackCur: ParsedChapter | null = null;
      for (const line of lines) {
        const t = line.trim();
        const isH2Chapter = t.match(/^##\s+(?:Chapter\s+)?(\d+)[:\s]+(.+)/i);
        const isH3 = t.match(/^###\s+(.+)/);
        if (isH2Chapter) {
          if (fallbackCur) chapters.push(fallbackCur);
          fallbackNum = parseInt(isH2Chapter[1], 10);
          fallbackCur = { chapterNumber: fallbackNum, title: isH2Chapter[2].trim(), description: "", beats: [] };
        } else if (isH3) {
          if (fallbackCur) chapters.push(fallbackCur);
          fallbackNum++;
          fallbackCur = { chapterNumber: fallbackNum, title: isH3[1], description: "", beats: [] };
        } else if (fallbackCur && t.match(/^[\-\*]\s+/)) {
          fallbackCur.beats.push(t.replace(/^[\-\*]\s+/, "").replace(/\*\*/g, "").trim());
        }
      }
      if (fallbackCur) chapters.push(fallbackCur);
    }
  }

  return { title: title || "Untitled Book", genre, audience, logline, chapters };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}
