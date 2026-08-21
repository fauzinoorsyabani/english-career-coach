export const TUTOR_MODES = [
  "general",
  "workplace",
  "interview",
  "it_vocabulary",
] as const;

export type TutorMode = (typeof TUTOR_MODES)[number];
export type PracticeType = "vocabulary" | "grammar" | "rewrite" | "writing";

export const tutorModeLabels: Record<TutorMode, string> = {
  general: "General English",
  workplace: "Workplace English",
  interview: "Interview Practice",
  it_vocabulary: "IT Vocabulary",
};

export const careerScenarios = [
  {
    slug: "daily-stand-up",
    title: "Daily stand-up",
    topic: "Stand-ups",
    description: "Share progress, name a blocker, and make a clear next-step commitment.",
    prompt: "Give a 45-second update about an Information Systems project you are working on.",
    mode: "workplace" as TutorMode,
    accent: "Coral",
  },
  {
    slug: "technical-interview",
    title: "Technical interview",
    topic: "Interviews",
    description: "Introduce your background and explain an information system with confident, direct language.",
    prompt: "Tell me about a system, project, or assignment that demonstrates your strengths.",
    mode: "interview" as TutorMode,
    accent: "Gold",
  },
  {
    slug: "professional-email",
    title: "Professional email",
    topic: "Emails",
    description: "Write an update that is polite, concise, and clear for a stakeholder or teammate.",
    prompt: "Write an email explaining that a project deadline needs one extra day because testing is incomplete.",
    mode: "workplace" as TutorMode,
    accent: "Sky",
  },
  {
    slug: "incident-report",
    title: "Incident report",
    topic: "Incident reports",
    description: "Describe a production issue, its impact, current status, and the next action without blame.",
    prompt: "Give a concise incident update after a customer-facing portal becomes unavailable.",
    mode: "it_vocabulary" as TutorMode,
    accent: "Ink",
  },
  {
    slug: "requirements-gathering",
    title: "Requirements gathering",
    topic: "Requirements gathering",
    description: "Ask useful follow-up questions and restate business needs accurately.",
    prompt: "Open a meeting with a stakeholder who wants a new reporting dashboard but has not defined the requirements.",
    mode: "general" as TutorMode,
    accent: "Moss",
  },
] as const;

export type PracticeFeedback = {
  score: number;
  correction: string;
  explanation: string;
  naturalAlternative: string;
  errorCategories: string[];
  vocabulary: string[];
};

export function tutorSystemPrompt(mode: TutorMode) {
  const modeGuidance: Record<TutorMode, string> = {
    general: "Focus on clear, natural everyday English while keeping explanations practical.",
    workplace: "Focus on concise, professional workplace English for collaboration, meetings, and written updates.",
    interview: "Role-play as a supportive IT interviewer and help the learner express technical experience confidently.",
    it_vocabulary: "Focus on accurate, accessible IT vocabulary and help the learner explain technical ideas to mixed audiences.",
  };

  return `You are English Career Coach, a patient English tutor for Information Systems students and IT professionals. ${modeGuidance[mode]}

Reply in supportive, plain English. Preserve the learner's meaning and do not invent facts about their experience. For every learner message, use these brief markdown headings in this exact order: **Answer**, **Correction**, **Why**, **More natural way to say it**, **Try next**. If the learner's English is already strong, say so and offer a small refinement instead of forcing corrections. Keep the response under 260 words. Do not describe yourself as an official examiner or guarantee career outcomes.`;
}

export function scenarioKickoff(title: string, prompt: string) {
  return `## ${title}\n\nWe will practise this IT communication situation together. I will respond like a supportive colleague or interviewer, then help you improve your English.\n\n**Your first task:** ${prompt}\n\nWrite your first answer when you are ready.`;
}

export function parsePracticeFeedback(value: string): PracticeFeedback {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Practice feedback was not an object");
  const record = parsed as Record<string, unknown>;
  const list = (key: string) =>
    Array.isArray(record[key]) ? record[key].filter(item => typeof item === "string") as string[] : [];
  const string = (key: string) => typeof record[key] === "string" ? record[key] : "";
  const score = typeof record.score === "number" && Number.isFinite(record.score)
    ? Math.max(0, Math.min(100, Math.round(record.score)))
    : -1;

  const feedback = {
    score,
    correction: string("correction"),
    explanation: string("explanation"),
    naturalAlternative: string("naturalAlternative"),
    errorCategories: list("errorCategories"),
    vocabulary: list("vocabulary"),
  };

  if (feedback.score < 0 || !feedback.correction || !feedback.explanation || !feedback.naturalAlternative) {
    throw new Error("Practice feedback did not match the expected shape");
  }
  return feedback;
}

export function calculateStreak(completionDates: Date[], now = new Date()): number {
  const uniqueDays = new Set(completionDates.map(date => date.toISOString().slice(0, 10)));
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let streak = 0;

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!uniqueDays.has(key)) {
      if (streak === 0) cursor.setUTCDate(cursor.getUTCDate() - 1);
      else break;
      const yesterday = cursor.toISOString().slice(0, 10);
      if (!uniqueDays.has(yesterday)) break;
      continue;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export const dailyChallenges = [
  {
    id: "incident-summary",
    eyebrow: "Today’s IT-English challenge",
    title: "Turn an incident into a calm update",
    prompt: "Write two clear sentences explaining that the customer portal is unavailable, the team is investigating, and the next update will be shared in 30 minutes.",
    note: "Use short sentences. Focus on impact, action, and timing.",
  },
  {
    id: "standup-commitment",
    eyebrow: "Today’s IT-English challenge",
    title: "Give a confident stand-up update",
    prompt: "Write a three-sentence stand-up update: what you finished, what you will do next, and one blocker you need help with.",
    note: "Try: ‘Yesterday I… Today I will… I need help with…’",
  },
  {
    id: "requirement-question",
    eyebrow: "Today’s IT-English challenge",
    title: "Ask one useful requirement question",
    prompt: "Write two questions you would ask a stakeholder before building a reporting dashboard for their team.",
    note: "Ask about the user, the decision they need to make, and the data they trust.",
  },
  {
    id: "release-note",
    eyebrow: "Today’s IT-English challenge",
    title: "Write a concise release note",
    prompt: "Write a short release note for a new password-reset flow that improves security and makes the process easier for users.",
    note: "Name the change, explain the benefit, and keep the tone user-focused.",
  },
  {
    id: "interview-example",
    eyebrow: "Today’s IT-English challenge",
    title: "Share an interview-ready example",
    prompt: "In three sentences, describe a time you solved a technical or project problem. Focus on the situation, your action, and the result.",
    note: "Use direct action verbs such as analysed, coordinated, improved, or delivered.",
  },
] as const;

export function challengeDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getDailyChallenge(date = new Date()) {
  const key = challengeDateKey(date);
  const seed = Array.from(key).reduce((total, character) => total + character.charCodeAt(0), 0);
  return { ...dailyChallenges[seed % dailyChallenges.length], date: key };
}

export const supportedAudioMimes = ["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4"] as const;
export type SupportedAudioMime = (typeof supportedAudioMimes)[number];

export function isSupportedAudioMime(mimeType: string): mimeType is SupportedAudioMime {
  return (supportedAudioMimes as readonly string[]).includes(mimeType);
}
