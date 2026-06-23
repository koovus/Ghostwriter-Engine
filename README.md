# Writer Ron — AI Ghostwriting Studio

**Writer Ron** turns your book outline into a full manuscript, chapter by chapter. Paste or upload a Markdown outline, then let the AI ghostwrite each chapter in your voice — complete with narrative beats, tone matching, and real-time streaming prose.

![Writer Ron dashboard](attached_assets/screenshot-placeholder.png)

---

## Features

### Outline Ingestion
- **Two outline formats supported** — classic flat format (`## Chapter 1:` + dash beats) or structured sub-chapter format (`## CHAPTER 1:` containers with `#### 1.1 —` children and `**Key Points:**` beats)
- Auto-extracts metadata: title, genre, target audience, logline
- Supports drag-and-drop `.md` / `.txt` file upload
- Live chapter preview with beat counts before committing

### AI Chapter Generation
- Streams prose in real-time via Server-Sent Events
- Narrative beats passed as numbered writing targets — AI covers each beat in sequence
- Randomly assigned **Opener Techniques** (Cinematic Scene, In Medias Res, Bold Claim, etc.) for variety across chapters
- **Emotional Density Rule** enforced — avoids flat reporting, maintains narrative tension

### Voice Matching
- Upload **Tone Samples** — passages from your own writing
- AI analyzes rhythm, vocabulary, sentence length, and stylistic quirks
- Ghostwrites each chapter in your voice, not a generic one

### Editing & Management
- Inline rich text editor for post-generation refinement
- Per-chapter beat editor — add, remove, or reorder beats before generating
- Progress dashboard: word counts, chapter status, overall completion percentage

### Export
| Format | Notes |
|--------|-------|
| Markdown | Clean `.md` with chapter headings |
| Word | `.docx` via `docx` library |
| PDF | `pdf-lib` layout |
| EPUB | KDP-compatible, with manifest and spine |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Routing | wouter |
| Data fetching | TanStack Query + generated OpenAPI client |
| Backend | Node.js, Express |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI (GPT-4o / GPT-4.1) via Replit AI Integration |
| Validation | Zod (shared schemas) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
writer-ron/
├── artifacts/
│   ├── ghostwriter/        # React + Vite frontend
│   └── api-server/         # Express API + AI orchestration
│       └── src/lib/
│           └── outlineParser.ts   # Markdown outline → chapters + beats
├── lib/
│   ├── db/                 # Drizzle schema & migrations
│   ├── api-spec/           # OpenAPI spec (openapi.yaml)
│   ├── api-client-react/   # Generated React hooks
│   ├── api-zod/            # Shared Zod request/response schemas
│   └── integrations-*/     # OpenAI integration wrappers
└── attached_assets/        # Sample outlines for testing
```

---

## Outline Formats

### Flat format
```markdown
# My Book Title
Genre: Science Fiction
Audience: Adult readers
Logline: One sentence hook.

## Chapter 1: The Beginning
- First narrative beat
- Second narrative beat
- Cliffhanger moment

## Chapter 2: Rising Action
- ...
```

### Structured sub-chapter format
```markdown
# My Book Title
**Genre:** Science Fiction
**Target Audience:** Adult readers

## INTRODUCTION

### Opening Hook
For the first time...

### Core Premise
The central argument...

---
## CHAPTER 1: Part One Title

### Sub-Chapters

#### 1.1 — First Sub-chapter

**Key Points:**
First key point,Second key point,Third key point

**Supporting Examples/Evidence:**
A short description used as chapter context.

#### 1.2 — Second Sub-chapter
...
```

Both formats auto-detected — no configuration needed.

---

## How It Works

```
Upload outline → parse chapters + beats
       ↓
Configure voice (optional tone samples)
       ↓
Click Generate on any chapter
       ↓
API builds Master Ghostwriter prompt:
  • craft rules (opener technique, emotional density)
  • voice instructions (from tone samples)
  • chapter beats as numbered writing targets
       ↓
OpenAI streams prose → displayed in real-time
       ↓
Save → edit inline → export full manuscript
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL database
- OpenAI API key (via Replit AI Integrations or `OPENAI_API_KEY` env var)

### Install & run

```bash
# Install all workspace packages
pnpm install

# Push the database schema
pnpm --filter @workspace/db run push

# Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start the frontend (port varies)
pnpm --filter @workspace/ghostwriter run dev
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key (if not using Replit integration) |

---

## Supported Outline Metadata

| Field | Formats accepted |
|-------|-----------------|
| Title | `# Book Title` (H1) |
| Genre | `Genre: …`, `**Genre:** …` |
| Audience | `Audience: …`, `**Audience:** …`, `**Target Audience:** …` |
| Logline | `Logline: …`, `**Logline:** …`, `## Logline` section |

---

## License

MIT
