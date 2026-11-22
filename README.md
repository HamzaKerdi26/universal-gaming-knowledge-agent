
An AI-powered gaming knowledge platform, built incrementally across
multiple phases. This repository currently contains:

```text
Universal Gaming Knowledge Agent
├── backend/   — Phase 1: Express + TypeScript + Prisma + PostgreSQL REST API
└── frontend/  — Phase 2: React + TypeScript + Vite dashboard/CRUD UI
```

Later phases (Gemini, RAG, Qdrant, agentic tools, MCP, authentication) will
build on top of this exact project — see the roadmap in `backend/README.md`.

## Quick start (both apps)

You need Node.js 18+, npm, and a running PostgreSQL 14+ instance.

**1. Backend**

```bash
cd backend
npm install
cp .env.example .env        # edit DATABASE_URL, and add your GEMINI_API_KEY for chat
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev                 # http://localhost:5000
```

**2. Frontend** (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env        # defaults to http://localhost:5000/api
npm run dev                 # http://localhost:5173
```

Open `http://localhost:5173` — the dashboard, games list, create/edit/
delete flows, and the new Chat page all talk to the backend at
`http://localhost:5000/api`.

Full backend details (migrations, seed data, Swagger, tests, architecture,
environment limitations from development) are in **`backend/README.md`**.
Frontend-specific details are below.

---

# Phase 2 — React Frontend

## What Phase 2 implements

- React + TypeScript + Vite single-page app
- React Router with 5 pages: Dashboard, Games list, Game details, Create
  game, Edit game
- A centralized API service layer (`services/api.ts`,
  `services/gameService.ts`) — no component calls `fetch`/`axios` directly
- Shared loading / error / empty states across pages
- Client-side form validation mirroring the backend's Zod rules
  (title/slug required, slug pattern, max lengths), including converting a
  plain date picker value into the full ISO datetime the backend requires
  (`2020-12-10` → `2020-12-10T00:00:00Z`)
- A confirmation dialog before deleting a game, with correct handling of
  the backend's `204 No Content` delete response
- Dark, gaming-themed UI: navbar, cards, buttons, forms, badges, responsive
  grid layout
- No fake AI functionality or fake statistics — the dashboard only shows
  real data from the API (game count, recently added games)

## Project structure

```text
frontend/src/
├── components/     # Navbar, GameCard, GameForm, ConfirmDialog, Loading/Error/EmptyState
├── pages/           # DashboardPage, GamesListPage, GameDetailsPage, CreateGamePage, EditGamePage, NotFoundPage
├── layouts/          # MainLayout (navbar + outlet + footer)
├── services/         # api.ts (axios instance), gameService.ts (all game API calls)
├── hooks/             # useAsync — shared loading/error/data fetching hook
├── types/             # Game, GameInput, ApiResponse types matching the backend
├── utils/             # date formatting, error-message extraction, form validation
├── App.tsx            # route definitions
└── main.tsx           # entrypoint — mounts BrowserRouter + App
```

## Environment variables

```bash
cp .env.example .env
```

`.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

`.env` is git-ignored and was not packaged in this ZIP.

## Backend changes made for Phase 2

**None required.** The backend already had `app.use(cors())` with no
origin restriction (Phase 1), which already sends
`Access-Control-Allow-Origin: *` — sufficient for the Vite dev server to
call the API. No backend files were modified for Phase 2.

## Available API endpoints (consumed by the frontend)

| Method | Path | Used by |
|---|---|---|
| GET | `/api/health` | (not called by the UI; available for manual checks) |
| GET | `/api/games` | Dashboard, Games list |
| POST | `/api/games` | Create game |
| GET | `/api/games/:id` | Game details, Edit game (initial load) |
| PUT | `/api/games/:id` | Edit game |
| DELETE | `/api/games/:id` | Games list, Game details |

## Running the frontend

```bash
npm run dev      # dev server, http://localhost:5173
npm run build    # production build to dist/ (tsc -b && vite build)
npm run preview  # preview the production build locally
```

## What was tested, and how

**Automated end-to-end UI test (Playwright, headless Chromium):** the real
built frontend was run against a temporary mock server that reproduces the
exact Phase 1 API contract (same routes, same success/error JSON shape,
same status codes including `204` on delete and `404`/`400`/`409` error
cases) — used only because this development sandbox cannot generate the
Prisma client (see below), so a live Postgres-backed Phase 1 server
couldn't be started here. A scripted browser session clicked through the
actual rendered UI and verified, against real DOM state:

1. Dashboard loads and shows the game count stat
2. Games list loads and renders a game card
3. Create game form submits and navigates to the new game's details page,
   with developer/publisher rendering correctly
4. Client-side validation blocks submission with empty required fields
5. Edit game loads existing values, saves an update, and the change
   persists to the details page
6. Delete shows a confirmation dialog before deleting
7. After confirming delete, the app navigates back to the games list and
   the deleted game no longer appears
8. Visiting a nonexistent game id renders the error state with a
   "not found" message
9. Deleting every game renders the empty state

**Result: 14/14 checks passed.**

Directly against the mock API (via `curl`), the full CRUD lifecycle,
duplicate-slug conflict (`409`), and validation errors (`400` with field
details) were also confirmed to match the documented Phase 1 response
shapes.

**`npm run build`** (`tsc -b && vite build`) completes with zero errors —
this exercises the full TypeScript project, not just a subset.

### Environment limitation (unchanged from Phase 1)

This sandbox can only reach a fixed allowlist of domains, which does not
include `binaries.prisma.sh`. `npx prisma generate` therefore still fails
with `403 Forbidden` after loading `prisma.config.ts` — this was retried
during Phase 2 work and is unrelated to any frontend change. As a result:

- The frontend was **not** verified against the real Prisma/PostgreSQL
  Phase 1 server in this sandbox — it was verified against a mock server
  that reproduces the same API contract, as described above.
- `npm test` in `backend/` (the Jest/Supertest suite) was **not** rerun
  here for the same reason. You've already reported 9/9 passing locally
  against the real server — that result stands; it wasn't independently
  reverified in this sandbox because the client still can't be generated
  here.
- Everything else — backend TypeScript compilation, frontend TypeScript
  compilation and production build, and the full scripted browser test
  above — was independently verified in this sandbox.

**On your machine:** run the backend with a real generated Prisma client
(section "Quick start" above), then run the same frontend against it. The
integration point (HTTP requests/responses) was verified to match exactly
what your real backend returns, so this is expected to work as documented
— please confirm and let me know if anything differs.

---

# Phase 3 — AI / LLM Foundation

## What Phase 3 implements

- A clean, modular AI architecture in the backend so the LLM provider can
  be swapped later without touching controllers or services
- Google Gemini as the initial LLM provider, via the official `@google/genai` SDK
- A dedicated system prompt / persona for the Universal Gaming Knowledge Agent
- `POST /api/chat` — Zod-validated, with centralized error handling for
  empty messages, invalid bodies, a missing API key, provider failures,
  and timeouts
- Basic conversation persistence using the Phase 1 `Conversation`/`Message`
  models, so the agent can receive prior turns as history
- A dedicated Chat page in the frontend, styled consistently with the
  existing dark gaming theme, alongside Dashboard and Games in the nav

## AI architecture

```text
POST /api/chat
      ↓
chatController          (src/controllers/chat.controller.ts)
      ↓
chatService              (src/services/chat.service.ts)
   — resolves/creates the Conversation
   — loads recent Message history
   — persists the user's message
   — calls the configured LLMProvider
   — persists the assistant's reply
      ↓
LLMProvider interface     (src/services/ai/llmProvider.ts)
      ↓
GeminiProvider             (src/services/ai/geminiProvider.ts)
      ↓
@google/genai SDK → Gemini API
```

`chatService` and `chatController` only ever depend on the `LLMProvider`
interface (`generateReply(input): Promise<{content, model}>`), never on
the Gemini SDK directly. Adding a second provider later means writing a
new class that implements `LLMProvider` and adding a `case` to the
factory in `src/services/ai/index.ts` — no changes to the controller,
service, or routes.

The system prompt lives in its own file
(`src/services/ai/systemPrompt.ts`), separate from the service/controller
code, so it can be reviewed and tuned independently.

### Conversation persistence

Phase 1's `Conversation` and `Message` models are reused as-is, with one
small, deliberate, documented schema change: **`Conversation.userId` is
now optional.** Authentication doesn't exist yet (that's Phase 9), so
requiring a real `userId` would have meant inventing fake user records
just to satisfy a foreign key — worse than making the field optional
until real auth exists. This is additive and doesn't affect `Game`,
`User`, or any Phase 1 CRUD behavior.

Each `POST /api/chat` call:
- creates a new `Conversation` if no `conversationId` is given, or looks
  up the existing one (404 if it doesn't exist)
- loads up to the 20 most recent messages in that conversation as history
  sent to the model
- persists the user's message *before* calling the provider (so it isn't
  lost if the provider call fails), then persists the assistant's reply
  after a successful response

This is intentionally simple — real memory/retrieval strategies (RAG,
summarization, etc.) are future phases.

## Gemini configuration

**Model:** `gemini-2.5-flash` (default, configurable via `GEMINI_MODEL`).
As of this writing, Google's Gemini lineup has two live generations —
the newer, pricier Gemini 3.x "Flash" line (tuned heavily toward coding
and agentic workflows) and the Gemini 2.5 line, which is more established
at a lower cost. For a general conversational gaming assistant with no
agentic tool-calling in this phase, `gemini-2.5-flash` is the more
cost-appropriate, proven default; a newer or different model can be
substituted at any time by changing `GEMINI_MODEL` in `.env` — no code
change needed.

**SDK:** `@google/genai` — Google's current official, unified Gen AI SDK
for Node.js/TypeScript (the older `@google/generative-ai` package is
deprecated).

**Required environment variable** (`backend/.env`, never committed):

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash
```

Get an API key from [Google AI Studio](https://aistudio.google.com/).

## Security notes

- `GEMINI_API_KEY` is read only in `backend/src/config/env.ts` and used
  only inside `GeminiProvider` — it is never sent to, or accessible from,
  the frontend.
- The frontend's `.env` only ever contains `VITE_API_BASE_URL`; it has no
  knowledge of any AI provider credentials.
- `backend/.gitignore` and `frontend/.gitignore` both ignore `.env`; only
  `.env.example` files (with placeholder values) are committed/packaged.
- Error responses from `/api/chat` never include the raw SDK error,
  request details, or the API key — `GeminiProvider` catches SDK errors
  and re-throws a generic, safe `LLMProviderError` message; the real
  error is only logged server-side.
- No real API key is included in this ZIP.

## How to test chat

**Backend (mocked provider, no real Gemini calls):**

```bash
cd backend
npm test
```

`tests/chat.test.ts` covers valid requests, empty-message validation,
invalid bodies, message-length limits, successful responses, conversation
persistence and continuation, a nonexistent `conversationId` (404), a
malformed `conversationId` (400), and provider failure/timeout — all
using an injected fake `LLMProvider` (`setLLMProviderForTesting`), never
a real network call. `tests/ai-provider.test.ts` and
`tests/gemini-provider.test.ts` unit-test the provider factory and the
Gemini provider's request-mapping/error-handling in isolation.

**Manually, with a real Gemini key:** start the backend with a valid
`GEMINI_API_KEY` in `.env`, start the frontend, open the Chat page, and
send a message.

## What is intentionally NOT implemented yet

Per the Phase 3 scope, none of the following are implemented:

- RAG (retrieval-augmented generation)
- Embeddings
- Vector databases (Pinecone, Qdrant, Chroma, pgvector)
- MCP or MCP servers
- External gaming data APIs or web scraping
- Autonomous agent tool-calling

Those are planned for later phases (see the roadmap in `backend/README.md`).

## Tests performed and results (this environment)

**Automated, actually run in this sandbox:**

- `tests/ai-provider.test.ts` — **3/3 passed.** Unit tests for the
  provider factory (missing API key → 503, unsupported provider → 500,
  valid construction), using a mocked env module. No network, no Prisma.
- `tests/gemini-provider.test.ts` — **3/3 passed.** Unit tests for
  `GeminiProvider` (correct request/history mapping, safe error wrapping
  that never leaks the raw SDK error message, empty-response handling),
  using a mocked `@google/genai` module. No network, no Prisma.
- `npm run build` (frontend) — **zero TypeScript errors**, production
  build succeeds.
- **Full browser-driven E2E (Playwright, headless Chromium)** against a
  temporary mock server implementing the exact Phase 1+3 API contract
  (same request/response shapes, status codes) — **15/15 checks passed**,
  covering both a Phase 2 CRUD regression pass (dashboard, list, create,
  edit, delete all still work) and the new Chat flows: empty state, send
  button disabled with no input, loading/typing indicator, user + assistant
  messages rendering, input re-enabled after response, multi-turn
  conversation continuity, and the error state (with the failed user
  message visibly marked) on a simulated provider failure.

**Not run in this sandbox (environment limitation, same as Phases 1–2):**
this sandbox cannot reach `binaries.prisma.sh`, so the Prisma client
still can't be generated here. As a result, `tests/chat.test.ts` (the
DB-backed integration tests — the same suite that exercises real
conversation/message persistence against Postgres) could not actually
run here, and neither could the backend live-start or a real Gemini API
call. These need to be run on a machine with normal internet access and
a real `GEMINI_API_KEY`.

## Confirmation Phase 1 and Phase 2 remain intact

- No files under `backend/src/` other than the additions listed below
  were modified — all existing Game CRUD/health code is untouched.
- `backend/prisma/schema.prisma` had exactly one field changed
  (`Conversation.userId` → optional) — `User`, `Game`, and `Message` are
  unchanged.
- The Phase 2 regression pass above (dashboard → games list → create →
  edit → delete) was re-verified end-to-end via the same Playwright
  session as the new chat tests, immediately before testing chat, and all
  five steps passed.

## Files created/modified in Phase 3

**Backend — created:**
`src/services/ai/llmProvider.ts`, `src/services/ai/geminiProvider.ts`,
`src/services/ai/systemPrompt.ts`, `src/services/ai/index.ts`,
`src/services/chat.service.ts`, `src/controllers/chat.controller.ts`,
`src/routes/chat.routes.ts`, `src/repositories/conversation.repository.ts`,
`src/repositories/message.repository.ts`, `src/types/chat.ts`,
`tests/chat.test.ts`, `tests/ai-provider.test.ts`, `tests/gemini-provider.test.ts`

**Backend — modified:**
`src/config/env.ts` (added `ai` config block), `src/routes/index.ts`
(registered `/chat`), `prisma/schema.prisma` (`Conversation.userId`
optional), `.env.example` (added `AI_PROVIDER`/`GEMINI_API_KEY`/`GEMINI_MODEL`),
`package.json` (added `@google/genai` dependency)

**Frontend — created:**
`src/pages/ChatPage.tsx`, `src/services/chatService.ts`, `src/types/chat.ts`

**Frontend — modified:**
`src/App.tsx` (added `/chat` route), `src/components/Navbar.tsx` (added
Chat link), `src/pages/DashboardPage.tsx` (added Chat CTA),
`src/types/index.ts` (re-export chat types), `src/index.css` (chat UI styles)

---

# Phase 4 — RAG Ingestion Pipeline

## What Phase 4 implements

A clean, production-oriented pipeline that turns local gaming-knowledge
documents into normalized, chunked, metadata-rich pieces ready to be
embedded and inserted into a vector database in Phase 5:

```text
Raw documents (.md/.txt files)
      ↓
Document loader        (src/rag/loaders)
      ↓
Text extraction         (reading the file — part of the loader)
      ↓
Text cleaning/normalization (src/rag/processors/normalizer.ts)
      ↓
Metadata extraction      (src/rag/processors/metadataExtractor.ts)
      ↓
Chunking                  (src/rag/chunkers/chunker.ts)
      ↓
Chunk validation            (src/rag/pipeline/validation.ts)
      ↓
Embedding-ready DocumentChunk[]
      ↓
[Phase 5: embeddings + Qdrant — not implemented yet]
```

All of this is exposed both as a REST API (`POST /api/rag/ingest`,
`GET /api/rag/documents/:documentId/chunks`) and a CLI (`npm run rag:ingest`).

**Qdrant, vector search, embeddings, MCP, authentication, and
conversation memory are explicitly NOT part of Phase 4.** The pipeline
produces `DocumentChunk[]` and stops there — nothing in `src/rag/` knows
what a vector or an embedding is.

## Architecture

```text
src/rag/
├── types/document.ts          RawDocument, ProcessedDocument, DocumentChunk, DocumentMetadata
├── loaders/
│   ├── documentLoader.ts       DocumentLoader interface
│   └── markdownLoader.ts       Loads .md/.txt files (recursively, or a single file)
├── processors/
│   ├── normalizer.ts            Cleans text (whitespace, line endings) without altering wording
│   └── metadataExtractor.ts     Builds the full DocumentMetadata a chunk will carry
├── chunkers/
│   └── chunker.ts                Paragraph-aware, deterministic, size/overlap-configurable chunking
├── pipeline/
│   ├── ingestionPipeline.ts       Orchestrates load → normalize → extract metadata → chunk → validate
│   └── validation.ts               Document/chunk validation, duplicate-id detection
├── store/
│   └── chunkStore.ts               In-memory cache of chunks by documentId (see "Storage decision" below)
└── cli/
    └── ingest.ts                    `npm run rag:ingest` entrypoint

src/services/rag.service.ts     Orchestrates ingestionPipeline + chunkStore, shapes API responses
src/controllers/rag.controller.ts
src/routes/rag.routes.ts        POST /rag/ingest, GET /rag/documents/:documentId/chunks
src/types/rag.ts                 Zod schemas for the RAG endpoints

data/knowledge/                  Sample dataset (elden-ring/, dark-souls/)
```

This mirrors the existing `controllers → services → repositories`
layering: `ragController → ragService → ingestionPipeline` (the RAG
equivalent of a repository, except it transforms rather than persists),
using the same `AppError`/`ValidationError`/`NotFoundError` hierarchy,
the same `validate()` Zod middleware, and the same `logger` as the rest
of the backend.

## Document lifecycle

1. **Load** — `MarkdownLoader` reads one file or recursively walks a
   directory for `.md`/`.txt` files, producing a `RawDocument` per file.
   A file's immediate parent folder name becomes its `gameSlug`; the
   filename (without extension) becomes its `category`; the title comes
   from the first `# Heading` line, or a humanized filename if there
   isn't one.
2. **Normalize** — `normalizeText()` unifies line endings, trims
   trailing whitespace per line, and collapses runs of blank lines down
   to one — conservatively, so no wording, headings, or paragraphs are
   altered or removed.
3. **Extract metadata** — `extractMetadata()` builds the full
   `DocumentMetadata` (documentId, title, source, sourceType, gameSlug,
   plus anything else the loader supplied, like `category`) that every
   chunk of this document will carry.
4. **Chunk** — `chunkDocument()` splits the normalized text into
   `DocumentChunk`s (see "Chunking strategy" below).
5. **Validate** — every raw document and every chunk is checked (empty
   content, missing title/gameSlug, empty chunks, duplicate document ids
   within a batch) before being accepted.
6. **Store** — the API layer (`ragService`) caches the resulting chunks
   in memory, keyed by documentId, so they can be previewed.

## Loading and normalization

- Supported inputs: a single `.md`/`.txt` file, or a directory (scanned
  recursively; hidden files/folders are skipped).
- **Security:** `MarkdownLoader` is restricted to a configured root
  directory (`data/knowledge` by default) — any path that resolves
  outside it, including `../` traversal attempts, is rejected with a
  `400`. Without this, the ingest endpoint would let any caller read
  arbitrary files on the server (there's no authentication yet either),
  since it accepts a raw filesystem path in the request body.
- Normalization never rewrites words, strips headings, or reformats
  paragraphs — RAG answer quality depends on that context surviving
  intact. It only removes formatting *noise*.

## Metadata strategy

Every `DocumentChunk` carries a **full copy** of its document's metadata
(`documentId`, `title`, `source`, `sourceType`, `gameSlug`, `category`,
plus anything else a loader adds), not just a foreign key back to a
document record. This is deliberate: once a chunk is embedded and stored
as an independent point in Phase 5's vector index, it needs to be
self-describing — a search result should be filterable/attributable by
`gameSlug` or `category` without a join back to a documents table that,
per the storage decision below, doesn't exist.

## Chunking strategy

`chunkText()`/`chunkDocument()` in `src/rag/chunkers/chunker.ts`:

- **Paragraph-aware**: packs whole paragraphs into a chunk up to
  `chunkSize` words, splitting a paragraph internally only if that one
  paragraph alone exceeds `chunkSize`. This avoids cutting a chunk in
  the middle of a sentence whenever possible.
- **Configurable, sensible defaults**: `chunkSize: 1000` words,
  `overlap: 150` words — within the 800–1200 / 100–200 ranges suggested
  for prose-heavy content, without pulling in a tokenizer dependency for
  what is, at this stage, word-count-based chunking.
- **Overlap**: each chunk after the first starts with the last `overlap`
  words of the previous chunk, so context isn't lost at a chunk boundary.
- **Deterministic**: pure functions, no randomness or timestamps — same
  input always produces the same chunks and the same chunk ids
  (`${documentId}-chunk-${index}`).
- **No empty chunks**: paragraphs are filtered for emptiness before
  packing; the packer never emits a block-less chunk.
- **Documented size bound**: a chunk's word count is guaranteed to be at
  most `chunkSize + overlap`, not a hard `chunkSize` ceiling — the "+
  overlap" comes from a chunk starting with carried-over words from the
  previous one. This is a standard trade-off for overlap-based chunking,
  not a bug, and is called out in the code comment above `chunkText()`.

## Storage decision: in-memory cache, not new Prisma tables

Phase 4 does **not** add `Document`/`Chunk` tables to `schema.prisma`.
The only consumer of stored chunks right now is the preview endpoint —
a temporary tool for manually inspecting ingestion output before Phase 5
exists. Persisting that to Postgres would mean adding tables purely to
support a preview UI, then almost certainly reshaping or discarding them
once Phase 5 introduces Qdrant as the real chunk/embedding store.
`src/rag/store/chunkStore.ts` is an in-memory `Map`, documented in-file,
with one explicit trade-off: **it does not survive a server restart** —
re-run ingestion afterward. That's acceptable for a preview tool; it
would not be acceptable for Phase 5's real retrieval path, which is
exactly why Phase 5 needs real (Qdrant-backed) persistence rather than
extending this cache.

## How to add new game knowledge

Add `.md` or `.txt` files under `data/knowledge/<game-slug>/`, one file
per topic (e.g. `overview.md`, `combat.md`, `lore.md`). The system is
not hard-coded to any specific game — `gameSlug` and `category` are
always derived from the folder/file names, so adding a new game is just
adding a new folder:

```text
data/knowledge/
├── elden-ring/
│   ├── overview.md
│   ├── combat.md
│   └── lore.md
├── dark-souls/
│   ├── overview.md
│   └── combat.md
└── your-new-game/
    └── overview.md
```

Start each file with a `# Heading` to control its title (otherwise the
filename is humanized into one), and write normal prose — normalization
preserves paragraphs and headings as-is.

## How to run ingestion

**CLI** (ingests `data/knowledge` by default):

```bash
npm run rag:ingest
# or a specific game:
npm run rag:ingest -- data/knowledge/elden-ring
```

**API:**

```bash
curl -X POST http://localhost:5000/api/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{"path": "data/knowledge/elden-ring"}'

curl http://localhost:5000/api/rag/documents/elden-ring-overview/chunks
```

Both are documented in Swagger at `/api/docs` under the "RAG" tag.

## How Phase 4 connects to Phase 5

`ingestionPipeline.ingest(source)` returns `{ documents, chunks }` where
each `DocumentChunk` is exactly the unit Phase 5 needs to embed:

```text
DocumentChunk { id, documentId, content, metadata, chunkIndex, chunkCount }
        ↓ (Phase 5)
embedding = embed(chunk.content)
        ↓ (Phase 5)
Qdrant point { id: chunk.id, vector: embedding, payload: chunk.metadata }
```

Phase 5's job is entirely additive: call an embedding model on
`chunk.content`, and upsert the result into Qdrant using `chunk.metadata`
as the payload. Nothing in `src/rag/` needs to change for that to work.

## Sample ingestion output

```text
$ npm run rag:ingest

RAG ingestion started...

Documents processed: 5
Chunks created: 5

Ingestion completed successfully.
```

(Each sample document is short enough to fit in a single ~1000-word
chunk at the default chunk size — this is correct, expected behavior,
not a sign that chunking isn't working. The chunker tests exercise the
multi-chunk case directly with larger synthetic content.)

## Known limitations

- The in-memory chunk store (see "Storage decision" above) does not
  survive a server restart.
- Chunking is word-count based, not tokenizer-based — a reasonable
  approximation for this stage, but not an exact token count for any
  specific embedding model.
- Only local `.md`/`.txt` files are supported; a web/URL loader would
  need a new `DocumentLoader` implementation (the interface already
  supports this without changing the pipeline).
- Same environment limitation as every prior phase: this sandbox cannot
  reach `binaries.prisma.sh`, so `npm run build`/`npm test` still fail on
  the Prisma-dependent files (`chat`, `games`, `health`, `rag-api` test
  suites; the compiled `dist/` output) for reasons unrelated to Phase 4 —
  see "Tests performed and results" below.

## Tests performed and results (this environment)

**Actually run in this sandbox — 41/41 passed** across the suites that
don't require a generated Prisma client:

- `tests/rag/markdownLoader.test.ts` — valid markdown/text loading,
  missing files (404), empty files (loads with empty content, doesn't
  throw), directories with no supported files, loading the allowed root
  itself, and rejecting paths outside the allowed root (including a
  traversal attempt) — **9 tests**
- `tests/rag/normalizer.test.ts` — blank-line collapsing, paragraph
  preservation, CRLF/CR normalization, trailing-whitespace trimming,
  heading preservation — **7 tests**
- `tests/rag/chunker.test.ts` — single-chunk-for-small-content,
  multi-chunk for large documents, chunk-size bound, overlap, no empty
  chunks, oversized-paragraph splitting, determinism, invalid-options
  rejection, metadata preservation, deterministic chunk ids — **10 tests**
- `tests/rag/pipeline.test.ts` — end-to-end directory ingestion, empty
  content rejection, missing source (404), missing title/gameSlug
  rejection, no-supported-documents rejection, duplicate-id rejection,
  metadata propagation, chunk count scaling with a smaller chunk size —
  **9 tests**
- `tests/ai-provider.test.ts` + `tests/gemini-provider.test.ts` (Phase 3,
  re-confirmed still passing) — **6 tests** (3 + 3)

**Not run in this sandbox** (environment limitation, unrelated to Phase 4
code): `tests/games.test.ts`, `tests/health.test.ts`,
`tests/chat.test.ts`, and the new `tests/rag-api.test.ts` all import
`createApp()`, which imports the Prisma client — and this sandbox cannot
reach `binaries.prisma.sh` to generate it. All four fail with the
byte-for-byte identical `Module "@prisma/client" has no exported member
'PrismaClient'` error; this has been true since Phase 1 and is not a
Phase 4 regression. `npm run build` fails for the same reason. These
should be run on a machine with normal internet access.

## A cross-cutting bug found and fixed during Phase 4

While writing RAG tests, `AppError`'s constructor was found to
unconditionally call `Object.setPrototypeOf(this, AppError.prototype)`,
which silently broke `instanceof NotFoundError` / `instanceof
ValidationError` / `instanceof ConflictError` for every subclass —
meaning `errorHandler.ts`'s `err instanceof ValidationError` check never
actually matched, so **`error.details` (the field-level Zod validation
messages) has likely never appeared in any 400 response since Phase 1**,
even though `res.body.error.message` was still correct. This was fixed
by removing that unnecessary line (the project's ES2020 target doesn't
need the old ES5 prototype-chain workaround). `tests/games.test.ts` and
`tests/chat.test.ts` were strengthened with a regression check that
`error.details` is actually populated, so this class of bug would be
caught automatically going forward. This fix affects error responses
project-wide, not just RAG — flagging it clearly since it's outside
Phase 4's stated scope but was a genuine, previously-undetected defect.

## Dependencies added

**None.** Phase 4 uses only Node's built-in `fs`/`path` modules and the
project's existing `zod`/`express` stack — no new npm packages.

## What should be addressed before Phase 5

- Generate the Prisma client and run the full test suite (including the
  new `rag-api.test.ts`) on a machine with normal internet access to get
  a genuine end-to-end confirmation, including the HTTP-level security
  tests (path traversal, missing path, 404s).
- Decide on an embedding model/provider for Phase 5 (separate from the
  Gemini chat model — could be Gemini's embedding endpoint or a
  dedicated embedding model).
- Decide whether Phase 5 needs any lightweight Postgres tracking (e.g.
  "which documents/chunks have been embedded and pushed to Qdrant") or
  whether Qdrant's own payload is sufficient — this in-memory chunk store
  is not meant to be extended into that; it should be replaced.
- Consider whether `RAG_DATA_ROOT`-style configurability (the allowed
  ingestion root) should become a proper env var like the rest of the
  project's configuration, rather than a constructor default — kept as a
  constructor parameter for Phase 4 to keep it easily testable, but worth
  revisiting once real deployment configuration is a concern.

---

# Phase 5 — Qdrant Vector Search

## What Phase 5 implements

Persistent vector storage and semantic search on top of the Phase 4
ingestion pipeline. Ingested chunks are now embedded and stored in
Qdrant, and can be searched by meaning rather than exact keyword match.

```text
Knowledge documents
      ↓
Phase 4 ingestion pipeline (load → normalize → metadata → chunk → validate)
      ↓
Document chunks
      ↓
Embedding generation (Gemini)
      ↓
Qdrant vector database (persistent, cosine similarity)
      ↓
Vector similarity search (with metadata filtering)
      ↓
Relevant chunks
```

## Why Qdrant / why vector search

Phase 4's chunk store only supported exact lookup by `documentId` — fine
for previewing ingestion output, useless for answering a question like
"how does combat work?" against a knowledge base the asker doesn't know
the internal IDs for. Vector search solves that: it ranks chunks by
semantic similarity to a query, so "how does combat work?" and "explain
the fighting mechanics" can both surface the same relevant chunk even
though they share almost no exact words. Qdrant is the persistent store
for those chunk embeddings and the engine that performs that similarity
ranking.

## Architecture

```text
src/services/ai/
├── embeddingProvider.ts        EmbeddingProvider interface + EmbeddingProviderError
└── geminiEmbeddingProvider.ts   Concrete Gemini implementation
src/services/ai/index.ts         getEmbeddingProvider()/setEmbeddingProviderForTesting() — same
                                  lazy-cache factory pattern as getLLMProvider()

src/rag/vector/
├── types.ts            ChunkPayload, VectorPoint, VectorSearchOptions, VectorSearchMatch
├── errors.ts             QdrantError
├── qdrantClient.ts        Qdrant REST client singleton (env-configured)
├── qdrantService.ts        Collection management + low-level upsert/search/delete
└── pointId.ts               Deterministic UUID v5 point IDs (documentId + chunkIndex)

src/rag/store/
├── chunkStore.ts        Phase 4's in-memory cache (kept — still backs the preview endpoint)
└── vectorStore.ts         Phase 5: chunks → embeddings → Qdrant points; the persistent store

src/rag/search/
├── types.ts              SearchOptions, SearchResultItem
└── search.service.ts       query → embed → Qdrant search → SearchResultItem[]
```

Call path for ingestion: `ragController → ragService.ingest() →
ingestionPipeline.ingest()` (Phase 4, unchanged, still storage-agnostic)
`→ vectorStore.upsertChunks()` (Phase 5, new) `→ getEmbeddingProvider()` +
`qdrantService`. Call path for search: `ragController → ragService.search()
→ searchService.search() → getEmbeddingProvider() + vectorStore.search() →
qdrantService.searchPoints()`.

`ingestionPipeline.ts` itself was **not modified** — it remains
independent of Qdrant exactly as Phase 4 designed it, and is still fully
unit-testable without a live vector database. Only `rag.service.ts` (the
API-layer orchestrator) was extended to also call `vectorStore`.

### Two stores, on purpose

`chunkStore` (Phase 4, in-memory) and `vectorStore` (Phase 5, Qdrant-backed)
both exist and both get populated on every ingest. `chunkStore` still
backs the Phase 4 preview endpoint
(`GET /api/rag/documents/:documentId/chunks`) — a quick, DB-free way to
inspect what a specific document chunked into. `vectorStore` is the real,
persistent, searchable index. Neither replaces the other; they answer
different questions ("what did this one document turn into?" vs. "what's
relevant to this query, across everything ingested?").

## Embedding model

```text
Provider:          Gemini (Google), via the official @google/genai SDK
Model:              gemini-embedding-001
Vector dimensions:  768 (configurable via EMBEDDING_DIMENSIONS)
Distance metric:    Cosine
```

`gemini-embedding-001` is Google's current, actively supported text
embedding model — the previous default, `text-embedding-004`, is
deprecated. It natively outputs 3072-dimensional vectors but supports
Matryoshka truncation to smaller sizes (768/1536/3072 are the documented
options) with minimal quality loss; 768 was chosen to keep Qdrant's
storage footprint small for local development and this project's small
sample dataset, while staying on a documented, supported size. Raise
`EMBEDDING_DIMENSIONS` if retrieval quality ever needs it — the
collection is always created with whatever size the active provider
reports, never a hardcoded guess.

**Embedding is a separate model from chat.** `GEMINI_MODEL`
(`gemini-2.5-flash`, Phase 3) generates conversational text;
`EMBEDDING_MODEL` (`gemini-embedding-001`) only produces vectors. They
share `GEMINI_API_KEY` (same Gemini account) but are configured, cached,
and invoked completely independently — `src/services/ai/index.ts` has
separate `getLLMProvider()`/`getEmbeddingProvider()` factories, each with
its own cache.

Gemini's embedding API distinguishes *what* is being embedded via a
`taskType`: chunks being indexed use `RETRIEVAL_DOCUMENT`, a search query
uses `RETRIEVAL_QUERY` — this measurably improves retrieval quality over
embedding both sides the same way, and is handled automatically
(`vectorStore.upsertChunks` always passes `RETRIEVAL_DOCUMENT`;
`searchService.search` always passes `RETRIEVAL_QUERY`).

## Qdrant

```text
Qdrant URL:        http://localhost:6333 (configurable via QDRANT_URL)
Collection:          gaming_knowledge (configurable via QDRANT_COLLECTION)
Distance metric:      Cosine
Point ID strategy:     Deterministic UUID v5, derived from (documentId, chunkIndex)
```

### Collection management

The collection is created automatically, on first ingest, with the exact
vector size reported by the active embedding provider
(`provider.dimensions`) — never guessed or hardcoded — and cosine
distance, the standard choice for normalized text embeddings.
Subsequent ingests check for the collection's existence first and reuse
it. `src/rag/vector/qdrantService.ts` is the only file that talks to
`@qdrant/js-client-rest` directly.

### Payload structure

Every Qdrant point's payload is a `ChunkPayload` — the chunk's full Phase
4 metadata plus a few chunk-specific fields, so a search result is fully
self-describing without a second lookup:

```ts
{
  documentId, title, source, sourceType, gameSlug, category, // from Phase 4 DocumentMetadata
  chunkId, content, chunkIndex,                               // chunk-specific
}
```

### Point ID strategy (no duplicate vectors)

Qdrant point IDs must be an unsigned integer or a valid UUID — not an
arbitrary string like the chunk id (`"elden-ring-combat-chunk-0"`). Each
point's ID is instead a **UUID v5** derived deterministically from
`(documentId, chunkIndex)` (`src/rag/vector/pointId.ts`, implemented with
Node's built-in `crypto` module — no new dependency). The same chunk
always maps to the same UUID, so re-running `npm run rag:ingest` /
`POST /api/rag/ingest` **upserts** the existing point instead of creating
a duplicate alongside it — verified directly (see "Real end-to-end
verification" below): ingesting the same 5 documents twice left the
collection's point count unchanged.

## Ingestion flow (updated from Phase 4)

```text
load → normalize → extract metadata → chunk → validate   (Phase 4, unchanged)
      ↓
generate embeddings (batched, RETRIEVAL_DOCUMENT)          (Phase 5)
      ↓
ensure Qdrant collection exists (correct size, Cosine)      (Phase 5)
      ↓
upsert points (deterministic IDs, full metadata payload)     (Phase 5)
```

**Behavior change from Phase 4:** `POST /api/rag/ingest` now requires
both `GEMINI_API_KEY` and a reachable Qdrant instance to succeed — if
either is missing/unreachable, the request fails with a clear error
(503/502) rather than silently skipping vector storage. This is
deliberate: the whole point of Phase 5 is that ingestion actually
produces searchable vectors, so a "successful" response that quietly
never touched Qdrant would be a confusing way to fail. The response
shape on success is unchanged from Phase 4
(`documentsProcessed`, `chunksCreated`, `documentIds`).

## Search flow

```text
query (natural language)
      ↓
embed query (RETRIEVAL_QUERY task type)
      ↓
Qdrant cosine similarity search (optionally filtered by gameSlug/category)
      ↓
SearchResultItem[] (score, chunkId, documentId, gameSlug, category, title, content, chunkIndex)
```

## Metadata filtering

`gameSlug` and/or `category` can be supplied to restrict results, e.g.
`{ "query": "...", "gameSlug": "elden-ring" }` only searches Elden Ring's
chunks. This is a real Qdrant payload filter (`must: [{ key, match }]`),
not post-hoc filtering of unrestricted results — verified directly (see
below) with both a `gameSlug`-only and a `category`-only filter, each
returning exclusively matching results.

## Environment variables

Added to `backend/.env.example` (no real key is stored there or shipped
anywhere):

```env
# Reuses GEMINI_API_KEY from Phase 3 (same Gemini account, different model)
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=768
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=gaming_knowledge
```

## Running Qdrant for Phase 10D (RAG)

This project uses **Qdrant** as the vector database for RAG (Retrieval-Augmented Generation). Qdrant must be running before the backend can ingest or search knowledge.

### Quick Start (Native Binary — No Docker Required)

Since Docker/WSL may not be available in all environments, the recommended approach is running Qdrant as a native binary:

```bash
# Download Qdrant v1.20.0 (or latest) for Windows x86_64
# https://github.com/qdrant/qdrant/releases/download/v1.20.0/qdrant-x86_64-pc-windows-msvc.zip

# 1. Extract to a folder (e.g., backend/qdrant/)
# 2. Create a storage directory
mkdir qdrant-storage && cd qdrant-storage

# 3. Run Qdrant (foreground, or use your preferred process manager)
../qdrant.exe
```

Qdrant will be available at:
- **REST API**: `http://localhost:6333`
- **gRPC**: `localhost:6334`
- **Web Dashboard**: `http://localhost:6333/dashboard`
- **Health Check**: `curl http://localhost:6333/healthz` → returns `healthz check passed`

### Alternative: Docker (if available)

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant:v1.20.0
```

### Verification Checklist

Before running `npm run rag:ingest` or `npm run dev`:

1. ✅ Qdrant health check passes: `curl http://localhost:6333/healthz`
2. ✅ Backend health check passes: `curl http://localhost:5000/api/health` (shows `"database":"ok"`)
3. ✅ RAG search returns expected "no data" message when collection is empty:
   ```bash
   curl -X POST http://localhost:5000/api/rag/search \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}'
   # Expected: {"success":false,"error":{"message":"No knowledge has been ingested yet — run ingestion before searching."}}
   ```

### Phase 10D Complete State

| Service | Port | Status | Notes |
|---------|------|--------|-------|
| Qdrant (vector DB) | 6333 | ✅ Running | Native binary, storage in `qdrant-storage/` |
| Backend (Express) | 5000 | ✅ Running | Connected to PostgreSQL, RAG endpoints active |

After ingestion (`npm run rag:ingest`), semantic search will return results with scores, document metadata, and chunk content.

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/rag/ingest` | (Phase 4, now also embeds + upserts into Qdrant) |
| GET | `/api/rag/documents/:documentId/chunks` | (Phase 4, unchanged — reads from `chunkStore`) |
| POST | `/api/rag/search` | **New.** Semantic search over ingested knowledge |

```bash
curl -X POST http://localhost:5000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "How does combat work in Elden Ring?", "limit": 5, "gameSlug": "elden-ring"}'
```

Documented in Swagger at `/api/docs` under the "RAG" tag, alongside the
Phase 4 endpoints.

## How to run Qdrant locally

**This development environment previously had issues with Docker/WSL, so
Docker is not assumed to work.** Two options, in order of preference:

**Option A — Docker (if it works on your machine):**

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

**Option B — native binary (no Docker required; this is what was used to
verify Phase 5 in this sandbox, since Docker isn't available here
either):**

```bash
# Linux x86_64 example — see https://github.com/qdrant/qdrant/releases
# for other platforms.
curl -L https://github.com/qdrant/qdrant/releases/download/v1.19.0/qdrant-x86_64-unknown-linux-gnu.tar.gz -o qdrant.tar.gz
tar xzf qdrant.tar.gz
mkdir qdrant-storage && cd qdrant-storage
../qdrant
```

Either way, confirm it's reachable before ingesting:

```bash
curl http://localhost:6333/
```

Qdrant also serves a web dashboard at `http://localhost:6333/dashboard`
for browsing collections/points visually.

## How to ingest knowledge and test semantic search

```bash
cd backend
npm install
cp .env.example .env        # fill in GEMINI_API_KEY; QDRANT_* defaults work with the setup above
npx prisma generate
npx prisma migrate dev
npm run dev                 # in one terminal

npm run rag:ingest          # in another terminal — embeds + upserts the sample dataset into Qdrant

curl -X POST http://localhost:5000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "How does combat work in Elden Ring?", "gameSlug": "elden-ring"}'
```

## What was tested, and how

**Unit tests actually run in this sandbox — 20 new Phase 5 tests, all
passing, none requiring Prisma or a live Qdrant server:**

- `tests/rag/vector/geminiEmbeddingProvider.test.ts` (8 tests) — request
  mapping (model, taskType, outputDimensionality), batch splitting
  (45 texts → 3 calls at a batch size of 20), safe error wrapping,
  dimension/empty-vector/count-mismatch validation. Mocks `@google/genai`
  directly, same pattern as Phase 3's `gemini-provider.test.ts`.
- `tests/rag/vector/qdrantService.test.ts` (15 tests) — collection
  creation with the correct size/distance, skip-if-exists, upsert mapping,
  search with/without filters, delete, and — found via the real E2E run
  below and fixed — two regression tests confirming a genuine Qdrant
  connectivity failure surfaces as a 503, not a 404. Mocks the Qdrant
  client via `setQdrantClientForTesting`.
- `tests/rag/store/vectorStore.test.ts` (6 tests) — empty-input no-op,
  collection-ensure + embed + upsert orchestration, same point ID across
  two calls for the same chunk (the actual duplicate-prevention
  mechanism, unit-tested in isolation), dimension-mismatch rejection.
- `tests/rag/search/search.service.test.ts` (5 tests) — query embedding
  with the correct task type, default/custom limit, filter passthrough,
  result mapping, empty-results handling.
- `tests/embedding-provider-factory.test.ts` (3 tests) — missing API key
  → 503, unsupported provider → 500, valid construction. Mirrors Phase
  3's `ai-provider.test.ts`.
- `tests/rag/vector/pointId.test.ts` (5 tests) — deterministic UUID v5
  generation: same input → same output, different document/index →
  different output, valid UUID shape.

**Full suite result: 83/83 runnable tests pass.** The same 4 suites that
have failed since Phase 1 for an unrelated, pre-existing reason
(`games.test.ts`, `health.test.ts`, `chat.test.ts`, `rag-api.test.ts` —
all import `createApp()`, which needs a generated Prisma client this
sandbox can't produce) still fail identically; nothing new.

### Real end-to-end verification (live local Qdrant, not mocked)

This sandbox has no real `GEMINI_API_KEY`, so rather than inventing
credentials, a deterministic **bag-of-words** fake embedding provider was
injected (via `setEmbeddingProviderForTesting`) for this run: each word
hashes into one of 768 dimensions, counts are L2-normalized. This is
*not* a claim of real semantic embedding quality — it's a crude proxy
that still produces higher cosine similarity for texts sharing more
words, which is enough to genuinely exercise Qdrant's actual similarity
ranking, filtering, and persistence — everything except real semantic
understanding, which requires the real Gemini embedding API and was
**not** verified here.

Against a real local Qdrant instance (downloaded as a native binary and
run directly, since Docker isn't available in this sandbox either — see
"How to run Qdrant locally" above), **14/14 checks passed**:

1. Qdrant reachable
2. Ingestion processes all 5 sample documents
3. Ingestion creates 5 chunks
4. Collection auto-created with the correct vector size (768)
5. Collection uses cosine distance
6. Point count matches chunks created after first ingest
7. **Re-ingesting the same documents does not create duplicate points**
   (point count unchanged after a second `ingest` call)
8. Search returns results
9. Top result for a combat-heavy query is actually categorized "combat"
10. `gameSlug` filter returns only that game's chunks
11. `category` filter returns only that category's chunks
12. A deliberately mis-shaped embedding is rejected *before* reaching
    Qdrant (dimension-mismatch validation)
13. Deleting a document's chunks removes them from subsequent search
    results
14. Pointing at an unreachable Qdrant surfaces a safe 503 error (this
    check initially **failed** — see below)

**A real bug found and fixed via this E2E run:** `qdrantService`'s
`searchPoints` and `deletePointsByDocumentId` both used
`collectionExists(client).catch(() => false)` — silently treating *any*
failure (including Qdrant being completely unreachable) the same as "the
collection legitimately doesn't exist yet." That meant a real
connectivity failure during search surfaced as a misleading 404 ("run
ingestion first") instead of a 503 ("service unavailable"), and a
connectivity failure during delete silently no-op'd instead of reporting
anything — a caller would believe the delete succeeded. Fixed by only
treating a *successful* existence check that returns `false` as "doesn't
exist"; any thrown error during that check now correctly propagates as a
503 `QdrantError`. Both `qdrantService.test.ts` regression tests above
were added for this, and the E2E check re-run to 14/14 after the fix.

## Known limitations

- **Embedding quality is unverified with the real model.** All Qdrant
  mechanics (collection creation, upsert, search, filtering, delete,
  duplicate prevention, error handling) were verified against a real
  Qdrant instance; real semantic embedding *quality* requires a real
  `GEMINI_API_KEY`, which isn't available in this sandbox. Please run
  `npm run rag:ingest` and a few real searches with your own key and
  confirm results look sensible.
- **Timeout handling is implemented but not directly unit-tested.**
  `GeminiEmbeddingProvider` reuses the same `withTimeout` wrapper as
  Phase 3's chat provider (30s), but the exact timeout trigger isn't
  cheaply testable without waiting out the real timeout or refactoring to
  inject the duration — the same limitation Phase 3's `GeminiProvider`
  already had for the identical pattern; this isn't a new gap.
  Error-path handling *around* a rejected/failed call is fully tested.
- **`rag-api.test.ts`** (the Phase 4 HTTP-level test suite) doesn't yet
  have Phase 5-specific HTTP tests for `/rag/search` — it wasn't runnable
  in this sandbox anyway (same Prisma limitation), so new HTTP-level
  tests for it couldn't be verified here either. The service-level logic
  those tests would exercise (`ragService.search`) is a thin,
  already-tested pass-through to `searchService.search`
  (`tests/rag/search/search.service.test.ts`).
- Same environment limitation as every prior phase: `npm run build` and
  the 4 Prisma-dependent test suites need a machine with normal internet
  access to run `npx prisma generate` successfully.

## What should be done before Phase 6

- Run the full suite (including the 4 currently Prisma-blocked suites)
  and a real `GEMINI_API_KEY` ingest + search on a machine with normal
  internet access.
- Consider adding `rag-api.test.ts` coverage for `/rag/search` once that
  suite is runnable.
- Decide how search results should actually feed into `/api/chat` — Phase
  5 deliberately stops at retrieval (`SearchResultItem[]`) and does not
  wire it into the LLM prompt; that integration is explicitly out of
  scope here and belongs to a later phase's architecture work, not a
  quick addition now.
