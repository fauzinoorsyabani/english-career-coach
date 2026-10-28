# Antigravity IDE handoff

This repository is ready to continue in Antigravity IDE. The public source is available at [fauzinoorsyabani/english-career-coach](https://github.com/fauzinoorsyabani/english-career-coach).

## What is already implemented

The product is a full-stack English-learning workspace for IT professionals. It includes an authenticated dashboard, AI tutor modes, private tutor history, scored practice, career role-plays, progress tracking, learner settings, vocabulary flashcards, voice-to-text role-play input, and a daily IT-English challenge.

The current stack is shown below.

| Area | Implementation |
|---|---|
| Client | React 19, Vite, Tailwind CSS 4, Wouter, shadcn/ui, Recharts |
| Server | Express 4 and tRPC 11 |
| Database access | Drizzle ORM with `mysql2` |
| Database dialect | MySQL/TiDB-compatible |
| Schema | `drizzle/schema.ts` |
| API routers | `server/routers.ts` |
| User-scoped data helpers | `server/db.ts` |
| Unit tests | Vitest under `server/*.test.ts` |
| Production adapter | `api/[...path].ts` and `vercel.json` |

## Local setup in Antigravity IDE

Clone the repository, install Node.js 22 or later, and use pnpm.

```bash
git clone https://github.com/fauzinoorsyabani/english-career-coach.git
cd english-career-coach
pnpm install
cp .env.example .env
pnpm dev
```

The checked-in `.env.example` starts the app in **local demo mode**:

```env
LOCAL_AUTH=true
LOCAL_DATA=true
VITE_LOCAL_AUTH=true
JWT_SECRET=english-career-coach-local-development-secret
```

Open the printed URL (usually <http://localhost:3000>, or the next free port) and select **Enter the local demo**. No external account is required. The demo user is `Alex Morgan`; learning data is stored in `.data/local-db.json`, which is ignored by Git. Delete that file to reset the workspace.

The built-in offline coach provides rule-based tutor replies and practice feedback when no AI provider is configured. For richer feedback, add any OpenAI-compatible provider:

```env
LLM_API_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-key
LLM_MODEL=gpt-4o-mini
```

### Connected mode

To use a real database instead of the local JSON store, set a MySQL-compatible `DATABASE_URL` and remove `LOCAL_DATA=true`. The original integration can also use Manus OAuth and Manus Forge services for AI tutoring, S3-backed audio storage, and transcription. Those values are platform credentials and are not included in the repository; replace them with the providers you prefer. See `VERCEL_ENVIRONMENT.md` for the full variable list.

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/english_career_coach
JWT_SECRET=replace-with-a-long-random-value
```

## Database workflow

The data model is already designed for user ownership. Every learning record carries a `userId`, including conversations, tutor messages, practice attempts, scenario completions, vocabulary flashcards, and daily challenge completions.

Apply the tracked migrations to a new MySQL/TiDB-compatible database:

```bash
pnpm drizzle-kit migrate
```

When you change `drizzle/schema.ts`, create a migration, review the generated SQL under `drizzle/`, and apply it before using the new fields:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

| Table | Responsibility |
|---|---|
| `users` | OAuth-linked user account and role |
| `learner_profiles` | English level, target role, focus areas, and daily goal |
| `tutor_conversations` / `tutor_messages` | Private tutor history and IT role-play chat |
| `practice_attempts` | Prompt, answer, structured feedback, and score |
| `scenario_completions` | One completion record per user and career scenario |
| `vocabulary_flashcards` | Personal saved IT vocabulary and review state |
| `daily_challenge_completions` | Idempotent daily challenge responses used by streak calculations |

## Development commands

```bash
pnpm dev      # start the full local application
pnpm check    # TypeScript verification
pnpm test     # unit tests
pnpm build    # Vite client + server + Vercel handler build
```

## Replacing managed integrations

For a fully portable implementation, the current integration points can be replaced without changing the learning data model or UI flows.

| Current capability | Current location | External replacement options |
|---|---|---|
| Authentication | `server/_core/oauth.ts`, `client/src/_core/hooks/useAuth.ts` | Auth.js, Clerk, Supabase Auth, Lucia, or a custom JWT session flow |
| AI tutor and practice feedback | `server/_core/llm.ts`, `server/routers.ts` | OpenAI, Anthropic, Google Gemini, or a self-hosted LLM endpoint |
| Audio storage | `server/storage.ts` | Amazon S3, Cloudflare R2, Supabase Storage, or Vercel Blob |
| Voice transcription | `server/_core/voiceTranscription.ts` | OpenAI Whisper, Deepgram, AssemblyAI, or Google Speech-to-Text |
| MySQL/TiDB database | `server/db.ts`, `drizzle/schema.ts` | PlanetScale, Neon MySQL, Railway MySQL, AWS RDS, or self-hosted MySQL |

Keep server-side secret keys on the backend only. Browser-visible `VITE_*` values are compiled into the client build and should never contain a privileged API token.

## Vercel status and paused activation

The Vercel project is publicly deployed at [english-career-coach.vercel.app](https://english-career-coach.vercel.app). The public React application and tRPC endpoint have been checked successfully. The deployment includes Vite static output, a Vercel serverless Express/tRPC handler, and API routing configuration.

The authentication, database, AI tutor, S3 storage, and transcription services are **paused** on Vercel until the project owner adds valid runtime environment values and authorizes this callback URL in the OAuth provider:

```text
https://english-career-coach.vercel.app/api/oauth/callback
```

After adding the variables in `VERCEL_ENVIRONMENT.md`, redeploy `main` in Vercel and validate one authenticated request such as the Tutor, Practice, or Progress page.

## Recommended next development sequence

Begin by selecting a portable authentication, database, and AI provider. Next, map the existing values in `server/_core/env.ts` to your provider-specific environment variables and keep the `tRPC` procedure contracts stable. Then test private data access with two different accounts so conversations, flashcards, scores, and daily challenges cannot cross user boundaries. Finally, configure production secrets, OAuth callback URLs, and voice microphone permission handling before inviting end users.
