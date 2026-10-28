# Visual Verification Notes

The dashboard, tutor, practice, progress, and settings routes rendered with the intended warm editorial study-lab design at desktop width. The design system is consistent across the tested pages, with readable cream/navy/coral contrast, clear hierarchy, and responsive-ready navigation.

The career route initially reached the data request after the capture had already occurred. The page now renders the curated scenario cards immediately while user-specific completion status refreshes in the background. The revised desktop capture confirmed all five required cards: stand-ups, interviews, emails, incident reports, and requirements gathering.

The final mobile review covered the dashboard, tutor, practice, career, progress, and settings routes at 375px wide. All core layouts stacked cleanly, the bottom navigation remained visible and legible, the tutor and practice composer areas stayed usable, and long career-scenario content remained readable without horizontal overflow.

The extension review confirmed that the daily IT-English challenge appears between dashboard metrics and quick actions, with a compact prompt, study note, response field, and completion action. The private flashcard deck has a clear empty state in the progress view and remains readable at the mobile breakpoint. The voice control is intentionally shown only after a learner begins a career role-play, preventing general chat recordings from being stored or transcribed as role-play responses.

An active role-play microphone check was attempted through the sandbox browser. The protected preview redirected to the learner’s Google sign-in page before a scenario could be opened, so no personal account or microphone was used. Static validation, protected procedure tests, and the typed-response fallback were verified; the deployed role-play flow remains ready for an authenticated learner to grant microphone permission in their browser.

## Local-first verification

The self-contained demo mode was verified in a real headless Chrome session against the development server. Demo sign-in persisted a session cookie, the dashboard rendered “Welcome back, Alex,” and the Tutor, Practice, Career, Progress, and Settings routes all rendered without the error boundary. The browser console log contained no application errors or failed tRPC requests.

The complete learning flow was also exercised through the API: profile update, tutor chat, practice submission with structured feedback, flashcard save/list, daily challenge completion, career scenario start/completion, and progress overview. The same flow was repeated against the production build served by `pnpm start`, confirming that the local JSON store, demo auth, and offline coach work in both development and production modes.

Voice transcription remains provider-dependent. Without an AI/Forge key the UI returns a clear typed-response fallback; with an OpenAI-compatible key, stored audio is sent to the provider’s transcription endpoint.
