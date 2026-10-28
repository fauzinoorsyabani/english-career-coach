# English Career Coach

A full-stack English-learning workspace for Information Systems students and IT professionals. It combines an AI-style tutor, focused practice, career role-plays, progress tracking, vocabulary flashcards, and a daily IT-English challenge in one responsive study workspace.

The project is designed to run in two ways:

- **Local mode** — no external services required. Email/password accounts, a demo account, a local JSON (or Redis) data store, and an offline rule-based coach are built in.
- **Connected mode** — use a real MySQL-compatible database and any OpenAI-compatible chat provider (or the original Manus Forge services) for live AI feedback. OAuth is available for single sign-on deployments.

## Features

| Area | What it does |
|---|---|
| Tutor | Four modes: General English, Workplace English, Interview Practice, IT Vocabulary. Private conversation history and a save-to-flashcard action. |
| Practice | Vocabulary, grammar correction, sentence rewriting, and writing prompts with structured feedback and a 0–100 score. |
| Career | Guided role-plays for stand-ups, technical interviews, professional emails, incident reports, and requirements gathering. Optional recorded voice input. |
| Progress | Daily goal, streak, completed sessions, vocabulary count, error patterns, and recent activity. |
| Flashcards | A private IT-vocabulary deck with review tracking. |
| Daily challenge | One rotating IT-English challenge per day with idempotent completion and streak integration. |
| Accounts | Email/password registration and sign-in, plus an optional one-click demo account. The first registered non-demo account becomes the administrator. |
| Sessions | 30-day JWT sessions tracked server-side. List devices, sign out one device, sign out every other device, and revoke sessions on password change or account disable. |
| Settings | English level, target IT role, focus areas, and daily practice goal, plus account details, password, active sessions, and account deletion. |
| Admin | `/admin/users` lists accounts, changes roles, activates or disables access, and revokes sessions. Passwords and private learning data are never exposed. |

## Tech stack

- **Client:** React 19, Vite 7, Tailwind CSS 4, Wouter, shadcn/ui, Recharts
- **Server:** Express 4, tRPC 11, Zod
- **Data:** Drizzle ORM with MySQL (`mysql2`), plus a local JSON store or Upstash Redis for local/serverless mode
- **Auth:** scrypt password hashing, JWT session cookies, server-side session records
- **Tests:** Vitest
- **Deployment:** Vercel static client + serverless Express/tRPC handler

## Quick start

Requirements: Node.js 22 or newer and pnpm.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open the URL printed by the server (usually <http://localhost:3000>, or the next free port if 3000 is occupied). You will land on `/login`, where you can create an account or select **Enter the local demo**.

The first non-demo account you register becomes the administrator, so it can open `/admin/users`. Later accounts start as regular users with a clean learning history; demo progress stays with the demo account and never mixes with a registered account.

The default `.env` enables:

```env
LOCAL_AUTH=true
LOCAL_DATA=true
VITE_LOCAL_AUTH=true
JWT_SECRET=english-career-coach-local-development-secret
```

Local data is written to `.data/local-db.json` and is ignored by Git. Delete that file to reset the local workspace.

## Accounts and sessions

| Behavior | Detail |
|---|---|
| Registration | Open registration on `/login`. Emails are normalized to lowercase and must be unique. |
| Password policy | 8–128 characters, at least one letter and one number, common passwords rejected. |
| Password storage | Node `scrypt` with a random salt per password. Hashes never cross the API boundary. |
| Sign-in protection | 12 failed attempts per 15 minutes for each IP and action (sign-in or registration). |
| Session lifetime | 30 days. Each session has a server-side record and a JWT `sid`, so revocation takes effect immediately. |
| Device list | Settings → Active sessions shows the current device, last activity, and IP address. |
| Revocation | Sign out one device, sign out all other devices, or change the password. Disabling an account revokes every session. |
| Account deletion | Settings → Danger Zone requires the current password and the exact word `DELETE`. The last active administrator cannot delete their account. |

Password reset and email verification are deliberately not implemented yet: both need a transactional email provider, and the app does not pretend to send mail it cannot deliver.

### Auth modes

| Mode | How it is enabled | What the login page shows |
|---|---|---|
| Local accounts + demo | `LOCAL_AUTH=true`, or development without OAuth credentials | Email/password form, demo button, and OAuth when configured |
| OAuth only | Production OAuth credentials without `LOCAL_AUTH` | Single sign-on only |
| Demo only | `LOCAL_AUTH=true` and `PASSWORD_AUTH=false` | Demo button only |

Production password sign-in requires the explicit `LOCAL_AUTH=true` opt-in. `OWNER_OPEN_ID` still grants the administrator role to the matching OAuth identity in connected mode.

### Admin panel

Administrators can open `/admin/users` from the sidebar to search and filter accounts, promote or demote users, activate or disable accounts, and sign a user out of every device. Guardrails are enforced by the server:

- An administrator cannot change their own role or status.
- The demo account cannot be moderated or signed out by an administrator.
- At least one active administrator must remain.
- Passwords, password hashes, and private learning records are never returned by admin endpoints.

## Real AI feedback

The offline coach uses practical grammar rules and IT-vocabulary templates, so it works without a network connection. For richer tutoring, point the server at any OpenAI-compatible chat endpoint:

```env
LLM_API_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-key
LLM_MODEL=gpt-4o-mini
```

Restart `pnpm dev` after changing environment values. The managed Manus Forge endpoint still works when `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are set.

Voice role-play transcription uses the same OpenAI-compatible provider (`/audio/transcriptions`, default model `whisper-1`). Without a provider key, the voice control shows a clear fallback asking the learner to type their response.

## Local data storage

Without `DATABASE_URL`, the app uses a local store. In development and tests it writes a single JSON document to `.data/local-db.json` (override with `LOCAL_DATA_FILE`). Set `LOCAL_DATA=file` to force this mode or `LOCAL_DATA=redis` to force Redis.

For a serverless deployment without MySQL, attach an Upstash Redis database and set:

```env
KV_REST_API_URL=https://your-database.upstash.io
KV_REST_API_TOKEN=your-token
LOCAL_DATA_REDIS_PREFIX=english-career-coach:production
```

Redis is used automatically in production when both values are present. Writes take a short-lived distributed lock so concurrent serverless instances cannot overwrite each other. `LOCAL_DATA_REDIS_PREFIX` is optional; the default includes `VERCEL_ENV` to keep environments separate.

## MySQL instead of the local JSON store

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/english_career_coach
```

Remove `LOCAL_DATA=true` (or set it to `false`), then apply the tracked Drizzle migrations:

```bash
pnpm db:push
```

The auth migration (`drizzle/0003_auth_sessions.sql`) adds `users.passwordHash`, `users.status`, and the `user_sessions` table with indexes on the user, last-seen time, and expiry. `pnpm db:push` runs `drizzle-kit generate` followed by `drizzle-kit migrate`.

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

The server exposes `GET /api/health` for a quick readiness check, for example `curl http://localhost:3000/api/health`. It reports whether email/password auth, demo auth, and file/Redis storage are active.

`pnpm start` uses the compiled client. Keep `VITE_LOCAL_AUTH=true` in `.env` during `pnpm build` if you want the local account and demo UI in that build.

## Deployment

The repository includes `vercel.json`, `api/vercel-entry.ts`, and a serverless Express/tRPC adapter. For a fully connected deployment, add the environment values listed in [`VERCEL_ENVIRONMENT.md`](VERCEL_ENVIRONMENT.md) to Vercel, authorize the OAuth callback URL, and redeploy.

Without OAuth, database, Redis, and AI credentials, the public deployment can still serve the interface, but sign-in and authenticated persistence remain disabled. Local accounts and demo sign-in are intentionally not enabled on production deployments unless `LOCAL_AUTH=true` is set explicitly; when they are, use MySQL or Upstash Redis so sessions and learning data survive cold starts.

## Project structure

```text
api/                 Vercel serverless entry point and generated handler
client/              React application, pages, components, hooks
drizzle/             Schema, relations, migrations, snapshots
server/              Express/tRPC app, routers, auth, data access, local store
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
