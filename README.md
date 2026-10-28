# English Career Coach

A full-stack English-learning workspace for Information Systems students and IT professionals. It combines an AI-style tutor, focused practice, career role-plays, progress tracking, vocabulary flashcards, and a daily IT-English challenge in one responsive study workspace.

The project is designed to run in two ways:

- **Local demo mode** — no external services required. A demo account, a local JSON data store, and an offline rule-based coach are built in.
- **Connected mode** — use a real MySQL-compatible database and any OpenAI-compatible chat provider (or the original Manus Forge services) for live AI feedback.

## Features

| Area | What it does |
|---|---|
| Tutor | Four modes: General English, Workplace English, Interview Practice, IT Vocabulary. Private conversation history and a save-to-flashcard action. |
| Practice | Vocabulary, grammar correction, sentence rewriting, and writing prompts with structured feedback and a 0–100 score. |
| Career | Guided role-plays for stand-ups, technical interviews, professional emails, incident reports, and requirements gathering. Optional recorded voice input. |
| Progress | Daily goal, streak, completed sessions, vocabulary count, error patterns, and recent activity. |
| Flashcards | A private IT-vocabulary deck with review tracking. |
| Daily challenge | One rotating IT-English challenge per day with idempotent completion and streak integration. |
| Settings | English level, target IT role, focus areas, and daily practice goal, persisted per learner. |

## Tech stack

- **Client:** React 19, Vite 7, Tailwind CSS 4, Wouter, shadcn/ui, Recharts
- **Server:** Express 4, tRPC 11, Zod
- **Data:** Drizzle ORM with MySQL (`mysql2`), plus a local JSON store for demo mode
- **Tests:** Vitest
- **Deployment:** Vercel static client + serverless Express/tRPC handler

## Quick start

Requirements: Node.js 22 or newer and pnpm.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open the URL printed by the server (usually <http://localhost:3000>, or the next free port if 3000 is occupied), then select **Enter the local demo**.

The default `.env` enables:

```env
LOCAL_AUTH=true
LOCAL_DATA=true
VITE_LOCAL_AUTH=true
JWT_SECRET=english-career-coach-local-development-secret
```

Local data is written to `.data/local-db.json` and is ignored by Git. Delete that file to reset the demo workspace.

## Real AI feedback

The offline coach uses practical grammar rules and IT-vocabulary templates, so it works without a network connection. For richer tutoring, point the server at any OpenAI-compatible chat endpoint:

```env
LLM_API_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-key
LLM_MODEL=gpt-4o-mini
```

Restart `pnpm dev` after changing environment values. The managed Manus Forge endpoint still works when `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are set.

Voice role-play transcription uses the same OpenAI-compatible provider (`/audio/transcriptions`, default model `whisper-1`). Without a provider key, the voice control shows a clear fallback asking the learner to type their response.

## MySQL instead of the local JSON store

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/english_career_coach
```

Remove `LOCAL_DATA=true` (or set it to `false`), then apply the tracked Drizzle migrations:

```bash
pnpm exec drizzle-kit migrate
```

Every learning record is scoped by `userId`: profiles, conversations, messages, practice attempts, scenario completions, flashcards, and challenge completions.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the full app with Vite HMR |
| `pnpm check` | TypeScript verification |
| `pnpm test` | Vitest suite |
| `pnpm build` | Production client, server, and Vercel handler bundles |
| `pnpm start` | Run the production server after a build |
| `pnpm db:push` | Generate and apply Drizzle migrations |

The server exposes `GET /api/health` for a quick readiness check, for example `curl http://localhost:3000/api/health`.

`pnpm start` uses the compiled client. Keep `VITE_LOCAL_AUTH=true` in `.env` during `pnpm build` if you want local demo sign-in in that build.

## Deployment

The repository includes `vercel.json`, `api/vercel-entry.ts`, and a serverless Express/tRPC adapter. For a fully connected deployment, add the environment values listed in [`VERCEL_ENVIRONMENT.md`](VERCEL_ENVIRONMENT.md) to Vercel, authorize the OAuth callback URL, and redeploy.

Without OAuth, database, and AI credentials, the public deployment can still serve the interface, but authenticated persistence and live AI feedback remain disabled. Local demo mode is intentionally not enabled on production deployments unless `LOCAL_AUTH=true` is set explicitly.

## Project structure

```text
api/                 Vercel serverless entry point and generated handler
client/              React application, pages, components, hooks
drizzle/             Schema, relations, migrations, snapshots
server/              Express/tRPC app, routers, data access, local store
shared/              Shared constants and types
verification-notes.md Visual QA notes
QA_REPORT.md         QA findings and verification boundary
```

## Documentation

- [`VERCEL_ENVIRONMENT.md`](VERCEL_ENVIRONMENT.md) — production environment variables
- [`ANTIGRAVITY_HANDOFF.md`](ANTIGRAVITY_HANDOFF.md) — IDE handoff and integration replacement notes
- [`QA_REPORT.md`](QA_REPORT.md) — automated and visual QA results

## License

MIT
