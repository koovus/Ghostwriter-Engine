export interface ParsedChapter {
  chapterNumber: number;
  title: string;
  description: string;
  beats: string[];
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
  const isStructured = lines.some(l => /^####\s+[\d.]+\s*[–—\-]/.test(l.trim()));

  const pushCurrent = (cur: ParsedChapter | null): void => {
    if (cur) chapters.push(cur);
  };

  if (isStructured) {
    // ── STRUCTURED SUB-CHAPTER FORMAT ────────────────────────────────────────
    // ## INTRODUCTION        → chapter 0 with H3 sub-sections as beats
    // ## CHAPTER N: Title    → section label only (not a chapter itself)
    // #### N.M — Title       → actual chapter entry
    // **Key Points:**        → next non-empty line, split by comma → beats
    // **Supporting Examples/Evidence:** → next paragraph → description

    let currentChapter: ParsedChapter | null = null;
    let autoChapterNum = 0;
    let inIntroduction = false;
    let awaitingIntroContent = false;
    let currentIntroSection = "";
    let awaitingKeyPoints = false;
    let awaitingEvidence = false;

    for (let j = 0; j < lines.length; j++) {
      const t = lines[j].trim();

      // Horizontal rules act as section boundaries
      if (t === "---" || t === "***" || t === "___") {
        continue;
      }

      // H1 (title already extracted — skip)
      if (t.startsWith("# ")) continue;

      // ## INTRODUCTION
      if (t.match(/^##\s+INTRODUCTION$/i)) {
        pushCurrent(currentChapter);
        currentChapter = { chapterNumber: 0, title: "Introduction", description: "", beats: [] };
        inIntroduction = true;
        awaitingIntroContent = false;
        awaitingKeyPoints = false;
        awaitingEvidence = false;
        continue;
      }

      // ## CHAPTER N: … — section label, NOT a chapter itself
      if (t.match(/^##\s+CHAPTER\s+\d+/i)) {
        pushCurrent(currentChapter);
        currentChapter = null;
        inIntroduction = false;
        awaitingIntroContent = false;
        awaitingKeyPoints = false;
        awaitingEvidence = false;
        continue;
      }

      // ### Sub-Chapters (literal label in the new format — skip)
      if (t.match(/^###\s+Sub-Chapters?$/i)) continue;

      // H3 inside INTRODUCTION — each section becomes a beat
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

      // #### N.M — Sub-chapter title → actual chapter
      const h4Match = t.match(/^####\s+[\d.]+\s*[–—\-]+\s*(.+)$/);
      if (h4Match) {
        pushCurrent(currentChapter);
        autoChapterNum++;
        currentChapter = {
          chapterNumber: autoChapterNum,
          title: h4Match[1].trim(),
          description: "",
          beats: [],
        };
        inIntroduction = false;
        awaitingIntroContent = false;
        awaitingKeyPoints = false;
        awaitingEvidence = false;
        continue;
      }

      if (currentChapter && !inIntroduction) {
        // **Key Points:** marker
        if (t.match(/^\*\*Key Points:\*\*\s*$/i)) {
          awaitingKeyPoints = true;
          awaitingEvidence = false;
          continue;
        }

        // **Supporting Examples/Evidence:** marker (variations)
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

        // Collect Key Points: next non-empty, non-heading line, split by comma.
        if (awaitingKeyPoints && t && !t.startsWith("#") && !t.startsWith("*Target:") && !t.startsWith("**")) {
          const points = t.split(",").map(p => p.trim()).filter(p => p.length > 0);
          currentChapter.beats.push(...points);
          awaitingKeyPoints = false;
          continue;
        }

        // Collect Supporting Examples as description (first paragraph only)
        if (awaitingEvidence && t && !t.startsWith("#") && !t.startsWith("*Target:") && !t.startsWith("**") && !currentChapter.description) {
          currentChapter.description = t.replace(/\*\*/g, "").trim();
          awaitingEvidence = false;
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
