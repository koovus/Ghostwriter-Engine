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

  // Extract metadata from any format:
  // "**Genre:** value", "- **Genre:** value", "Genre: value"
  // "**Logline:** value", "Logline: value"
  // Also handles ## Logline section
  for (let j = 0; j < lines.length; j++) {
    const t = lines[j].trim();

    const genreMatch = t.match(/^\*?\*?-?\s*\*?\*?Genre\*?\*?:?\*?\*?\s*(.+)/i);
    if (genreMatch && !genre) {
      genre = genreMatch[1].replace(/\*\*/g, "").trim();
    }

    const audienceMatch = t.match(/^\*?\*?-?\s*\*?\*?Audience\*?\*?:?\*?\*?\s*(.+)/i);
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
  }

  // Detect chapters flexibly:
  // Pattern 1: ### Chapter N: Title (under ## Chapter Outline)
  // Pattern 2: ## Chapter N: Title  (H2 chapter headings)
  // Pattern 3: ### Title (any H3 in chapter outline section)
  // Pattern 4: Chapter N: Title (bare text)

  let currentChapter: ParsedChapter | null = null;
  let inChapterOutline = false;
  let autoChapterNum = 0;

  const pushCurrent = () => {
    if (currentChapter) {
      chapters.push(currentChapter);
      currentChapter = null;
    }
  };

  for (let j = 0; j < lines.length; j++) {
    const raw = lines[j];
    const t = raw.trim();

    // Detect chapter outline section start
    if (t === "## Chapter Outline" || t === "## Chapters") {
      inChapterOutline = true;
      continue;
    }

    // New H1 after the title ends the outline parse if needed
    // but only skip if it's not the first H1 (title)
    if (t.startsWith("# ") && t !== `# ${title}`) {
      continue;
    }

    // H2 chapter heading: ## Chapter N: Title or ## N. Title
    const h2ChapterMatch = t.match(/^##\s+(?:Chapter\s+)?(\d+)[.:]?\s*(?:Chapter\s+)?(\d+)?[.:]?\s*(.+)?$/i);
    if (h2ChapterMatch && t.startsWith("## ") && !t.startsWith("## Chapter Outline") && !t.startsWith("## Chapters")) {
      // More specific H2 chapter match
      const h2ExactMatch = t.match(/^##\s+(?:Chapter\s+)?(\d+)[:\s–-]+(.+)$/i);
      if (h2ExactMatch) {
        pushCurrent();
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

    // H3 chapter heading: ### Chapter N: Title
    const h3ChapterMatch = t.match(/^###\s+(?:Chapter\s+)?(\d+)[:\s–-]+(.+)$/i);
    if (h3ChapterMatch) {
      pushCurrent();
      autoChapterNum = parseInt(h3ChapterMatch[1], 10);
      currentChapter = {
        chapterNumber: autoChapterNum,
        title: h3ChapterMatch[2].trim(),
        description: "",
        beats: [],
      };
      continue;
    }

    // H3 generic: ### Title (when in chapter outline section)
    if (inChapterOutline && t.startsWith("### ") && !t.match(/^###\s+Chapter\s+\d+/i)) {
      pushCurrent();
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
      // Beat patterns: "**Beat:** text", "- **Beat:** text", "* **Beat:** text", "- text", "* text"
      const beatMatch = t.match(/^[\-\*]\s+\*?\*?(?:Beat|Scene|Hook|Cliffhanger|Opener|Emotional Moment)?\*?\*?:?\s*(.+)/i);
      if (beatMatch) {
        currentChapter.beats.push(beatMatch[1].replace(/\*\*/g, "").trim());
        continue;
      }

      // Also: "**Beat:** text" (no leading dash)
      const boldBeatMatch = t.match(/^\*\*(?:Beat|Scene|Hook|Cliffhanger|Opener|Emotional Moment)[:\s]+\*\*\s*(.+)/i);
      if (boldBeatMatch) {
        currentChapter.beats.push(boldBeatMatch[1].replace(/\*\*/g, "").trim());
        continue;
      }

      // Separator line ---
      if (t === "---" || t === "***" || t === "___") {
        continue;
      }

      // Non-empty, non-heading line that isn't a beat → description
      if (t && !t.startsWith("#") && !currentChapter.description) {
        currentChapter.description = t.replace(/\*\*/g, "").trim();
      }
    }
  }

  pushCurrent();

  // Final fallback: if still no chapters, pull any H2/H3 as chapters
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
        fallbackCur = {
          chapterNumber: fallbackNum,
          title: isH2Chapter[2].trim(),
          description: "",
          beats: [],
        };
      } else if (isH3) {
        if (fallbackCur) chapters.push(fallbackCur);
        fallbackNum++;
        fallbackCur = {
          chapterNumber: fallbackNum,
          title: isH3[1],
          description: "",
          beats: [],
        };
      } else if (fallbackCur && t.match(/^[\-\*]\s+/)) {
        fallbackCur.beats.push(t.replace(/^[\-\*]\s+/, "").replace(/\*\*/g, "").trim());
      }
    }
    if (fallbackCur) chapters.push(fallbackCur);
  }

  return { title: title || "Untitled Book", genre, audience, logline, chapters };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}
