// server/_core/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state2) => {
  let decoded;
  try {
    decoded = atob(state2);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/db.ts
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid as nanoid2 } from "nanoid";

// drizzle/schema.ts
import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
  text
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var learnerProfiles = mysqlTable(
  "learner_profiles",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    englishLevel: varchar("englishLevel", { length: 32 }).default("Intermediate").notNull(),
    targetRole: varchar("targetRole", { length: 120 }).default("Information Systems Professional").notNull(),
    focusAreas: json("focusAreas").$type().notNull(),
    dailyGoal: int("dailyGoal").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => ({ userUnique: uniqueIndex("learner_profile_user_idx").on(table.userId) })
);
var tutorConversations = mysqlTable(
  "tutor_conversations",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    mode: mysqlEnum("mode", ["general", "workplace", "interview", "it_vocabulary"]).notNull(),
    scenarioSlug: varchar("scenarioSlug", { length: 80 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => ({ userUpdated: index("conversation_user_updated_idx").on(table.userId, table.updatedAt) })
);
var tutorMessages = mysqlTable(
  "tutor_messages",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    conversationId: varchar("conversationId", { length: 24 }).notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({ conversationUser: index("message_conversation_user_idx").on(table.conversationId, table.userId) })
);
var practiceAttempts = mysqlTable(
  "practice_attempts",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    activityType: mysqlEnum("activityType", ["vocabulary", "grammar", "rewrite", "writing"]).notNull(),
    prompt: text("prompt").notNull(),
    response: text("response").notNull(),
    score: int("score").notNull(),
    feedback: json("feedback").$type().notNull(),
    completedAt: timestamp("completedAt").defaultNow().notNull()
  },
  (table) => ({ userCompleted: index("attempt_user_completed_idx").on(table.userId, table.completedAt) })
);
var scenarioCompletions = mysqlTable(
  "scenario_completions",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    scenarioSlug: varchar("scenarioSlug", { length: 80 }).notNull(),
    conversationId: varchar("conversationId", { length: 24 }),
    completedAt: timestamp("completedAt").defaultNow().notNull()
  },
  (table) => ({ userScenario: uniqueIndex("completion_user_scenario_idx").on(table.userId, table.scenarioSlug) })
);
var vocabularyFlashcards = mysqlTable(
  "vocabulary_flashcards",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    term: varchar("term", { length: 100 }).notNull(),
    definition: text("definition").notNull(),
    example: text("example").notNull(),
    sourceConversationId: varchar("sourceConversationId", { length: 24 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt")
  },
  (table) => ({
    userTerm: uniqueIndex("flashcard_user_term_idx").on(table.userId, table.term),
    userCreated: index("flashcard_user_created_idx").on(table.userId, table.createdAt)
  })
);
var dailyChallengeCompletions = mysqlTable(
  "daily_challenge_completions",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    challengeDate: varchar("challengeDate", { length: 10 }).notNull(),
    challengeId: varchar("challengeId", { length: 64 }).notNull(),
    response: text("response").notNull(),
    completedAt: timestamp("completedAt").defaultNow().notNull()
  },
  (table) => ({ userDate: uniqueIndex("challenge_user_date_idx").on(table.userId, table.challengeDate) })
);

// server/learning.ts
var TUTOR_MODES = [
  "general",
  "workplace",
  "interview",
  "it_vocabulary"
];
var tutorModeLabels = {
  general: "General English",
  workplace: "Workplace English",
  interview: "Interview Practice",
  it_vocabulary: "IT Vocabulary"
};
var careerScenarios = [
  {
    slug: "daily-stand-up",
    title: "Daily stand-up",
    topic: "Stand-ups",
    description: "Share progress, name a blocker, and make a clear next-step commitment.",
    prompt: "Give a 45-second update about an Information Systems project you are working on.",
    mode: "workplace",
    accent: "Coral"
  },
  {
    slug: "technical-interview",
    title: "Technical interview",
    topic: "Interviews",
    description: "Introduce your background and explain an information system with confident, direct language.",
    prompt: "Tell me about a system, project, or assignment that demonstrates your strengths.",
    mode: "interview",
    accent: "Gold"
  },
  {
    slug: "professional-email",
    title: "Professional email",
    topic: "Emails",
    description: "Write an update that is polite, concise, and clear for a stakeholder or teammate.",
    prompt: "Write an email explaining that a project deadline needs one extra day because testing is incomplete.",
    mode: "workplace",
    accent: "Sky"
  },
  {
    slug: "incident-report",
    title: "Incident report",
    topic: "Incident reports",
    description: "Describe a production issue, its impact, current status, and the next action without blame.",
    prompt: "Give a concise incident update after a customer-facing portal becomes unavailable.",
    mode: "it_vocabulary",
    accent: "Ink"
  },
  {
    slug: "requirements-gathering",
    title: "Requirements gathering",
    topic: "Requirements gathering",
    description: "Ask useful follow-up questions and restate business needs accurately.",
    prompt: "Open a meeting with a stakeholder who wants a new reporting dashboard but has not defined the requirements.",
    mode: "general",
    accent: "Moss"
  }
];
function tutorSystemPrompt(mode) {
  const modeGuidance = {
    general: "Focus on clear, natural everyday English while keeping explanations practical.",
    workplace: "Focus on concise, professional workplace English for collaboration, meetings, and written updates.",
    interview: "Role-play as a supportive IT interviewer and help the learner express technical experience confidently.",
    it_vocabulary: "Focus on accurate, accessible IT vocabulary and help the learner explain technical ideas to mixed audiences."
  };
  return `You are English Career Coach, a patient English tutor for Information Systems students and IT professionals. ${modeGuidance[mode]}

Reply in supportive, plain English. Preserve the learner's meaning and do not invent facts about their experience. For every learner message, use these brief markdown headings in this exact order: **Answer**, **Correction**, **Why**, **More natural way to say it**, **Try next**. If the learner's English is already strong, say so and offer a small refinement instead of forcing corrections. Keep the response under 260 words. Do not describe yourself as an official examiner or guarantee career outcomes.`;
}
function parsePracticeFeedback(value) {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Practice feedback was not an object");
  const record = parsed;
  const list = (key) => Array.isArray(record[key]) ? record[key].filter((item) => typeof item === "string") : [];
  const string = (key) => typeof record[key] === "string" ? record[key] : "";
  const score = typeof record.score === "number" && Number.isFinite(record.score) ? Math.max(0, Math.min(100, Math.round(record.score))) : -1;
  const feedback = {
    score,
    correction: string("correction"),
    explanation: string("explanation"),
    naturalAlternative: string("naturalAlternative"),
    errorCategories: list("errorCategories"),
    vocabulary: list("vocabulary")
  };
  if (feedback.score < 0 || !feedback.correction || !feedback.explanation || !feedback.naturalAlternative) {
    throw new Error("Practice feedback did not match the expected shape");
  }
  return feedback;
}
function calculateStreak(completionDates, now = /* @__PURE__ */ new Date()) {
  const uniqueDays = new Set(completionDates.map((date) => date.toISOString().slice(0, 10)));
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
function buildProgressOverview(input) {
  const { dailyGoal, attempts, completions, challenges, flashcards } = input;
  const activityDates = [
    ...attempts.map((item) => item.completedAt),
    ...completions.map((item) => item.completedAt),
    ...challenges.map((item) => item.completedAt)
  ];
  const errorMap = /* @__PURE__ */ new Map();
  attempts.forEach(
    (item) => item.feedback.errorCategories.forEach(
      (category) => errorMap.set(category, (errorMap.get(category) ?? 0) + 1)
    )
  );
  const errorCategories = Array.from(errorMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const recentActivity = [
    ...attempts.map((item) => ({
      id: item.id,
      title: `${item.activityType[0].toUpperCase()}${item.activityType.slice(1)} practice completed`,
      date: item.completedAt,
      score: item.score,
      kind: "practice"
    })),
    ...completions.map((item) => ({
      id: item.id,
      title: "Career scenario completed",
      date: item.completedAt,
      score: null,
      kind: "career"
    })),
    ...challenges.map((item) => ({
      id: item.id,
      title: "Daily IT-English challenge completed",
      date: item.completedAt,
      score: null,
      kind: "challenge"
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const todaySessions = activityDates.filter((date) => date.toISOString().slice(0, 10) === today).length;
  return {
    dailyGoal,
    todaySessions,
    streak: calculateStreak(activityDates),
    completedSessions: activityDates.length,
    vocabularyLearned: Math.max(
      flashcards.length,
      attempts.filter((item) => item.activityType === "vocabulary" && item.score >= 70).length * 5
    ),
    flashcardsCount: flashcards.length,
    errorCategories,
    recentActivity
  };
}
var dailyChallenges = [
  {
    id: "incident-summary",
    eyebrow: "Today\u2019s IT-English challenge",
    title: "Turn an incident into a calm update",
    prompt: "Write two clear sentences explaining that the customer portal is unavailable, the team is investigating, and the next update will be shared in 30 minutes.",
    note: "Use short sentences. Focus on impact, action, and timing."
  },
  {
    id: "standup-commitment",
    eyebrow: "Today\u2019s IT-English challenge",
    title: "Give a confident stand-up update",
    prompt: "Write a three-sentence stand-up update: what you finished, what you will do next, and one blocker you need help with.",
    note: "Try: \u2018Yesterday I\u2026 Today I will\u2026 I need help with\u2026\u2019"
  },
  {
    id: "requirement-question",
    eyebrow: "Today\u2019s IT-English challenge",
    title: "Ask one useful requirement question",
    prompt: "Write two questions you would ask a stakeholder before building a reporting dashboard for their team.",
    note: "Ask about the user, the decision they need to make, and the data they trust."
  },
  {
    id: "release-note",
    eyebrow: "Today\u2019s IT-English challenge",
    title: "Write a concise release note",
    prompt: "Write a short release note for a new password-reset flow that improves security and makes the process easier for users.",
    note: "Name the change, explain the benefit, and keep the tone user-focused."
  },
  {
    id: "interview-example",
    eyebrow: "Today\u2019s IT-English challenge",
    title: "Share an interview-ready example",
    prompt: "In three sentences, describe a time you solved a technical or project problem. Focus on the situation, your action, and the result.",
    note: "Use direct action verbs such as analysed, coordinated, improved, or delivered."
  }
];
function challengeDateKey(date = /* @__PURE__ */ new Date()) {
  return date.toISOString().slice(0, 10);
}
function getDailyChallenge(date = /* @__PURE__ */ new Date()) {
  const key = challengeDateKey(date);
  const seed = Array.from(key).reduce((total, character) => total + character.charCodeAt(0), 0);
  return { ...dailyChallenges[seed % dailyChallenges.length], date: key };
}
var supportedAudioMimes = ["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4"];
function isSupportedAudioMime(mimeType) {
  return supportedAudioMimes.includes(mimeType);
}

// server/_core/env.ts
var isProduction = process.env.NODE_ENV === "production";
var localMode = process.env.LOCAL_AUTH === "true";
var DEV_JWT_SECRET = "english-career-coach-local-development-secret";
var cookieSecret = process.env.JWT_SECRET ?? (!isProduction || localMode ? DEV_JWT_SECRET : "");
var localAuthEnabled = localMode || !isProduction && !process.env.OAUTH_SERVER_URL && !process.env.VITE_APP_ID;
if (!process.env.JWT_SECRET && (!isProduction || localMode)) {
  console.warn(
    "[Config] JWT_SECRET is not set; using the local development secret. Do not use this in production."
  );
}
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  localAuthEnabled,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Optional OpenAI-compatible provider. When present, it takes priority over
  // the managed Forge endpoint. This keeps the app portable.
  llmApiUrl: process.env.LLM_API_URL ?? process.env.OPENAI_BASE_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? ""
};

// server/localData.ts
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
var DEFAULT_FILE = path.resolve(process.cwd(), ".data", "local-db.json");
var dataFile = () => process.env.LOCAL_DATA_FILE?.trim() || DEFAULT_FILE;
var state = null;
function emptyState() {
  return {
    version: 1,
    nextUserId: 1,
    users: [],
    learnerProfiles: [],
    tutorConversations: [],
    tutorMessages: [],
    practiceAttempts: [],
    scenarioCompletions: [],
    vocabularyFlashcards: [],
    dailyChallengeCompletions: []
  };
}
var asDate = (value) => value == null ? value : value instanceof Date ? value : new Date(value);
function loadState() {
  if (state) return state;
  const file = dataFile();
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      state = {
        ...emptyState(),
        ...raw,
        version: 1,
        users: (raw.users ?? []).map((user) => ({
          ...user,
          createdAt: asDate(user.createdAt),
          updatedAt: asDate(user.updatedAt),
          lastSignedIn: asDate(user.lastSignedIn)
        })),
        learnerProfiles: (raw.learnerProfiles ?? []).map((profile) => ({
          ...profile,
          createdAt: asDate(profile.createdAt),
          updatedAt: asDate(profile.updatedAt)
        })),
        tutorConversations: (raw.tutorConversations ?? []).map((conversation) => ({
          ...conversation,
          createdAt: asDate(conversation.createdAt),
          updatedAt: asDate(conversation.updatedAt)
        })),
        tutorMessages: (raw.tutorMessages ?? []).map((message) => ({
          ...message,
          createdAt: asDate(message.createdAt)
        })),
        practiceAttempts: (raw.practiceAttempts ?? []).map((attempt) => ({
          ...attempt,
          completedAt: asDate(attempt.completedAt)
        })),
        scenarioCompletions: (raw.scenarioCompletions ?? []).map((completion) => ({
          ...completion,
          completedAt: asDate(completion.completedAt)
        })),
        vocabularyFlashcards: (raw.vocabularyFlashcards ?? []).map((card) => ({
          ...card,
          createdAt: asDate(card.createdAt),
          reviewedAt: asDate(card.reviewedAt) ?? null
        })),
        dailyChallengeCompletions: (raw.dailyChallengeCompletions ?? []).map((completion) => ({
          ...completion,
          completedAt: asDate(completion.completedAt)
        }))
      };
      return state;
    }
  } catch (error) {
    console.warn("[LocalData] Could not read local database, starting fresh:", error);
  }
  state = emptyState();
  return state;
}
function saveState() {
  const current = loadState();
  const file = dataFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(current, null, 2), "utf8");
    fs.renameSync(temporary, file);
  } catch (error) {
    console.error("[LocalData] Failed to save local database:", error);
  }
}
function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const current = loadState();
  const now = /* @__PURE__ */ new Date();
  const existing = current.users.find((item) => item.openId === user.openId);
  if (existing) {
    if (user.name !== void 0) existing.name = user.name ?? null;
    if (user.email !== void 0) existing.email = user.email ?? null;
    if (user.loginMethod !== void 0) existing.loginMethod = user.loginMethod ?? null;
    if (user.role !== void 0) existing.role = user.role;
    existing.lastSignedIn = user.lastSignedIn ?? now;
    existing.updatedAt = now;
    saveState();
    return existing;
  }
  const created = {
    id: current.nextUserId++,
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role: user.role ?? "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: user.lastSignedIn ?? now
  };
  current.users.push(created);
  saveState();
  return created;
}
function getUserByOpenId(openId) {
  return loadState().users.find((user) => user.openId === openId);
}
function getProfile(userId) {
  const current = loadState();
  const existing = current.learnerProfiles.find((profile2) => profile2.userId === userId);
  if (existing) return existing;
  const now = /* @__PURE__ */ new Date();
  const profile = {
    id: nanoid(),
    userId,
    englishLevel: "Intermediate",
    targetRole: "Information Systems Professional",
    focusAreas: ["Workplace English", "IT Vocabulary"],
    dailyGoal: 1,
    createdAt: now,
    updatedAt: now
  };
  current.learnerProfiles.push(profile);
  saveState();
  return profile;
}
function updateProfile(userId, values) {
  const current = loadState();
  const profile = getProfile(userId);
  Object.assign(profile, values, { updatedAt: /* @__PURE__ */ new Date() });
  if (!current.learnerProfiles.includes(profile)) current.learnerProfiles.push(profile);
  saveState();
  return profile;
}
function listConversations(userId) {
  return loadState().tutorConversations.filter((conversation) => conversation.userId === userId).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 30);
}
function getConversation(userId, conversationId) {
  const current = loadState();
  const conversation = current.tutorConversations.find(
    (item) => item.id === conversationId && item.userId === userId
  );
  if (!conversation) return void 0;
  const messages = current.tutorMessages.filter((message) => message.conversationId === conversationId && message.userId === userId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return { conversation, messages };
}
function createConversation(userId, mode, title, scenarioSlug) {
  const now = /* @__PURE__ */ new Date();
  const conversation = {
    id: nanoid(),
    userId,
    mode,
    title,
    scenarioSlug: scenarioSlug ?? null,
    createdAt: now,
    updatedAt: now
  };
  loadState().tutorConversations.push(conversation);
  saveState();
  return conversation;
}
function addMessage(userId, conversationId, role, content) {
  const current = loadState();
  const message = {
    id: nanoid(),
    conversationId,
    userId,
    role,
    content,
    createdAt: /* @__PURE__ */ new Date()
  };
  current.tutorMessages.push(message);
  const conversation = current.tutorConversations.find(
    (item) => item.id === conversationId && item.userId === userId
  );
  if (conversation) conversation.updatedAt = /* @__PURE__ */ new Date();
  saveState();
  return message;
}
function savePracticeAttempt(userId, input) {
  const attempt = {
    id: nanoid(),
    userId,
    activityType: input.activityType,
    prompt: input.prompt,
    response: input.response,
    score: input.feedback.score,
    feedback: {
      correction: input.feedback.correction,
      explanation: input.feedback.explanation,
      naturalAlternative: input.feedback.naturalAlternative,
      errorCategories: input.feedback.errorCategories,
      vocabulary: input.feedback.vocabulary
    },
    completedAt: /* @__PURE__ */ new Date()
  };
  loadState().practiceAttempts.push(attempt);
  saveState();
  return attempt;
}
function getScenarioCompletions(userId) {
  return loadState().scenarioCompletions.filter((completion) => completion.userId === userId);
}
function completeScenario(userId, scenarioSlug, conversationId) {
  const current = loadState();
  const now = /* @__PURE__ */ new Date();
  const existing = current.scenarioCompletions.find(
    (completion2) => completion2.userId === userId && completion2.scenarioSlug === scenarioSlug
  );
  if (existing) {
    existing.conversationId = conversationId ?? null;
    existing.completedAt = now;
    saveState();
    return existing;
  }
  const completion = {
    id: nanoid(),
    userId,
    scenarioSlug,
    conversationId: conversationId ?? null,
    completedAt: now
  };
  current.scenarioCompletions.push(completion);
  saveState();
  return completion;
}
function listFlashcards(userId) {
  return loadState().vocabularyFlashcards.filter((card) => card.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
function saveFlashcard(userId, input) {
  const current = loadState();
  const normalised = input.term.trim().toLowerCase();
  const existing = current.vocabularyFlashcards.find(
    (card2) => card2.userId === userId && card2.term.trim().toLowerCase() === normalised
  );
  if (existing) {
    existing.definition = input.definition;
    existing.example = input.example;
    existing.sourceConversationId = input.sourceConversationId ?? null;
    saveState();
    return existing;
  }
  const card = {
    id: nanoid(),
    userId,
    term: input.term,
    definition: input.definition,
    example: input.example,
    sourceConversationId: input.sourceConversationId ?? null,
    createdAt: /* @__PURE__ */ new Date(),
    reviewedAt: null
  };
  current.vocabularyFlashcards.push(card);
  saveState();
  return card;
}
function markFlashcardReviewed(userId, flashcardId) {
  const card = loadState().vocabularyFlashcards.find(
    (item) => item.id === flashcardId && item.userId === userId
  );
  if (!card) return;
  card.reviewedAt = /* @__PURE__ */ new Date();
  saveState();
}
function getChallengeCompletion(userId, challengeDate) {
  return loadState().dailyChallengeCompletions.find(
    (completion) => completion.userId === userId && completion.challengeDate === challengeDate
  );
}
function completeDailyChallenge(userId, input) {
  const current = loadState();
  const existing = current.dailyChallengeCompletions.find(
    (completion2) => completion2.userId === userId && completion2.challengeDate === input.challengeDate
  );
  if (existing) {
    existing.challengeId = input.challengeId;
    existing.response = input.response;
    existing.completedAt = /* @__PURE__ */ new Date();
    saveState();
    return existing;
  }
  const completion = {
    id: nanoid(),
    userId,
    challengeDate: input.challengeDate,
    challengeId: input.challengeId,
    response: input.response,
    completedAt: /* @__PURE__ */ new Date()
  };
  current.dailyChallengeCompletions.push(completion);
  saveState();
  return completion;
}
function getProgressOverview(userId) {
  const current = loadState();
  const profile = getProfile(userId);
  return buildProgressOverview({
    dailyGoal: profile.dailyGoal,
    attempts: current.practiceAttempts.filter((attempt) => attempt.userId === userId),
    completions: current.scenarioCompletions.filter((completion) => completion.userId === userId),
    challenges: current.dailyChallengeCompletions.filter((completion) => completion.userId === userId),
    flashcards: current.vocabularyFlashcards.filter((card) => card.userId === userId)
  });
}

// server/db.ts
var _db = null;
function usesLocalData() {
  return !process.env.DATABASE_URL && (process.env.LOCAL_DATA === "true" || process.env.NODE_ENV !== "production");
}
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db;
}
async function upsertUser2(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  if (usesLocalData()) {
    upsertUser(user);
    return;
  }
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date() };
  const updateSet = { lastSignedIn: values.lastSignedIn };
  ["name", "email", "loginMethod"].forEach((field) => {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId2(openId) {
  if (usesLocalData()) return getUserByOpenId(openId);
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getProfile2(userId) {
  if (usesLocalData()) return getProfile(userId);
  const db = await requireDb();
  const rows = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const profile = { id: nanoid2(), userId, englishLevel: "Intermediate", targetRole: "Information Systems Professional", focusAreas: ["Workplace English", "IT Vocabulary"], dailyGoal: 1 };
  await db.insert(learnerProfiles).values(profile);
  const created = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  return created[0];
}
async function updateProfile2(userId, values) {
  if (usesLocalData()) return updateProfile(userId, values);
  const db = await requireDb();
  await getProfile2(userId);
  await db.update(learnerProfiles).set(values).where(eq(learnerProfiles.userId, userId));
  return getProfile2(userId);
}
async function listConversations2(userId) {
  if (usesLocalData()) return listConversations(userId);
  const db = await requireDb();
  return db.select().from(tutorConversations).where(eq(tutorConversations.userId, userId)).orderBy(desc(tutorConversations.updatedAt)).limit(30);
}
async function getConversation2(userId, conversationId) {
  if (usesLocalData()) return getConversation(userId, conversationId);
  const db = await requireDb();
  const conversations = await db.select().from(tutorConversations).where(and(eq(tutorConversations.id, conversationId), eq(tutorConversations.userId, userId))).limit(1);
  if (!conversations[0]) return void 0;
  const messages = await db.select().from(tutorMessages).where(and(eq(tutorMessages.conversationId, conversationId), eq(tutorMessages.userId, userId))).orderBy(tutorMessages.createdAt);
  return { conversation: conversations[0], messages };
}
async function createConversation2(userId, mode, title, scenarioSlug) {
  if (usesLocalData()) return createConversation(userId, mode, title, scenarioSlug);
  const db = await requireDb();
  const conversation = { id: nanoid2(), userId, mode, title, scenarioSlug: scenarioSlug ?? null };
  await db.insert(tutorConversations).values(conversation);
  return conversation;
}
async function addMessage2(userId, conversationId, role, content) {
  if (usesLocalData()) return addMessage(userId, conversationId, role, content);
  const db = await requireDb();
  await db.insert(tutorMessages).values({ id: nanoid2(), userId, conversationId, role, content });
  await db.update(tutorConversations).set({ updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(tutorConversations.id, conversationId), eq(tutorConversations.userId, userId)));
}
async function savePracticeAttempt2(userId, input) {
  if (usesLocalData()) return savePracticeAttempt(userId, input);
  const db = await requireDb();
  const attempt = {
    id: nanoid2(),
    userId,
    activityType: input.activityType,
    prompt: input.prompt,
    response: input.response,
    score: input.feedback.score,
    feedback: { correction: input.feedback.correction, explanation: input.feedback.explanation, naturalAlternative: input.feedback.naturalAlternative, errorCategories: input.feedback.errorCategories, vocabulary: input.feedback.vocabulary }
  };
  await db.insert(practiceAttempts).values(attempt);
  return attempt;
}
async function getScenarioCompletions2(userId) {
  if (usesLocalData()) return getScenarioCompletions(userId);
  const db = await requireDb();
  return db.select().from(scenarioCompletions).where(eq(scenarioCompletions.userId, userId));
}
async function completeScenario2(userId, scenarioSlug, conversationId) {
  if (usesLocalData()) return completeScenario(userId, scenarioSlug, conversationId);
  const db = await requireDb();
  await db.insert(scenarioCompletions).values({ id: nanoid2(), userId, scenarioSlug, conversationId: conversationId ?? null, completedAt: /* @__PURE__ */ new Date() }).onDuplicateKeyUpdate({ set: { conversationId: conversationId ?? null, completedAt: /* @__PURE__ */ new Date() } });
}
async function listFlashcards2(userId) {
  if (usesLocalData()) return listFlashcards(userId);
  const db = await requireDb();
  return db.select().from(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId)).orderBy(desc(vocabularyFlashcards.createdAt));
}
async function saveFlashcard2(userId, input) {
  if (usesLocalData()) return saveFlashcard(userId, input);
  const db = await requireDb();
  await db.insert(vocabularyFlashcards).values({ id: nanoid2(), userId, term: input.term, definition: input.definition, example: input.example, sourceConversationId: input.sourceConversationId ?? null }).onDuplicateKeyUpdate({ set: { definition: input.definition, example: input.example, sourceConversationId: input.sourceConversationId ?? null } });
  const cards = await db.select().from(vocabularyFlashcards).where(and(eq(vocabularyFlashcards.userId, userId), eq(vocabularyFlashcards.term, input.term))).limit(1);
  return cards[0];
}
async function markFlashcardReviewed2(userId, flashcardId) {
  if (usesLocalData()) return markFlashcardReviewed(userId, flashcardId);
  const db = await requireDb();
  await db.update(vocabularyFlashcards).set({ reviewedAt: /* @__PURE__ */ new Date() }).where(and(eq(vocabularyFlashcards.id, flashcardId), eq(vocabularyFlashcards.userId, userId)));
}
async function getChallengeCompletion2(userId, challengeDate) {
  if (usesLocalData()) return getChallengeCompletion(userId, challengeDate);
  const db = await requireDb();
  const rows = await db.select().from(dailyChallengeCompletions).where(and(eq(dailyChallengeCompletions.userId, userId), eq(dailyChallengeCompletions.challengeDate, challengeDate))).limit(1);
  return rows[0];
}
async function completeDailyChallenge2(userId, input) {
  if (usesLocalData()) return completeDailyChallenge(userId, input);
  const db = await requireDb();
  await db.insert(dailyChallengeCompletions).values({ id: nanoid2(), userId, ...input, completedAt: /* @__PURE__ */ new Date() }).onDuplicateKeyUpdate({ set: { challengeId: input.challengeId, response: input.response, completedAt: /* @__PURE__ */ new Date() } });
  return getChallengeCompletion2(userId, input.challengeDate);
}
async function getProgressOverview2(userId) {
  if (usesLocalData()) return getProgressOverview(userId);
  const db = await requireDb();
  const [profile, attempts, completions, challenges, flashcards] = await Promise.all([
    getProfile2(userId),
    db.select().from(practiceAttempts).where(eq(practiceAttempts.userId, userId)).orderBy(desc(practiceAttempts.completedAt)),
    db.select().from(scenarioCompletions).where(eq(scenarioCompletions.userId, userId)).orderBy(desc(scenarioCompletions.completedAt)),
    db.select().from(dailyChallengeCompletions).where(eq(dailyChallengeCompletions.userId, userId)).orderBy(desc(dailyChallengeCompletions.completedAt)),
    db.select().from(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId))
  ]);
  return buildProgressOverview({
    dailyGoal: profile.dailyGoal,
    attempts,
    completions,
    challenges,
    flashcards
  });
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    // SameSite=None requires a Secure cookie. Local HTTP development uses Lax
    // so the browser keeps the session.
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    if (ENV.localAuthEnabled) {
      console.log("[Auth] Local demo sign-in is enabled.");
      return;
    }
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state2) {
    return decodeOAuthState(state2).redirectUri;
  }
  async getTokenByCode(code, state2) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state2)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state2) {
    return this.oauthService.getTokenByCode(code, state2);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        // Local demo sessions do not have a Manus app id, but the token still
        // needs a non-empty appId to pass verification.
        appId: ENV.appId || "local-demo",
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId2(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser2({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId2(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser2({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/localAuth.ts
var LOCAL_DEMO_OPEN_ID = "local-demo-user";
function isLocalAuthEnabled() {
  return ENV.localAuthEnabled;
}
function safeReturnTo(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
function registerLocalAuthRoutes(app) {
  app.get("/api/auth/local", async (req, res) => {
    if (!isLocalAuthEnabled()) {
      res.status(404).json({
        error: "Local sign-in is disabled. Set LOCAL_AUTH=true for local development or configure OAuth."
      });
      return;
    }
    try {
      await upsertUser2({
        openId: LOCAL_DEMO_OPEN_ID,
        name: "Alex Morgan",
        email: "alex.morgan@example.com",
        loginMethod: "local",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const user = await getUserByOpenId2(LOCAL_DEMO_OPEN_ID);
      const sessionToken = await sdk.createSessionToken(LOCAL_DEMO_OPEN_ID, {
        name: user?.name || "Alex Morgan",
        expiresInMs: ONE_YEAR_MS
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS
      });
      res.redirect(302, safeReturnTo(req.query.returnTo));
    } catch (error) {
      console.error("[LocalAuth] Sign-in failed", error);
      res.status(500).json({ error: "Local sign-in failed" });
    }
  });
}

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state2 = getQueryParam(req, "state");
    if (!code || !state2) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state2);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state2);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser2({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
import fs2 from "node:fs";
import path2 from "node:path";
var LOCAL_STORAGE_DIR = path2.resolve(process.cwd(), ".data", "storage");
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      const safeKey = key.replace(/\.\.(\/|\\|$)/g, "");
      const file = path2.join(LOCAL_STORAGE_DIR, safeKey);
      if (fs2.existsSync(file) && file.startsWith(LOCAL_STORAGE_DIR)) {
        res.sendFile(file);
        return;
      }
      res.status(404).send("Storage file not found");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/localCoach.ts
var corrections = [
  { pattern: /\bI am agree\b/gi, replacement: "I agree", category: "Grammar", note: "\u201CAgree\u201D is a verb, so it does not need \u201Cam\u201D." },
  { pattern: /\bI am not agree\b/gi, replacement: "I don't agree", category: "Grammar", note: "Use \u201CI don't agree\u201D or \u201CI disagree\u201D." },
  { pattern: /\bwe are agree\b/gi, replacement: "we agree", category: "Grammar", note: "\u201CAgree\u201D is a verb, so it does not need \u201Care\u201D." },
  { pattern: /\bdiscuss about\b/gi, replacement: "discuss", category: "Prepositions", note: "We discuss something; \u201Cabout\u201D is not needed after \u201Cdiscuss\u201D." },
  { pattern: /\binformations\b/gi, replacement: "information", category: "Word choice", note: "\u201CInformation\u201D is uncountable, so it has no plural form." },
  { pattern: /\badvices\b/gi, replacement: "advice", category: "Word choice", note: "\u201CAdvice\u201D is uncountable. Use \u201Ca piece of advice\u201D for one item." },
  { pattern: /\bpeoples\b/gi, replacement: "people", category: "Word choice", note: "\u201CPeople\u201D is already plural." },
  { pattern: /\bmore better\b/gi, replacement: "better", category: "Grammar", note: "\u201CBetter\u201D is already comparative, so \u201Cmore\u201D is unnecessary." },
  { pattern: /\bcan able to\b/gi, replacement: "can", category: "Grammar", note: "Use either \u201Ccan\u201D or \u201Cbe able to\u201D, not both." },
  { pattern: /\bI will can\b/gi, replacement: "I will be able to", category: "Grammar", note: "After \u201Cwill\u201D, use \u201Cbe able to\u201D rather than \u201Ccan\u201D." },
  { pattern: /\b(want|need|hope|plan|try|decide) (improve|go|learn|start|work|become|do|make|ask|know|build|move|change|join|speak|write|read|finish|send|talk|study|practice)\b/gi, replacement: "$1 to $2", category: "Grammar", note: "Use \u201Cto\u201D before the verb after words such as \u201Cwant\u201D, \u201Cneed\u201D, or \u201Cplan\u201D." },
  { pattern: /\bwe was\b/gi, replacement: "we were", category: "Verb tense", note: "\u201CWe\u201D takes \u201Cwere\u201D in the past tense." },
  { pattern: /\bthey was\b/gi, replacement: "they were", category: "Verb tense", note: "\u201CThey\u201D takes \u201Cwere\u201D in the past tense." },
  { pattern: /\bI didn't went\b/gi, replacement: "I didn't go", category: "Verb tense", note: "After \u201Cdidn't\u201D, use the base form of the verb." },
  { pattern: /\bI didn't found\b/gi, replacement: "I didn't find", category: "Verb tense", note: "After \u201Cdidn't\u201D, use the base form of the verb." },
  { pattern: /\bI have did\b/gi, replacement: "I have done", category: "Verb tense", note: "Use the past participle \u201Cdone\u201D after \u201Chave\u201D." },
  { pattern: /\bI have went\b/gi, replacement: "I have gone", category: "Verb tense", note: "Use the past participle \u201Cgone\u201D after \u201Chave\u201D." },
  { pattern: /\bI has\b/gi, replacement: "I have", category: "Grammar", note: "Use \u201Chave\u201D with \u201CI\u201D." },
  { pattern: /\b(he|she|it) don't\b/gi, replacement: "$1 doesn't", category: "Grammar", note: "Use \u201Cdoesn't\u201D with he, she, or it." },
  { pattern: /\bthere is many\b/gi, replacement: "there are many", category: "Grammar", note: "Use \u201Cthere are\u201D with a plural noun." },
  { pattern: /\bpeople is\b/gi, replacement: "people are", category: "Grammar", note: "\u201CPeople\u201D is plural, so it takes \u201Care\u201D." },
  { pattern: /\bone of my colleague\b/gi, replacement: "one of my colleagues", category: "Grammar", note: "Use the plural noun after \u201Cone of my\u201D." },
  { pattern: /\bI have (\d+) years? experience\b/gi, replacement: "I have $1 years of experience", category: "Prepositions", note: "Use \u201Cyears of experience\u201D." },
  { pattern: /\bI am working (here|on this) since\b/gi, replacement: "I have been working $1 since", category: "Verb tense", note: "Use the present perfect continuous for an action that started in the past and continues now." },
  { pattern: /\bI'm working (here|on this) since\b/gi, replacement: "I have been working $1 since", category: "Verb tense", note: "Use the present perfect continuous for an action that started in the past and continues now." },
  { pattern: /\bI have been working here from\b/gi, replacement: "I have been working here since", category: "Prepositions", note: "Use \u201Csince\u201D with a starting point in time." },
  { pattern: /\bI'm interested about\b/gi, replacement: "I'm interested in", category: "Prepositions", note: "The adjective \u201Cinterested\u201D is followed by \u201Cin\u201D." },
  { pattern: /\bI am interested to\b/gi, replacement: "I am interested in", category: "Prepositions", note: "Use \u201Cinterested in\u201D before a noun or -ing form." },
  { pattern: /\bgood in\b/gi, replacement: "good at", category: "Prepositions", note: "Use \u201Cgood at\u201D for skills." },
  { pattern: /\bresponsible of\b/gi, replacement: "responsible for", category: "Prepositions", note: "Use \u201Cresponsible for\u201D." },
  { pattern: /\bparticipate to\b/gi, replacement: "participate in", category: "Prepositions", note: "Use \u201Cparticipate in\u201D." },
  { pattern: /\bfocus in\b/gi, replacement: "focus on", category: "Prepositions", note: "Use \u201Cfocus on\u201D." },
  { pattern: /\bexplain me\b/gi, replacement: "explain to me", category: "Grammar", note: "We explain something to someone." },
  { pattern: /\bvery much good\b/gi, replacement: "very good", category: "Grammar", note: "Use \u201Cvery good\u201D or \u201Creally good\u201D." },
  { pattern: /\bhow to say\b/gi, replacement: "how do you say", category: "Grammar", note: "Use \u201CHow do you say\u2026?\u201D for a direct question." },
  { pattern: /\bIn my opinion, I think\b/gi, replacement: "In my opinion", category: "Clarity", note: "Choose one opinion phrase to avoid repetition." },
  { pattern: /\bin the same time\b/gi, replacement: "at the same time", category: "Prepositions", note: "Use \u201Cat the same time\u201D." },
  { pattern: /\bas per my opinion\b/gi, replacement: "in my opinion", category: "Clarity", note: "Use \u201Cin my opinion\u201D." },
  { pattern: /\bme and my team\b/gi, replacement: "my team and I", category: "Grammar", note: "Put yourself second and use \u201CI\u201D as the subject." },
  { pattern: /\bI have a doubt\b/gi, replacement: "I have a question", category: "Word choice", note: "In workplace English, \u201CI have a question\u201D is the natural phrase." },
  { pattern: /\bdo the needful\b/gi, replacement: "take the necessary action", category: "Professional tone", note: "\u201CDo the needful\u201D is dated; use a specific action instead." },
  { pattern: /\brevert back\b/gi, replacement: "reply", category: "Professional tone", note: "Use \u201Creply\u201D or \u201Cget back to you\u201D." },
  { pattern: /\bprepone\b/gi, replacement: "bring forward", category: "Word choice", note: "Use \u201Cbring forward\u201D or \u201Cmove earlier\u201D." },
  { pattern: /\bkindly\b/gi, replacement: "please", category: "Professional tone", note: "\u201CPlease\u201D is simpler and more natural in most workplace writing." }
];
var vocabularyIdeas = [
  { word: "stakeholder", definition: "a person who has an interest in a project or decision", example: "I will share the timeline with the key stakeholders." },
  { word: "blocker", definition: "a problem that prevents progress", example: "My only blocker is access to the test environment." },
  { word: "root cause", definition: "the underlying reason a problem happened", example: "We found the root cause of the login failure." },
  { word: "rollback", definition: "returning a system to a previous working version", example: "We performed a rollback after the release." },
  { word: "deployment", definition: "the process of releasing software to an environment", example: "The deployment is scheduled for Thursday evening." },
  { word: "mitigation", definition: "an action that reduces the impact of a problem", example: "Our mitigation reduced the impact on customers." },
  { word: "requirement", definition: "something the product must do to meet a business need", example: "We clarified the reporting requirement with the user." },
  { word: "deadline", definition: "the latest time by which work must be finished", example: "We can meet the deadline if testing finishes today." },
  { word: "incident", definition: "an unplanned event that disrupts a service", example: "The incident affected the customer portal for 20 minutes." },
  { word: "alignment", definition: "shared agreement between people or teams", example: "We need alignment on the scope before we start." },
  { word: "ETA", definition: "estimated time of arrival or completion", example: "The ETA for the fix is 30 minutes." },
  { word: "cross-functional", definition: "involving people from different teams or specialties", example: "A cross-functional team investigated the issue." },
  { word: "dashboard", definition: "a screen that summarises important information", example: "The dashboard shows weekly support volumes." },
  { word: "API", definition: "a defined way for two software systems to communicate", example: "The mobile app calls the payment API." },
  { word: "database", definition: "an organised store of data that applications can query", example: "The customer records are stored in a database." },
  { word: "cache", definition: "a temporary store that speeds up repeated access to data", example: "We cleared the cache after the update." },
  { word: "firewall", definition: "a security control that filters network traffic", example: "The firewall blocks unexpected inbound connections." },
  { word: "repository", definition: "a central place where code and its history are stored", example: "I pushed the fix to the repository." },
  { word: "bug", definition: "a defect in software that causes incorrect behaviour", example: "We found a bug in the password-reset flow." },
  { word: "scope", definition: "the agreed boundary of what a project will deliver", example: "That request is outside the scope of this release." }
];
function capitaliseFirst(text2) {
  const trimmed = text2.trim();
  if (!trimmed) return trimmed;
  return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
}
function hasSentenceEnding(text2) {
  return /[.!?]$/.test(text2.trim());
}
function finishSentence(text2) {
  const trimmed = text2.trim();
  if (!trimmed) return trimmed;
  return hasSentenceEnding(trimmed) ? trimmed : `${trimmed}.`;
}
function generalAlternative(text2) {
  const clean = normaliseText(text2).replace(/[.!?]+$/, "");
  if (/^help me\b/i.test(clean)) {
    return finishSentence(clean.replace(/^help me\b/i, "Could you help me"));
  }
  if (/^i want\b/i.test(clean)) {
    return finishSentence(clean.replace(/^i want\b/i, "I'd like"));
  }
  if (/^i need\b/i.test(clean)) {
    return finishSentence(clean.replace(/^i need\b/i, "I need"));
  }
  return finishSentence(clean);
}
function normaliseText(text2) {
  return text2.replace(/\s+/g, " ").trim();
}
function correctEnglish(value) {
  let text2 = normaliseText(value);
  const notes = [];
  for (const correction of corrections) {
    correction.pattern.lastIndex = 0;
    if (correction.pattern.test(text2)) {
      text2 = text2.replace(correction.pattern, correction.replacement);
      if (!notes.some((item) => item.note === correction.note)) {
        notes.push({ category: correction.category, note: correction.note });
      }
    }
  }
  const capitalised = capitaliseFirst(text2);
  if (capitalised !== text2) {
    notes.push({ category: "Capitalisation", note: "Start a sentence with a capital letter." });
  }
  text2 = capitalised;
  if (text2.length > 12 && !hasSentenceEnding(text2)) {
    text2 = `${text2}.`;
    notes.push({ category: "Punctuation", note: "Finish a complete sentence with a full stop." });
  }
  return { corrected: text2, notes };
}
function pickVocabulary(text2, limit = 3) {
  const lower = text2.toLowerCase();
  const words = vocabularyIdeas.filter((item) => lower.includes(item.word.toLowerCase()));
  if (words.length > 0) return words.slice(0, limit).map((item) => item.word);
  return vocabularyIdeas.slice(0, limit).map((item) => item.word);
}
function activityLabel(activityType) {
  return {
    vocabulary: "vocabulary",
    grammar: "grammar correction",
    rewrite: "sentence rewriting",
    writing: "writing"
  }[activityType];
}
function localPracticeFeedback(input) {
  const { corrected, notes } = correctEnglish(input.response);
  const wordCount = input.response.trim().split(/\s+/).filter(Boolean).length;
  const categories = Array.from(new Set(notes.map((note) => note.category)));
  let score = 90 - notes.length * 5;
  if (wordCount < 6) {
    score -= 12;
    categories.push("Development");
  } else if (wordCount > 35) {
    score -= 3;
  }
  if (input.activityType === "vocabulary") score += 2;
  if (input.activityType === "writing" && !/[.!?]/.test(input.response)) score -= 4;
  score = Math.max(42, Math.min(97, Math.round(score)));
  const strengths = notes.length === 0 ? "Your sentence is clear and easy to follow." : `Your meaning comes across, and the ${activityLabel(input.activityType)} exercise is a useful step.`;
  const explanation = notes.length === 0 ? `${strengths} Keep the sentence specific, and add one concrete detail from your IT work when you can.` : `${strengths} ${notes.map((note) => note.note).join(" ")}`;
  const vocabulary = pickVocabulary(input.response);
  const naturalAlternative = input.activityType === "writing" ? `${finishSentence(corrected)} This version keeps your point direct, professional, and easy for a busy colleague to scan.` : input.activityType === "rewrite" ? `${finishSentence(corrected)} A more polished way to say it is to lead with the key point and then add the reason.` : input.activityType === "vocabulary" ? `${finishSentence(corrected)} A natural way to use this in your IT work is: \u201C${vocabularyIdeas.find((item) => item.word === vocabulary[0])?.example ?? "I used this term in a project update."}\u201D` : `${finishSentence(corrected)} A natural alternative is: \u201C${generalAlternative(input.response)}\u201D`;
  return {
    score,
    correction: corrected || input.response,
    explanation,
    naturalAlternative,
    errorCategories: Array.from(new Set(categories)),
    vocabulary
  };
}
function modeFromPrompt(systemPrompt) {
  if (/supportive IT interviewer/i.test(systemPrompt)) return "interview";
  if (/concise, professional workplace/i.test(systemPrompt)) return "workplace";
  if (/accurate, accessible IT vocabulary/i.test(systemPrompt)) return "it_vocabulary";
  return "general";
}
function vocabularyExplanation(message) {
  const lower = message.toLowerCase();
  const match = vocabularyIdeas.find((item) => lower.includes(item.word.toLowerCase()));
  if (!match) {
    return "A useful pattern for explaining an IT term is: \u201CIt is a ___ that helps people ___. For example, ___.\u201D This keeps the definition concrete for a non-technical listener.";
  }
  return `\u201C${match.word}\u201D means ${match.definition}. For example: \u201C${match.example}\u201D`;
}
function localTutorReply(input) {
  const message = normaliseText(input.message);
  const mode = modeFromPrompt(input.systemPrompt ?? "");
  const { corrected, notes } = correctEnglish(message);
  const correction = notes.length === 0 ? "Your English is already clear. I would keep it as it is." : `${corrected}`;
  const why = notes.length === 0 ? "The sentence has a clear main idea and correct basic structure." : notes.map((note) => note.note).join(" ");
  let answer;
  let natural;
  let next;
  if (mode === "interview") {
    answer = "Thank you \u2014 that gives me a useful starting point. A strong interview answer usually follows Situation \u2192 Action \u2192 Result, so make the result explicit.";
    natural = `${finishSentence(corrected)} In an interview, you could add: \u201CThe result was ___, and it helped the team ___.\u201D`;
    next = "Try answering this follow-up: \u201CWhat was the hardest part of that project, and how did you handle it?\u201D";
  } else if (mode === "workplace") {
    answer = "Here is a professional way to frame that for a colleague or stakeholder. Lead with the status, then the impact, then the next action.";
    natural = `Status: ${finishSentence(corrected)} Next step: I will share an update by the end of the day.`;
    next = "Rewrite it as a two-sentence update: one sentence for status and one for the next action or blocker.";
  } else if (mode === "it_vocabulary") {
    answer = vocabularyExplanation(message);
    natural = `A natural explanation is: ${finishSentence(corrected)}`;
    next = "Now explain the same idea to a non-technical stakeholder in two sentences, avoiding acronyms.";
  } else {
    answer = "You are communicating the main idea. I would tighten the sentence and make the purpose more direct.";
    natural = `${finishSentence(corrected)} Another natural option is: \u201C${generalAlternative(message)}\u201D`;
    next = "Use the corrected sentence in a new example about your own IT work.";
  }
  return [
    `**Answer**
${answer}`,
    `**Correction**
${correction}`,
    `**Why**
${why}`,
    `**More natural way to say it**
${natural}`,
    `**Try next**
${next}`
  ].join("\n\n");
}

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveProviderKey = () => ENV.llmApiKey || ENV.forgeApiKey;
var resolveApiUrl = () => {
  const base = ENV.llmApiUrl || ENV.forgeApiUrl;
  if (!base) return "https://api.openai.com/v1/chat/completions";
  const trimmed = base.replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  if (/\/v1$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
};
var messageText = (message) => {
  const parts = Array.isArray(message.content) ? message.content : [message.content];
  return parts.map((part) => typeof part === "string" ? part : part.type === "text" ? part.text : "").join("\n").trim();
};
function localInvoke(params) {
  const lastUser = [...params.messages].reverse().find((message) => message.role === "user");
  const text2 = lastUser ? messageText(lastUser) : "";
  const responseFormat = params.response_format ?? params.responseFormat;
  let content;
  if (responseFormat?.type === "json_schema" && responseFormat.json_schema.name === "practice_feedback") {
    const match = text2.match(/Activity type:\s*(\w+)\s*\nPrompt:\s*([\s\S]*?)\nLearner response:\s*([\s\S]*)$/);
    const activityType = match?.[1] ?? "writing";
    content = JSON.stringify(
      localPracticeFeedback({
        activityType,
        prompt: match?.[2]?.trim() ?? "",
        response: match?.[3]?.trim() ?? text2
      })
    );
  } else {
    const systemPrompt = params.messages.filter((message) => message.role === "system").map(messageText).join("\n");
    content = localTutorReply({
      message: text2,
      systemPrompt,
      history: params.messages.map((message) => ({
        role: message.role,
        content: messageText(message)
      }))
    });
  }
  return {
    id: `local-${Date.now()}`,
    created: Math.floor(Date.now() / 1e3),
    model: "local-rule-based-coach",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop"
      }
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
async function invokeLLM(params) {
  const apiKey = resolveProviderKey();
  if (!apiKey) {
    console.warn("[LLM] No AI provider configured; using the offline rule-based coach.");
    return localInvoke(params);
  }
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage)
  };
  const resolvedModel = ENV.llmModel || model;
  if (resolvedModel) {
    payload.model = resolvedModel;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/_core/voiceTranscription.ts
async function transcribeAudio(options) {
  try {
    const providerKey = ENV.llmApiKey || ENV.forgeApiKey;
    const providerBase = ENV.llmApiUrl || ENV.forgeApiUrl || (ENV.llmApiKey ? "https://api.openai.com/v1" : "");
    if (!providerBase || !providerKey) {
      return {
        error: "Voice transcription is not configured. Add an OpenAI-compatible LLM_API_URL and LLM_API_KEY, or the Forge values.",
        code: "SERVICE_ERROR",
        details: "No transcription provider is configured"
      };
    }
    let audioBuffer;
    let mimeType;
    try {
      const response2 = await fetch(options.audioUrl);
      if (!response2.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response2.status}: ${response2.statusText}`
        };
      }
      audioBuffer = Buffer.from(await response2.arrayBuffer());
      mimeType = response2.headers.get("content-type") || "audio/mpeg";
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return {
          error: "Audio file exceeds maximum size limit",
          code: "FILE_TOO_LARGE",
          details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`
        };
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }
    const formData = new FormData();
    const filename = `audio.${getFileExtension(mimeType)}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, filename);
    formData.append("model", process.env.TRANSCRIPTION_MODEL || "whisper-1");
    formData.append("response_format", "verbose_json");
    const prompt = options.prompt || (options.language ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}` : "Transcribe the user's voice to text");
    formData.append("prompt", prompt);
    const trimmedBase = providerBase.replace(/\/+$/, "");
    const fullUrl = /\/audio\/transcriptions$/.test(trimmedBase) ? trimmedBase : /\/v1$/.test(trimmedBase) ? `${trimmedBase}/audio/transcriptions` : `${trimmedBase}/v1/audio/transcriptions`;
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${providerKey}`,
        "Accept-Encoding": "identity"
      },
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`
      };
    }
    const whisperResponse = await response.json();
    if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an invalid response format"
      };
    }
    return whisperResponse;
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}
function getFileExtension(mimeType) {
  const mimeToExt = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a"
  };
  return mimeToExt[mimeType] || "audio";
}
function getLanguageName(langCode) {
  const langMap = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "ar": "Arabic",
    "hi": "Hindi",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish"
  };
  return langMap[langCode] || langCode;
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/storage.ts
import fs3 from "node:fs";
import path3 from "node:path";
var LOCAL_STORAGE_DIR2 = path3.resolve(process.cwd(), ".data", "storage");
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) return null;
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "").replace(/\.\.(\/|\\|$)/g, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
function localPath(key) {
  return path3.join(LOCAL_STORAGE_DIR2, key);
}
function mimeFromKey(key) {
  const extension = path3.extname(key).toLowerCase();
  return {
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4"
  }[extension] ?? "application/octet-stream";
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const forge = getForgeConfig();
  if (!forge) {
    const file = localPath(key);
    fs3.mkdirSync(path3.dirname(file), { recursive: true });
    fs3.writeFileSync(file, typeof data === "string" ? Buffer.from(data) : data);
    return { key, url: `/manus-storage/${key}` };
  }
  const presignUrl = new URL("v1/storage/presign/put", forge.forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forge.forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const key = normalizeKey(relKey);
  const forge = getForgeConfig();
  if (!forge) {
    const file = localPath(key);
    if (!fs3.existsSync(file)) throw new Error("Local storage file not found");
    const mime = mimeFromKey(key);
    return `data:${mime};base64,${fs3.readFileSync(file).toString("base64")}`;
  }
  const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forge.forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  return url;
}

// server/routers.ts
var tutorModeSchema = z2.enum(TUTOR_MODES);
var practiceTypeSchema = z2.enum(["vocabulary", "grammar", "rewrite", "writing"]);
var cleanText = z2.string().trim().min(1).max(1800);
function assistantText(response) {
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("The tutor returned an empty response");
  return content.trim();
}
function aiError(error) {
  if (error instanceof TRPCError3) return error;
  console.error("[Learning AI]", error);
  return new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "The AI tutor is temporarily unavailable. Please try again in a moment." });
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true };
    })
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => getProfile2(ctx.user.id)),
    update: protectedProcedure.input(z2.object({
      englishLevel: z2.string().trim().min(2).max(32),
      targetRole: z2.string().trim().min(2).max(120),
      focusAreas: z2.array(z2.string().trim().min(2).max(60)).min(1).max(6),
      dailyGoal: z2.number().int().min(1).max(6)
    })).mutation(({ ctx, input }) => updateProfile2(ctx.user.id, input))
  }),
  tutor: router({
    listConversations: protectedProcedure.query(({ ctx }) => listConversations2(ctx.user.id)),
    getConversation: protectedProcedure.input(z2.object({ conversationId: z2.string().min(8).max(24) })).query(async ({ ctx, input }) => {
      const conversation = await getConversation2(ctx.user.id, input.conversationId);
      if (!conversation) throw new TRPCError3({ code: "NOT_FOUND", message: "This tutor conversation was not found." });
      return conversation;
    }),
    send: protectedProcedure.input(z2.object({
      conversationId: z2.string().min(8).max(24).optional(),
      mode: tutorModeSchema,
      message: cleanText
    })).mutation(async ({ ctx, input }) => {
      try {
        const existing = input.conversationId ? await getConversation2(ctx.user.id, input.conversationId) : void 0;
        if (input.conversationId && !existing) throw new TRPCError3({ code: "NOT_FOUND", message: "This tutor conversation was not found." });
        const conversation = existing?.conversation ?? await createConversation2(ctx.user.id, input.mode, input.message.slice(0, 72));
        await addMessage2(ctx.user.id, conversation.id, "user", input.message);
        const history = await getConversation2(ctx.user.id, conversation.id);
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [{ role: "system", content: tutorSystemPrompt(conversation.mode) }, ...(history?.messages ?? []).slice(-12).map((message) => ({ role: message.role, content: message.content }))]
        });
        const content = assistantText(response);
        await addMessage2(ctx.user.id, conversation.id, "assistant", content);
        return { conversationId: conversation.id, assistantMessage: content };
      } catch (error) {
        throw aiError(error);
      }
    })
  }),
  practice: router({
    submit: protectedProcedure.input(z2.object({ activityType: practiceTypeSchema, prompt: cleanText, response: cleanText })).mutation(async ({ ctx, input }) => {
      try {
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: "You are a careful English coach for IT professionals. Assess one short English-learning exercise. Give fair, practical feedback; do not claim to provide a certification. Return only the requested JSON." },
            { role: "user", content: `Activity type: ${input.activityType}
Prompt: ${input.prompt}
Learner response: ${input.response}` }
          ],
          response_format: { type: "json_schema", json_schema: { name: "practice_feedback", strict: true, schema: {
            type: "object",
            properties: {
              score: { type: "integer", description: "A motivational 0-100 practice score" },
              correction: { type: "string" },
              explanation: { type: "string" },
              naturalAlternative: { type: "string" },
              errorCategories: { type: "array", items: { type: "string" } },
              vocabulary: { type: "array", items: { type: "string" } }
            },
            required: ["score", "correction", "explanation", "naturalAlternative", "errorCategories", "vocabulary"],
            additionalProperties: false
          } } }
        });
        const feedback = parsePracticeFeedback(assistantText(response));
        await savePracticeAttempt2(ctx.user.id, { ...input, feedback });
        return feedback;
      } catch (error) {
        throw aiError(error);
      }
    })
  }),
  career: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const complete = new Set((await getScenarioCompletions2(ctx.user.id)).map((item) => item.scenarioSlug));
      return careerScenarios.map((scenario) => ({ ...scenario, modeLabel: tutorModeLabels[scenario.mode], completed: complete.has(scenario.slug) }));
    }),
    start: protectedProcedure.input(z2.object({ slug: z2.string().min(3).max(80) })).mutation(async ({ ctx, input }) => {
      const scenario = careerScenarios.find((item) => item.slug === input.slug);
      if (!scenario) throw new TRPCError3({ code: "NOT_FOUND", message: "This career scenario was not found." });
      const conversation = await createConversation2(ctx.user.id, scenario.mode, scenario.title, scenario.slug);
      await addMessage2(ctx.user.id, conversation.id, "assistant", `## ${scenario.title}

We will practise this IT communication situation together. I will respond like a supportive colleague or interviewer, then help you improve your English.

**Your first task:** ${scenario.prompt}

Write your first answer when you are ready.`);
      return { conversationId: conversation.id };
    }),
    complete: protectedProcedure.input(z2.object({ slug: z2.string().min(3).max(80), conversationId: z2.string().min(8).max(24) })).mutation(async ({ ctx, input }) => {
      const conversation = await getConversation2(ctx.user.id, input.conversationId);
      if (!conversation || conversation.conversation.scenarioSlug !== input.slug) throw new TRPCError3({ code: "NOT_FOUND", message: "This guided scenario was not found." });
      await completeScenario2(ctx.user.id, input.slug, input.conversationId);
      return { success: true };
    })
  }),
  flashcards: router({
    list: protectedProcedure.query(({ ctx }) => listFlashcards2(ctx.user.id)),
    save: protectedProcedure.input(z2.object({
      term: z2.string().trim().min(2).max(100),
      definition: z2.string().trim().max(500).optional(),
      example: z2.string().trim().max(500).optional(),
      conversationId: z2.string().min(8).max(24).optional()
    })).mutation(async ({ ctx, input }) => {
      if (input.conversationId && !await getConversation2(ctx.user.id, input.conversationId)) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "This tutor conversation was not found." });
      }
      return saveFlashcard2(ctx.user.id, {
        term: input.term,
        definition: input.definition || "Saved from your AI tutor feedback.",
        example: input.example || "Review this term in a sentence from your own IT work.",
        sourceConversationId: input.conversationId
      });
    }),
    markReviewed: protectedProcedure.input(z2.object({ flashcardId: z2.string().min(8).max(24) })).mutation(({ ctx, input }) => markFlashcardReviewed2(ctx.user.id, input.flashcardId))
  }),
  challenge: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const challenge = getDailyChallenge();
      const completion = await getChallengeCompletion2(ctx.user.id, challenge.date);
      return { ...challenge, completed: Boolean(completion), response: completion?.response ?? null };
    }),
    complete: protectedProcedure.input(z2.object({ response: cleanText })).mutation(async ({ ctx, input }) => {
      const challenge = getDailyChallenge();
      await completeDailyChallenge2(ctx.user.id, { challengeDate: challenge.date, challengeId: challenge.id, response: input.response });
      return { success: true, challengeDate: challenge.date };
    })
  }),
  voice: router({
    transcribe: protectedProcedure.input(z2.object({
      conversationId: z2.string().min(8).max(24),
      audioBase64: z2.string().min(32).max(7e6),
      mimeType: z2.enum(supportedAudioMimes)
    })).mutation(async ({ ctx, input }) => {
      const conversation = await getConversation2(ctx.user.id, input.conversationId);
      if (!conversation?.conversation.scenarioSlug) throw new TRPCError3({ code: "BAD_REQUEST", message: "Voice input is available only inside a career role-play." });
      if (!isSupportedAudioMime(input.mimeType)) throw new TRPCError3({ code: "BAD_REQUEST", message: "This audio format is not supported." });
      const audio = Buffer.from(input.audioBase64, "base64");
      if (audio.length === 0 || audio.length > 5 * 1024 * 1024) throw new TRPCError3({ code: "BAD_REQUEST", message: "Please record a response under 5 MB." });
      const extension = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a" };
      try {
        const stored = await storagePut(`${ctx.user.id}/roleplay-audio/${input.conversationId}/response.${extension[input.mimeType]}`, audio, input.mimeType);
        const audioUrl = await storageGetSignedUrl(stored.key);
        const transcription = await transcribeAudio({ audioUrl, language: "en", prompt: "Transcribe a learner practising spoken English for an IT career role-play. Preserve technical terms and punctuation where possible." });
        if ("error" in transcription) throw new TRPCError3({ code: "BAD_REQUEST", message: transcription.error });
        const text2 = transcription.text.trim();
        if (!text2) throw new TRPCError3({ code: "BAD_REQUEST", message: "We could not hear a clear spoken response. Please try again in a quieter space." });
        return { text: text2, duration: transcription.duration, language: transcription.language };
      } catch (error) {
        if (error instanceof TRPCError3) throw error;
        console.error("[Voice transcription]", error);
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Voice transcription is temporarily unavailable. Please try typing your response." });
      }
    })
  }),
  progress: router({ overview: protectedProcedure.query(({ ctx }) => getProgressOverview2(ctx.user.id)) })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      auth: isLocalAuthEnabled() ? "local" : "oauth",
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  registerStorageProxy(app);
  registerLocalAuthRoutes(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

// api/vercel-entry.ts
var vercel_entry_default = createApp();
export {
  vercel_entry_default as default
};
