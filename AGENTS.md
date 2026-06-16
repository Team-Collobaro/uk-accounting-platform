# AGENTS.md

Guidance for AI agents (and humans) working in this repository. Read this before making non-trivial changes.

## Project overview

**UK Accounting Pro** — a Next.js 14 web app delivering a 150-hour UK bookkeeping, accounting, and taxation course with an AI tutor ("Alex"), RAG-grounded answers, adaptive quizzes, and a publicly verifiable certificate.

Key user surfaces:
- Public marketing site + auth (`/`, `/login`, `/register`).
- Student dashboard + course reader (`/dashboard`, `/course/...`) under `app/(dashboard)`.
- Employer team-management dashboard under `app/(employer)`.
- Public certificate verification at `/verify/[code]`.
- Server APIs under `app/api/*` (chat, quiz, progress, notes, tts, heygen-token, etc.).

## Tech stack

- **Framework**: Next.js 14.2.16, App Router, React 18, TypeScript (`strict: true`).
- **Styling**: Tailwind CSS 3 + shadcn/ui (new-york style, neutral base, CSS variables). Path alias `@/*` → repo root.
- **Auth + DB**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`). RLS is enabled on every table; `lib/supabase-server.ts` exposes a lazy admin client (service role) for trusted server code.
- **AI**: Anthropic SDK (Claude — `claude-haiku-4-5-20251001` by default, see `lib/ai/client.ts`).
- **Embeddings**: OpenAI `text-embedding-3-small` (`lib/embeddings.ts`, `lib/retrieval.ts`).
- **TTS (optional)**: ElevenLabs; app falls back to browser speech synthesis if missing (`app/api/tts`).
- **Avatar (optional)**: HeyGen streaming avatar (`@heygen/streaming-avatar`).
- **Animation / 3D**: Framer Motion, GSAP, Three.js, OGL.

## Directory layout

```
app/                       Next.js App Router
  (auth)/                  login, register (route group)
  (dashboard)/             dashboard + course reader
  (employer)/              employer team dashboard
  api/                     server route handlers (chat, quiz, progress, ...)
  verify/                  public certificate verification
  layout.tsx               root layout; mounts <ContentProtection />
components/
  ui/                      shadcn primitives (do not hand-edit shapes)
  *.tsx, *.jsx, *.css      bespoke visual components (AuroraRingAvatar,
                           LiquidEther, MagicBento, Orb, ShapeBlur,
                           SoftAurora, WatchSpinner, AvatarOrb,
                           ContentProtection)
features/
  course/                  course-reader feature (content, hooks)
  dashboard/               dashboard widgets, constants, types
lib/
  ai/                      Anthropic client + tutor/quiz/progress logic
  supabase.ts              browser client (RLS-respecting)
  supabase-server.ts       server + admin (service-role) clients + typed helpers
  certificate.ts, costTracker.ts, courseHtml.ts, courseParser.ts
  embeddings.ts, retrieval.ts, utils.ts
types/                     shared TS types (Student, Module, ChatMessage, ...)
constants/                 static course/curriculum constants
scripts/
  indexCourse.ts           parses + indexes the HTML course into course_chunks
  createSchema.sql         idempotent full schema (drops + recreates)
  run_migration.js         diagnostic — checks if `section_id` column exists
middleware.ts              Supabase session refresh + auth gate
tsconfig.scripts.json      separate, non-strict, CommonJS TS config for scripts
                           (npm run index uses this; the app itself uses
                           tsconfig.json with strict + bundler resolution)
```

## Setup

```bash
cp .env.example .env.local   # fill in real keys
npm install
npm run dev                  # http://localhost:3000
```

Required env (see `.env.example`):
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (embeddings)
- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` (optional — graceful fallback exists)
- `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_SECRET`
- `CLAUDE_MODEL`, `CLAUDE_MAX_TOKENS`, `EMBEDDING_MODEL` (optional overrides)

## Scripts

- `npm run dev` — Next dev server.
- `npm run build` / `npm start` — production.
- `npm run lint` — `next lint` (ESLint, `eslint-config-next`). Run after non-trivial edits.
- `npm run index` — `scripts/indexCourse.ts`; chunks `UK_Master_Course 3.html` and upserts into `course_chunks`. Runs through `tsconfig.scripts.json` (CommonJS, non-strict) and loads `.env.local` via `dotenv` on line 9.
- `node scripts/run_migration.js` — diagnostic only; prints whether the `course_chunks.section_id` column is present (the script is a leftover from an early migration, not a migrator itself).

There is **no test framework configured** — do not invent one. If you need to verify a change, use `npm run lint`, `tsc --noEmit` (the project uses incremental builds via `tsconfig.tsbuildinfo`), and `npm run dev` to exercise the route manually.

## Database

Schema lives in `scripts/createSchema.sql` (Postgres, runs in Supabase SQL Editor). Tables:

`students`, `course_chunks`, `tutor_sessions`, `quiz_results`, `module_progress`, `section_progress`, `certificates`, `employers`, `token_usage`.

Conventions:
- Student-facing reads use the cookie-aware server client (`createServerSupabaseClient`) so RLS applies.
- Admin writes (e.g. creating a missing `students` row, indexing, certificate issuance) use the `supabaseAdmin` proxy in `lib/supabase-server.ts`. Treat any code path using it as trusted — never expose it to the client.
- `course_chunks` is the RAG corpus: `content_tsv` is a generated `tsvector` with a GIN index, plus btree indexes on `module_id` and `(module_id, section_id, section_order)`.
- The `(dashboard)` and `(employer)` route groups are auth-gated by `middleware.ts`; public paths are listed there.

## AI / RAG behaviour

- The tutor uses the **Socratic method** — ask, don't lecture. Prompts live in `lib/ai/tutor.ts` (phase machine: `PRE_NOTES → EXPLAIN → CONFIRM → POST_NOTES → CHECK → WRAP`).
- `lib/retrieval.ts` does hybrid retrieval (semantic via OpenAI embeddings + lexical via `tsvector`); the system prompt in `tutor.ts` requires grounded answers — do not weaken the "use only the provided context" rules.
- Token usage is tracked per session and aggregated on `students.total_tokens_used` (`lib/supabase-server.ts:trackTokenUsage`). The cost formula `(input/1e6)*1.0 + (output/1e6)*5.0` is duplicated in **two** places — `lib/costTracker.ts:4-5` (constants) and `lib/supabase-server.ts:316-317` (hardcoded inside `trackTokenUsage`) — update both, plus any matching prompt comments, if the model changes.
- `lib/ai/client.ts` reads `CLAUDE_MODEL` and `CLAUDE_MAX_TOKENS` at module load; restart the dev server after changing env.

## Conventions

- **TypeScript strict**. Don't add `any` — use `unknown` + narrowing. The few existing `any` usages in `lib/supabase-server.ts` carry `eslint-disable` comments for a reason; do not copy that pattern without one.
- **Documentation first**: For Next.js, React, Supabase, Anthropic, OpenAI, Tailwind, shadcn/ui, and other external dependencies, consult the latest official documentation before implementing non-trivial changes. Do not rely solely on model knowledge.
- **shadcn/ui** lives in `components/ui/`. Add new primitives via the shadcn CLI (`.mcp.json` already wires `shadcn@latest mcp`); don't hand-roll replacements.
- **Path alias**: import via `@/...` (e.g. `@/lib/supabase`, `@/types`).
- **Styling**: prefer Tailwind utilities + `cn()` from `lib/utils.ts`. Page-level bespoke visual code (e.g. `app/page.tsx`) uses inline styles — that's intentional for those marketing surfaces; do not refactor them into Tailwind classes without being asked.
- **Dark mode only**: root `<html>` is forced to `className="dark"` in `app/layout.tsx`. Don't add a light theme.
- **No comments in code** unless the surrounding file already uses them and they're necessary. The repo favours self-documenting code.
- **No secrets in code or commits**. `.env*.local` is git-ignored. API keys belong only in env vars and Supabase/Vercel project settings.


## Things to be careful about

- **`supabaseAdmin` is service-role** — it bypasses RLS. Never import it from a client component or any file that might end up in a client bundle. All current usages are server-only.
- **Dependency changes**: Framework APIs evolve frequently. Before modifying framework-specific code, verify current APIs and recommended patterns against the latest official documentation.
- **supabase**: use it only for persistent server-backed data. Do not store cached quizzes or chat conversations in Supabase; keep those in localStorage for client-side caching.
- **Middleware matcher** (`middleware.ts:56`) excludes `_next/static`, `_next/image`, `favicon.ico`, and common image extensions. If you add a new top-level public asset path, update both the matcher and the `isPublic` list.
- **`scripts/createSchema.sql` is destructive** (`drop table ... cascade`). It is meant for fresh setups or full resets in dev — never run it against a database with real student data.
- **`indexCourse.ts` reads the HTML by path** (`UK_Master_Course 3.html` in repo root). Don't move/rename it without updating the script.
- **Server Actions allow-list** in `next.config.js` only includes `localhost:3000`. Add production origins before deploying.
- **Content protection**: `ContentProtection` is mounted globally in `app/layout.tsx`; don't bypass it for new pages.
- **RAG freshness**: course content is baked into embeddings at index time. After editing `UK_Master_Course 3.html`, re-run `npm run index`.
- **Husky/hooks**: no pre-commit hooks are configured; rely on `npm run lint` and CI.
- **Committing**: only commit when the user explicitly asks. Inspect `git status` / `git diff` first; never include `.env*.local` or `tsconfig.tsbuildinfo`.


## Quick reference

- Add a new API route: create `app/api/<name>/route.ts` exporting `GET`/`POST` handlers. Public routes that must skip auth go in the `isPublic` list in `middleware.ts:36`.
- Add a new shadcn primitive: use the shadcn MCP/CLI; it respects `components.json`.
- Add a new dashboard widget: drop it under `features/dashboard/` and import from `(dashboard)/dashboard/...`.
- Add a new student-facing table: extend `scripts/createSchema.sql` (idempotent) and any matching typed helpers in `lib/supabase-server.ts` and `types/`.

## Agent workflow

Before making non-trivial changes:

1. Read this AGENTS.md.
2. Inspect the relevant files before editing.
3. Consult the latest official documentation for affected frameworks, libraries, SDKs, or APIs.
4. Reuse existing project patterns where possible.
5. Make the smallest change necessary to satisfy the request.
6. Run `npm run lint`.
7. Run `tsc --noEmit` if types may be affected.
8. Manually verify affected routes when practical.