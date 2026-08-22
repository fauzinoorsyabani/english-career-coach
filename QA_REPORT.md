# QA report — English Career Coach

**Assessment scope:** Tutor, Practice, Career, Progress, Settings, daily challenge, flashcard deck, responsive navigation, validation paths, and the published Vercel route setup.

## Summary

The local application passes the automated QA baseline and its core interface flows render correctly at desktop and mobile sizes. One UX defect was identified and corrected during this review: protected routes initially rendered only the cream grid while authentication was resolving. The dashboard layout now presents an accessible, branded loading state instead of an apparently blank page.

## Verified checks

| Area | Result | Evidence |
|---|---|---|
| Type safety | Passed | `pnpm check` completed without TypeScript errors. |
| Unit tests | Passed | Vitest: 3 files and 10 tests passed. |
| Production build | Passed | `pnpm build` completed and produced client, server, and Vercel handler artifacts. |
| Dashboard and daily challenge | Passed | Desktop and mobile render checks showed a visible daily challenge, goal, streak, sessions, and recent activity. |
| Tutor modes and private history UI | Passed | The Tutor route rendered all four required modes and the conversation list/empty state. |
| Practice | Passed | Vocabulary, grammar correction, sentence rewrite, and writing-prompt controls rendered with a response field and feedback action. |
| Career scenarios | Passed | Stand-ups, interviews, emails, incident reports, and requirements gathering cards rendered responsively. |
| Progress and flashcards | Passed | Stat cards, error-pattern state, goal rhythm, and the flashcard empty state rendered correctly. |
| Settings | Passed | English level, target role, focus area chips, daily goal, and save action rendered correctly. |
| Responsive navigation | Passed | The mobile header and five required navigation labels were visible and usable in the responsive review. |
| Auth-loading fallback | Fixed and verified | The former grid-only loading state is replaced by a branded status screen with text and progress affordance. |
| Public Vercel route setup | Passed | The React root and unauthenticated `auth.me` tRPC route responded successfully after the Vercel routing/serverless adapter correction. |

## Defect corrected

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| QA-01 | Medium | During initial auth resolution, protected routes could visually appear blank because `DashboardLayout` returned only the background grid. | Added an accessible branded loading fallback with a progress indicator and screen-reader status text. |

## Remaining test boundary

The user-facing application is functioning locally, but the production Vercel project does not yet contain the required database, OAuth, AI, storage, and transcription credentials. Therefore, end-to-end production testing of sign-in, persisted tutor messages, AI feedback, saved flashcards, daily challenge completion, and voice transcription is intentionally pending. The repository documents the exact activation workflow in `VERCEL_ENVIRONMENT.md` and `ANTIGRAVITY_HANDOFF.md`.

## QA verdict

> **Local feature experience: acceptable for continued development and authenticated testing.**

The visual surfaces and validated server contracts are operating normally. Complete Vercel secret configuration and OAuth redirect authorization before treating the public deployment as a fully operational production service.
