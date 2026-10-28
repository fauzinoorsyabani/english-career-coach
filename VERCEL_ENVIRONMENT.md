# Vercel runtime configuration

The public Vercel build serves the React client from `dist/public` and exposes the existing Express/tRPC backend through a Vercel Function. To turn on authenticated learner data, AI tutoring, private audio storage, and voice transcription in Vercel, add the following project environment variables for **Production**, **Preview**, and **Development**.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB database connection used for user-scoped profiles, conversations, practice, flashcards, progress, and challenges. |
| `JWT_SECRET` | Secure cookie signing secret. |
| `VITE_APP_ID` | Manus OAuth application identifier. |
| `OAUTH_SERVER_URL` | Manus OAuth server base URL. |
| `OWNER_OPEN_ID` | Project-owner identity used for the admin role. |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API base URL used by AI, storage, and transcription services. |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge server-side bearer token. |
| `VITE_OAUTH_PORTAL_URL` | Client login portal URL. |
| `VITE_FRONTEND_FORGE_API_URL` | Client Forge API base URL, if client-side Forge features are enabled. |
| `VITE_FRONTEND_FORGE_API_KEY` | Client Forge token, if client-side Forge features are enabled. |
| `LLM_API_URL` | Optional OpenAI-compatible base URL (for example `https://api.openai.com/v1`). Takes priority over Forge for chat and transcription. |
| `LLM_API_KEY` | Optional OpenAI-compatible API key. When omitted, the server uses the offline rule-based coach. |
| `LLM_MODEL` | Optional chat model name for the OpenAI-compatible provider. |
| `TRANSCRIPTION_MODEL` | Optional transcription model name, default `whisper-1`. |

Do not commit real values to GitHub. In Vercel, add values through **Project Settings → Environment Variables**, then redeploy `main`. The generated Vercel function intentionally reads these values only at runtime.

Do **not** set `LOCAL_AUTH=true`, `LOCAL_DATA=true`, or `VITE_LOCAL_AUTH=true` in a production Vercel project. Those flags are for local demos only: they use a shared demo account and a non-durable JSON file. Production persistence requires `DATABASE_URL`, and production identity requires real OAuth configuration.
