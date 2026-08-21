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
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
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

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";

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
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
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
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
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
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getProfile(userId) {
  const db = await requireDb();
  const rows = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const profile = { id: nanoid(), userId, englishLevel: "Intermediate", targetRole: "Information Systems Professional", focusAreas: ["Workplace English", "IT Vocabulary"], dailyGoal: 1 };
  await db.insert(learnerProfiles).values(profile);
  const created = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  return created[0];
}
async function updateProfile(userId, values) {
  const db = await requireDb();
  await getProfile(userId);
  await db.update(learnerProfiles).set(values).where(eq(learnerProfiles.userId, userId));
  return getProfile(userId);
}
async function listConversations(userId) {
  const db = await requireDb();
  return db.select().from(tutorConversations).where(eq(tutorConversations.userId, userId)).orderBy(desc(tutorConversations.updatedAt)).limit(30);
}
async function getConversation(userId, conversationId) {
  const db = await requireDb();
  const conversations = await db.select().from(tutorConversations).where(and(eq(tutorConversations.id, conversationId), eq(tutorConversations.userId, userId))).limit(1);
  if (!conversations[0]) return void 0;
  const messages = await db.select().from(tutorMessages).where(and(eq(tutorMessages.conversationId, conversationId), eq(tutorMessages.userId, userId))).orderBy(tutorMessages.createdAt);
  return { conversation: conversations[0], messages };
}
async function createConversation(userId, mode, title, scenarioSlug) {
  const db = await requireDb();
  const conversation = { id: nanoid(), userId, mode, title, scenarioSlug: scenarioSlug ?? null };
  await db.insert(tutorConversations).values(conversation);
  return conversation;
}
async function addMessage(userId, conversationId, role, content) {
  const db = await requireDb();
  await db.insert(tutorMessages).values({ id: nanoid(), userId, conversationId, role, content });
  await db.update(tutorConversations).set({ updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(tutorConversations.id, conversationId), eq(tutorConversations.userId, userId)));
}
async function savePracticeAttempt(userId, input) {
  const db = await requireDb();
  const attempt = {
    id: nanoid(),
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
async function getScenarioCompletions(userId) {
  const db = await requireDb();
  return db.select().from(scenarioCompletions).where(eq(scenarioCompletions.userId, userId));
}
async function completeScenario(userId, scenarioSlug, conversationId) {
  const db = await requireDb();
  await db.insert(scenarioCompletions).values({ id: nanoid(), userId, scenarioSlug, conversationId: conversationId ?? null, completedAt: /* @__PURE__ */ new Date() }).onDuplicateKeyUpdate({ set: { conversationId: conversationId ?? null, completedAt: /* @__PURE__ */ new Date() } });
}
async function listFlashcards(userId) {
  const db = await requireDb();
  return db.select().from(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId)).orderBy(desc(vocabularyFlashcards.createdAt));
}
async function saveFlashcard(userId, input) {
  const db = await requireDb();
  await db.insert(vocabularyFlashcards).values({ id: nanoid(), userId, term: input.term, definition: input.definition, example: input.example, sourceConversationId: input.sourceConversationId ?? null }).onDuplicateKeyUpdate({ set: { definition: input.definition, example: input.example, sourceConversationId: input.sourceConversationId ?? null } });
  const cards = await db.select().from(vocabularyFlashcards).where(and(eq(vocabularyFlashcards.userId, userId), eq(vocabularyFlashcards.term, input.term))).limit(1);
  return cards[0];
}
async function markFlashcardReviewed(userId, flashcardId) {
  const db = await requireDb();
  await db.update(vocabularyFlashcards).set({ reviewedAt: /* @__PURE__ */ new Date() }).where(and(eq(vocabularyFlashcards.id, flashcardId), eq(vocabularyFlashcards.userId, userId)));
}
async function getChallengeCompletion(userId, challengeDate) {
  const db = await requireDb();
  const rows = await db.select().from(dailyChallengeCompletions).where(and(eq(dailyChallengeCompletions.userId, userId), eq(dailyChallengeCompletions.challengeDate, challengeDate))).limit(1);
  return rows[0];
}
async function completeDailyChallenge(userId, input) {
  const db = await requireDb();
  await db.insert(dailyChallengeCompletions).values({ id: nanoid(), userId, ...input, completedAt: /* @__PURE__ */ new Date() }).onDuplicateKeyUpdate({ set: { challengeId: input.challengeId, response: input.response, completedAt: /* @__PURE__ */ new Date() } });
  return getChallengeCompletion(userId, input.challengeDate);
}
async function getProgressOverview(userId) {
  const db = await requireDb();
  const [profile, attempts, completions, challenges, flashcards] = await Promise.all([
    getProfile(userId),
    db.select().from(practiceAttempts).where(eq(practiceAttempts.userId, userId)).orderBy(desc(practiceAttempts.completedAt)),
    db.select().from(scenarioCompletions).where(eq(scenarioCompletions.userId, userId)).orderBy(desc(scenarioCompletions.completedAt)),
    db.select().from(dailyChallengeCompletions).where(eq(dailyChallengeCompletions.userId, userId)).orderBy(desc(dailyChallengeCompletions.completedAt)),
    db.select().from(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId))
  ]);
  const activityDates = [...attempts.map((item) => item.completedAt), ...completions.map((item) => item.completedAt), ...challenges.map((item) => item.completedAt)];
  const errorMap = /* @__PURE__ */ new Map();
  attempts.forEach((item) => item.feedback.errorCategories.forEach((category) => errorMap.set(category, (errorMap.get(category) ?? 0) + 1)));
  const errorCategories = Array.from(errorMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const recentActivity = [
    ...attempts.map((item) => ({ id: item.id, title: `${item.activityType[0].toUpperCase()}${item.activityType.slice(1)} practice completed`, date: item.completedAt, score: item.score, kind: "practice" })),
    ...completions.map((item) => ({ id: item.id, title: "Career scenario completed", date: item.completedAt, score: null, kind: "career" })),
    ...challenges.map((item) => ({ id: item.id, title: "Daily IT-English challenge completed", date: item.completedAt, score: null, kind: "challenge" }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const todaySessions = activityDates.filter((date) => date.toISOString().slice(0, 10) === today).length;
  return {
    dailyGoal: profile.dailyGoal,
    todaySessions,
    streak: calculateStreak(activityDates),
    completedSessions: activityDates.length,
    vocabularyLearned: Math.max(flashcards.length, attempts.filter((item) => item.activityType === "vocabulary" && item.score >= 70).length * 5),
    flashcardsCount: flashcards.length,
    errorCategories,
    recentActivity
  };
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
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
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
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
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
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
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
        appId: ENV.appId,
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
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
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

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
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
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
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
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
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
  assertApiKey();
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
  if (model) {
    payload.model = model;
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
      authorization: `Bearer ${ENV.forgeApiKey}`
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
    if (!ENV.forgeApiUrl) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL is not set"
      };
    }
    if (!ENV.forgeApiKey) {
      return {
        error: "Voice transcription service authentication is missing",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_KEY is not set"
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
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    const prompt = options.prompt || (options.language ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}` : "Transcribe the user's voice to text");
    formData.append("prompt", prompt);
    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    const fullUrl = new URL(
      "v1/audio/transcriptions",
      baseUrl
    ).toString();
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
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
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
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
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
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
    get: protectedProcedure.query(({ ctx }) => getProfile(ctx.user.id)),
    update: protectedProcedure.input(z2.object({
      englishLevel: z2.string().trim().min(2).max(32),
      targetRole: z2.string().trim().min(2).max(120),
      focusAreas: z2.array(z2.string().trim().min(2).max(60)).min(1).max(6),
      dailyGoal: z2.number().int().min(1).max(6)
    })).mutation(({ ctx, input }) => updateProfile(ctx.user.id, input))
  }),
  tutor: router({
    listConversations: protectedProcedure.query(({ ctx }) => listConversations(ctx.user.id)),
    getConversation: protectedProcedure.input(z2.object({ conversationId: z2.string().min(8).max(24) })).query(async ({ ctx, input }) => {
      const conversation = await getConversation(ctx.user.id, input.conversationId);
      if (!conversation) throw new TRPCError3({ code: "NOT_FOUND", message: "This tutor conversation was not found." });
      return conversation;
    }),
    send: protectedProcedure.input(z2.object({
      conversationId: z2.string().min(8).max(24).optional(),
      mode: tutorModeSchema,
      message: cleanText
    })).mutation(async ({ ctx, input }) => {
      try {
        const existing = input.conversationId ? await getConversation(ctx.user.id, input.conversationId) : void 0;
        if (input.conversationId && !existing) throw new TRPCError3({ code: "NOT_FOUND", message: "This tutor conversation was not found." });
        const conversation = existing?.conversation ?? await createConversation(ctx.user.id, input.mode, input.message.slice(0, 72));
        await addMessage(ctx.user.id, conversation.id, "user", input.message);
        const history = await getConversation(ctx.user.id, conversation.id);
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [{ role: "system", content: tutorSystemPrompt(conversation.mode) }, ...(history?.messages ?? []).slice(-12).map((message) => ({ role: message.role, content: message.content }))]
        });
        const content = assistantText(response);
        await addMessage(ctx.user.id, conversation.id, "assistant", content);
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
        await savePracticeAttempt(ctx.user.id, { ...input, feedback });
        return feedback;
      } catch (error) {
        throw aiError(error);
      }
    })
  }),
  career: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const complete = new Set((await getScenarioCompletions(ctx.user.id)).map((item) => item.scenarioSlug));
      return careerScenarios.map((scenario) => ({ ...scenario, modeLabel: tutorModeLabels[scenario.mode], completed: complete.has(scenario.slug) }));
    }),
    start: protectedProcedure.input(z2.object({ slug: z2.string().min(3).max(80) })).mutation(async ({ ctx, input }) => {
      const scenario = careerScenarios.find((item) => item.slug === input.slug);
      if (!scenario) throw new TRPCError3({ code: "NOT_FOUND", message: "This career scenario was not found." });
      const conversation = await createConversation(ctx.user.id, scenario.mode, scenario.title, scenario.slug);
      await addMessage(ctx.user.id, conversation.id, "assistant", `## ${scenario.title}

We will practise this IT communication situation together. I will respond like a supportive colleague or interviewer, then help you improve your English.

**Your first task:** ${scenario.prompt}

Write your first answer when you are ready.`);
      return { conversationId: conversation.id };
    }),
    complete: protectedProcedure.input(z2.object({ slug: z2.string().min(3).max(80), conversationId: z2.string().min(8).max(24) })).mutation(async ({ ctx, input }) => {
      const conversation = await getConversation(ctx.user.id, input.conversationId);
      if (!conversation || conversation.conversation.scenarioSlug !== input.slug) throw new TRPCError3({ code: "NOT_FOUND", message: "This guided scenario was not found." });
      await completeScenario(ctx.user.id, input.slug, input.conversationId);
      return { success: true };
    })
  }),
  flashcards: router({
    list: protectedProcedure.query(({ ctx }) => listFlashcards(ctx.user.id)),
    save: protectedProcedure.input(z2.object({
      term: z2.string().trim().min(2).max(100),
      definition: z2.string().trim().max(500).optional(),
      example: z2.string().trim().max(500).optional(),
      conversationId: z2.string().min(8).max(24).optional()
    })).mutation(async ({ ctx, input }) => {
      if (input.conversationId && !await getConversation(ctx.user.id, input.conversationId)) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "This tutor conversation was not found." });
      }
      return saveFlashcard(ctx.user.id, {
        term: input.term,
        definition: input.definition || "Saved from your AI tutor feedback.",
        example: input.example || "Review this term in a sentence from your own IT work.",
        sourceConversationId: input.conversationId
      });
    }),
    markReviewed: protectedProcedure.input(z2.object({ flashcardId: z2.string().min(8).max(24) })).mutation(({ ctx, input }) => markFlashcardReviewed(ctx.user.id, input.flashcardId))
  }),
  challenge: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const challenge = getDailyChallenge();
      const completion = await getChallengeCompletion(ctx.user.id, challenge.date);
      return { ...challenge, completed: Boolean(completion), response: completion?.response ?? null };
    }),
    complete: protectedProcedure.input(z2.object({ response: cleanText })).mutation(async ({ ctx, input }) => {
      const challenge = getDailyChallenge();
      await completeDailyChallenge(ctx.user.id, { challengeDate: challenge.date, challengeId: challenge.id, response: input.response });
      return { success: true, challengeDate: challenge.date };
    })
  }),
  voice: router({
    transcribe: protectedProcedure.input(z2.object({
      conversationId: z2.string().min(8).max(24),
      audioBase64: z2.string().min(32).max(7e6),
      mimeType: z2.enum(supportedAudioMimes)
    })).mutation(async ({ ctx, input }) => {
      const conversation = await getConversation(ctx.user.id, input.conversationId);
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
  progress: router({ overview: protectedProcedure.query(({ ctx }) => getProgressOverview(ctx.user.id)) })
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
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

// api/vercel-entry.ts
var vercel_entry_default = createApp();
export {
  vercel_entry_default as default
};
