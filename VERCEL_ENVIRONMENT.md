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

Do not commit real values to GitHub. In Vercel, add values through **Project Settings → Environment Variables**, then redeploy `main`. The generated Vercel function intentionally reads these values only at runtime.
