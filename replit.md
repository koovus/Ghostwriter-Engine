# AI Ghostwriter — Workspace

## Overview

A full-stack AI ghostwriter tool where authors upload Markdown book outlines and the app generates complete, emotionally resonant chapters using OpenAI streaming (SSE). Books can be exported as Markdown, DOCX, PDF, and EPUB.

## Architecture

pnpm workspace monorepo. Three workflows run in parallel:

| Service | Path | Port |
|---------|------|------|
| API Server (Express 5) | `artifacts/api-server` | 8080 (proxied to `/api`) |
| Frontend (React + Vite) | `artifacts/ghostwriter` | dynamic (proxied to `/`) |
| Mockup Sandbox | `artifacts/mockup-sandbox` | 8081 |

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24  
- **TypeScript**: 5.9
- **API framework**: Express 5 + Fastify-style Pino logging
- **Database**: PostgreSQL + Drizzle ORM (lib/db)
- **Validation**: Zod (v4), drizzle-zod
- **API codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React 18 + Vite 7 + shadcn/ui + Tailwind
- **Routing**: wouter
- **AI**: OpenAI GPT via @workspace/integrations-openai-ai-server (Replit AI integration)
- **Exports**: docx (DOCX), pdf-lib (PDF), jszip (EPUB)

## Key Packages

```
lib/db                        — Drizzle schema + client
lib/api-spec                  — openapi.yaml (source of truth)
lib/api-zod                   — Zod schemas (generated)
lib/api-client-react          — React Query hooks (generated via Orval)
lib/integrations-openai-ai-server — OpenAI client wrapper
artifacts/api-server          — Express backend
artifacts/ghostwriter         — React frontend
```

## Database Schema

- `books` — id, title, genre, audience, logline, rawOutlineMd, timestamps
- `chapters` — id, bookId, chapterNumber, title, description, beatsJson, generatedText, wordCount, openerTechnique, timestamps
- `tone_samples` — id, bookId, label, sampleText, timestamps

## API Routes

All routes prefixed `/api`:

| Method | Path | Description |
|--------|------|-------------|
| GET | /healthz | Health check |
| GET | /books | List all books |
| POST | /books | Create book (parses outline) |
| GET | /books/:id | Get book with chapters |
| DELETE | /books/:id | Delete book |
| GET | /books/:id/stats | Book statistics |
| PATCH | /books/:id/chapters/:n | Update chapter |
| POST | /books/:id/chapters/:n/generate | **SSE**: Stream AI chapter generation |
| GET | /books/:id/tone-samples | List tone samples |
| POST | /books/:id/tone-samples | Create tone sample |
| DELETE | /books/:id/tone-samples/:sid | Delete tone sample |
| GET | /books/:id/export/:format | Export (md/docx/pdf/epub) |

## Outline Parser

`artifacts/api-server/src/lib/outlineParser.ts` — flexible Markdown parser supporting:
- `## Chapter N: Title` (H2 chapters, most common)
- `### Chapter N: Title` (H3 chapters under `## Chapter Outline` section)
- `**Beat:** text` or `- **Beat:** text` or `- text` for narrative beats
- `**Genre:** value`, `**Audience:** value`, `**Logline:** value` metadata inline

Chapter titles are stored as pure subtitles (e.g., "The First Loop") — the chapterNumber is stored separately; display prepends "Chapter N: " at render time.

## Frontend Pages

- `/` — Dashboard (book list, empty state, create CTA)
- `/books/new` — Outline upload with markdown textarea
- `/books/:id` — Book workspace:
  - Left sidebar: chapter list with status icons (hollow = not generated, spinner = generating, filled = done)
  - Center panel: chapter beats, Generate button, streaming text, editable textarea
  - Right collapsible panel: Voice & Tone samples
  - Header: book metadata + MD/DOCX/PDF/EPUB export buttons

## SSE Chapter Generation

The generate endpoint is NOT covered by React Query (SSE). The frontend uses a custom `useChapterGeneration` hook (`artifacts/ghostwriter/src/hooks/use-chapter-generation.ts`) with `ReadableStream` and `TextDecoder`.

SSE event format:
```
data: {"content": "token text"}
data: {"done": true, "wordCount": 847, "openerTechnique": "in medias res"}
```

## AI Writing Prompt

Chapters are generated with emotionally engaging literary techniques:
- Opener techniques: cinematic scene, personal confessional, in medias res, etc.
- Emotional beat every ~300 words
- Cliffhanger endings
- 600–900 words per chapter
- Tone samples injected into system prompt if provided

## Key Commands

```bash
pnpm run typecheck                           # Full typecheck
pnpm run build                               # Typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen # Regenerate API hooks from OpenAPI
pnpm --filter @workspace/db run push         # Push DB schema (dev only)
pnpm --filter @workspace/api-server run dev  # Run API server
pnpm --filter @workspace/ghostwriter run dev # Run frontend
```
