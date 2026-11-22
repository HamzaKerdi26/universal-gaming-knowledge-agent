# Universal Gaming Knowledge Agent — Phase 1 (Backend Foundation)

## 1. What this project is

The **Universal Gaming Knowledge Agent** is an AI-powered gaming knowledge
platform, built incrementally across multiple phases, that will eventually
answer questions about many different video games using RAG, an LLM
(Gemini), a vector database (Qdrant), agentic tool use (MCP), and
conversation memory on top of a React frontend.

This repository is **Phase 1**: the backend foundation only. It is not a
disposable prototype — later phases extend this exact project.

## 2. What Phase 1 implements

- Node.js + Express + TypeScript REST API
- PostgreSQL database via Prisma ORM
- Layered architecture: `controllers → services → repositories → Prisma → PostgreSQL`
- Centralized error handling with consistent JSON error responses
- Request validation with Zod
- Swagger / OpenAPI documentation
- Health check endpoint (with database connectivity check)
- Full CRUD REST API for `Game` records
- Database foundation for `User`, `Game`, `Conversation`, `Message`
  (no authentication or password hashing yet — that's a later phase)
- Seed script with example games
- Automated tests (Jest + Supertest)

## 3. Technologies used

- Node.js, TypeScript
- Express 5
- Prisma ORM 7 + PostgreSQL (via the `@prisma/adapter-pg` driver adapter, required by Prisma 7)
- Zod (validation)
- swagger-jsdoc + swagger-ui-express
- Jest + Supertest (testing)
- morgan (HTTP logging), cors, dotenv

## 4. Prerequisites

- Node.js 18+ and npm
- A running PostgreSQL 14+ instance (local or remote)

## 5. PostgreSQL setup

Create a database for the project. Example using `psql`:

```bash
psql -U postgres -c "CREATE DATABASE gaming_agent;"
```

(Adjust the user/host/port to match your local PostgreSQL setup.)

## 6. Environment variables

Copy the example file and fill in your real database credentials:

```bash
cp .env.example .env
```

`.env.example` contents:

```env
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/gaming_agent
NODE_ENV=development
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
JWT_EXPIRES_IN_SECONDS=3600
```

`.env` is git-ignored and must never be committed.

**Authentication (Phase 9):** Set `JWT_SECRET` to a randomly generated
secret of at least 32 characters; it is required for registration, login,
chat, and conversation endpoints. Start the backend with `npm run dev`
from `backend/`, then start the frontend with `npm run dev` from
`frontend/`. Register or sign in through the frontend; chat and conversation
requests include the bearer token automatically.

Conversation list and message-history endpoints accept `page` (default `1`)
and `limit` (default `100`, maximum `100`). Responses keep the existing
`data.conversations` / `data.messages` arrays and add a sibling `pagination`
object with `page`, `limit`, `totalCount`, and `totalPages`. Conversation
lists are ordered by most recently updated; messages are chronological with
ID tie-breaking. RAG API integration tests isolate the vector-store boundary;
Qdrant-specific operations remain covered by their dedicated tests.

**Administrative operations (Phase 10B):** Set `ADMIN_USER_IDS` to a
comma-separated list of existing Prisma user IDs allowed to create, update,
or delete games, ingest RAG documents, and import external records. User IDs
come from signed JWT subjects; registration cannot grant administrator
access. Set `FRONTEND_ORIGINS` to explicit browser origins (for example
`http://localhost:5173` in development); production requires an explicit
allowlist and wildcard origins are rejected. Request limits are controlled
by the `*_LIMIT` and `RATE_LIMIT_WINDOW_MS` variables in `.env.example`.
The limiter uses in-process memory and protects a single backend instance;
it is not shared across multiple instances.

**Note on Prisma 7:** the database URL is read from `prisma.config.ts`
(via `env("DATABASE_URL")`), not from `schema.prisma`. `prisma.config.ts`
loads `.env` itself via `dotenv/config`, so you still only need to edit
one file — `.env`.

## 7. Installation

```bash
npm install
```

## 8. Generate the Prisma client

```bash
npx prisma generate
```

## 9. Run the database migration

```bash
npx prisma migrate dev
```

This creates the `users`, `games`, `conversations`, and `messages` tables
(and the `MessageRole` enum) in your `gaming_agent` database, based on
`prisma/schema.prisma`.

## 10. Seed the database

```bash
npm run prisma:seed
```

This inserts five example games (Dark Souls III, Elden Ring, Minecraft,
The Witcher 3: Wild Hunt, God of War) using `upsert`, so it's safe to run
more than once.

## 11. Run the development server

```bash
npm run dev
```

The API will be available at `http://localhost:5000` (or whatever `PORT`
you set).

## 12. Build & run in production mode

```bash
npm run build
npm start
```

`npm run build` compiles `src/` to `dist/` via `tsc`; `npm start` runs the
compiled output with plain `node`.

## 13. Running tests

```bash
npm test
```

This runs the Jest + Supertest suite (`tests/health.test.ts` and
`tests/games.test.ts`), covering:

- health check returns `200` with `status: ok`
- creating a game
- rejecting an invalid game payload (validation)
- listing games
- retrieving a game by id
- 404 on a nonexistent game id
- 400 on a malformed (non-UUID) game id
- updating a game
- deleting a game (and confirming the follow-up 404)

**Note:** the tests connect to the real PostgreSQL database configured in
`DATABASE_URL`, so run `npx prisma migrate dev` first.

## 14. Swagger documentation

Once the server is running, open:

```text
http://localhost:5000/api/docs
```

This documents the health endpoint, all five game endpoints, request
bodies, responses, and error responses.

## 15. Project structure

```text
src/
├── config/         # env loading, Prisma client singleton, Swagger config
├── controllers/     # thin HTTP layer — parses req, calls services, sends res
├── middleware/       # validate (Zod), 404 handler, centralized error handler
├── routes/           # Express routers + Swagger JSDoc annotations
├── services/         # business logic (e.g. slug-conflict checks, 404 logic)
├── repositories/     # Prisma data access, isolated from business logic
├── types/            # shared API types + Zod schemas per resource
├── app.ts            # builds the Express app (no listen call — testable)
└── server.ts         # starts the HTTP server, graceful shutdown
prisma/
├── schema.prisma     # User, Game, Conversation, Message models
└── seed.ts           # seed script (5 example games)
prisma.config.ts       # Prisma 7 CLI config: DB URL, migrations path, seed command
tests/
├── health.test.ts
└── games.test.ts
```

**Why this structure:** each layer has one responsibility and only talks to
the layer directly below it (`controller → service → repository → Prisma`).
This keeps business logic (e.g. "slug must be unique," "404 if missing")
out of both the HTTP layer and the database layer, so later phases (adding
auth, RAG, agentic tools, etc.) can be added without restructuring existing
code — new services/repositories can be added alongside the existing ones.

## 16. What was tested, and an important environment limitation

All source code was written, statically reviewed, and type-checked
(`npx tsc --noEmit`) in the development sandbox. Fixed during review:

- `tsconfig.json` incorrectly included the `tests/` directory under
  `rootDir`, which broke `tsc` builds — scoped `include` to `src/` only.
- The Zod validation middleware used a `zod` v3 API
  (`AnyZodObject`, `ZodError.errors`) that doesn't exist in the installed
  `zod` v4 — updated to `ZodType` and `ZodError.issues`.
- Route param types (`req.params.id`) needed an explicit `string` cast
  under Express 5 + `@types/express`'s param typing.

**Prisma 7 migration (this update):** Prisma ORM 7 moved the datasource
URL out of `schema.prisma` and requires a `prisma.config.ts` file plus a
driver adapter in the client. Specifically:

- `prisma/schema.prisma` — the `datasource db { ... }` block no longer
  has `url = env("DATABASE_URL")`. In Prisma 7 that URL is deprecated in
  the schema file and must live in `prisma.config.ts` instead.
- `prisma.config.ts` (new file, project root) — defines `schema`,
  `migrations.path`, `migrations.seed`, and `datasource.url` via
  `defineConfig()` from `prisma/config`. This is what `prisma generate`,
  `prisma migrate dev`, and `prisma db seed` now read.
- `package.json` — removed the old `"prisma": { "seed": "..." }` block;
  the seed command now lives in `prisma.config.ts`'s `migrations.seed`.
- `src/config/prisma.ts` and `prisma/seed.ts` — Prisma 7 removed the
  built-in Rust query engine from Prisma Client, so a driver adapter is
  now required to actually connect. Both files now construct a
  `PrismaPg` adapter (from `@prisma/adapter-pg`, using the `pg` driver)
  and pass it via `new PrismaClient({ adapter })`.
- `package.json` dependencies — added `@prisma/adapter-pg` and `pg`
  (runtime), `@types/pg` (dev), and pinned `prisma`/`@prisma/client` to
  the stable `7.10.0` you specified.

This was verified against the exact type definitions shipped in the
installed `prisma@7.10.0` / `@prisma/config@7.10.0` / `@prisma/adapter-pg@7.10.0`
packages (not just blog posts, which reference an interim `engine: "classic"`
config field that turned out not to exist in this release — it was left out
after checking the actual shipped `.d.ts` files). Running
`npx prisma generate` now prints `Loaded Prisma config from prisma.config.ts.`,
confirming the new config file is picked up correctly.

After all of the above, `npx tsc --noEmit` reports **zero errors** in
`src/`, except for expected "no exported member" errors from
`@prisma/client` — those exist only because the Prisma client hasn't been
generated yet, and will disappear as soon as you run `npx prisma generate`.

**Environment limitation:** the sandbox this project was built in only
allows outbound network access to a fixed allowlist of domains (npm,
GitHub, PyPI, crates.io, Ubuntu mirrors, etc.). Prisma's schema engine
(used by `generate` and `migrate` for anything beyond simple client
generation) needs to download a binary from `binaries.prisma.sh`, which is
not on that allowlist, so `npx prisma generate` still fails with a `403
Forbidden` past the "Loaded Prisma config" step in this sandbox — this is
unrelated to the schema/config changes above. As a result:

- `npx prisma generate`, `npx prisma migrate dev`, `npm run prisma:seed`,
  starting the server, hitting the live endpoints, and `npm test` were
  **not** run end-to-end inside the sandbox, and their success is **not**
  independently verified here.
- PostgreSQL itself *was* installed and confirmed running in the sandbox,
  and the `gaming_agent` database was created successfully — only the
  Prisma engine download was blocked.
- Everything else (dependency installation, project structure,
  TypeScript compilation of application code, `prisma.config.ts` syntax
  and type-checking against the real shipped types, and manual code
  review) was verified directly.

On a machine with normal internet access, the setup steps in sections 7–13
above are expected to work as documented. Please run them locally and let me
know if anything doesn't behave as expected so it can be fixed.

## 17. Roadmap

```text
Phase 1  — Backend + PostgreSQL              (complete — this directory)
Phase 2  — React Frontend                    (complete — see ../frontend)
Phase 3  — Gemini Integration                (complete — see ../README.md)
Phase 4  — RAG Pipeline                      (complete — see ../README.md)
Phase 5  — Qdrant Vector Database            (complete — see ../README.md)
Phase 6  — Agentic Architecture
Phase 7  — MCP Tools
Phase 8  — Gaming Data Sources
Phase 9  — Authentication + Memory
Phase 10 — Testing + Security + Deployment
```

Future phases will build directly on this project — the layered
architecture, Prisma schema, and API conventions established here are
meant to be extended, not replaced.
