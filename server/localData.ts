import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import { nanoid } from "nanoid";
import type {
  DailyChallengeCompletion,
  InsertUser,
  LearnerProfile,
  PracticeAttempt,
  ScenarioCompletion,
  TutorConversation,
  TutorMessage,
  User,
  UserSession,
  VocabularyFlashcard,
} from "../drizzle/schema";
import {
  buildProgressOverview,
  type PracticeFeedback,
  type PracticeType,
  type TutorMode,
} from "./learning";

type LocalState = {
  version: 2;
  nextUserId: number;
  users: User[];
  userSessions: UserSession[];
  learnerProfiles: LearnerProfile[];
  tutorConversations: TutorConversation[];
  tutorMessages: TutorMessage[];
  practiceAttempts: PracticeAttempt[];
  scenarioCompletions: ScenarioCompletion[];
  vocabularyFlashcards: VocabularyFlashcard[];
  dailyChallengeCompletions: DailyChallengeCompletion[];
};

const DEFAULT_FILE = path.resolve(process.cwd(), ".data", "local-db.json");
const dataFile = () => process.env.LOCAL_DATA_FILE?.trim() || DEFAULT_FILE;

const REDIS_URL =
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const REDIS_NAMESPACE =
  process.env.LOCAL_DATA_REDIS_PREFIX?.trim() ||
  `english-career-coach:${process.env.VERCEL_ENV ?? "local"}`;
const STATE_KEY = `${REDIS_NAMESPACE}:state`;
const LOCK_KEY = `${REDIS_NAMESPACE}:lock`;
const LOCK_TTL_MS = 20_000;
const LOCK_TIMEOUT_MS = 10_000;

/**
 * Production deployments use Upstash Redis so data survives serverless cold
 * starts and concurrent instances can serialise writes. Local development and
 * tests keep using the JSON file unless Redis is explicitly requested with
 * `LOCAL_DATA=redis`.
 */
export function usesRedisStorage() {
  if (process.env.LOCAL_DATA === "file") return false;
  if (process.env.LOCAL_DATA === "redis") return true;
  return Boolean(REDIS_URL && REDIS_TOKEN) && process.env.NODE_ENV === "production";
}

export function getStorageMode(): "file" | "redis" {
  return usesRedisStorage() ? "redis" : "file";
}

let redisClient: Redis | null = null;

function getRedis() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error(
      "Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN, or use LOCAL_DATA=file."
    );
  }
  if (!redisClient) {
    redisClient = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  }
  return redisClient;
}

let fileState: LocalState | null = null;

function emptyState(): LocalState {
  return {
    version: 2,
    nextUserId: 1,
    users: [],
    userSessions: [],
    learnerProfiles: [],
    tutorConversations: [],
    tutorMessages: [],
    practiceAttempts: [],
    scenarioCompletions: [],
    vocabularyFlashcards: [],
    dailyChallengeCompletions: [],
  };
}

const asDate = (value: Date | string | null | undefined) =>
  value == null ? value : value instanceof Date ? value : new Date(value);

/**
 * JSON transport turns dates into strings. Normalise every persisted collection
 * once, whether it came from the local file or from Redis.
 */
function normalizeState(raw: Partial<LocalState>): LocalState {
  return {
    ...emptyState(),
    ...raw,
    version: 2,
    users: (raw.users ?? []).map(user => ({
      ...user,
      passwordHash: user.passwordHash ?? null,
      status: user.status ?? "active",
      createdAt: asDate(user.createdAt)!,
      updatedAt: asDate(user.updatedAt)!,
      lastSignedIn: asDate(user.lastSignedIn)!,
    })),
    userSessions: (raw.userSessions ?? []).map(session => ({
      ...session,
      createdAt: asDate(session.createdAt)!,
      lastSeenAt: asDate(session.lastSeenAt)!,
      expiresAt: asDate(session.expiresAt)!,
    })),
    learnerProfiles: (raw.learnerProfiles ?? []).map(profile => ({
      ...profile,
      createdAt: asDate(profile.createdAt)!,
      updatedAt: asDate(profile.updatedAt)!,
    })),
    tutorConversations: (raw.tutorConversations ?? []).map(conversation => ({
      ...conversation,
      createdAt: asDate(conversation.createdAt)!,
      updatedAt: asDate(conversation.updatedAt)!,
    })),
    tutorMessages: (raw.tutorMessages ?? []).map(message => ({
      ...message,
      createdAt: asDate(message.createdAt)!,
    })),
    practiceAttempts: (raw.practiceAttempts ?? []).map(attempt => ({
      ...attempt,
      completedAt: asDate(attempt.completedAt)!,
    })),
    scenarioCompletions: (raw.scenarioCompletions ?? []).map(completion => ({
      ...completion,
      completedAt: asDate(completion.completedAt)!,
    })),
    vocabularyFlashcards: (raw.vocabularyFlashcards ?? []).map(card => ({
      ...card,
      createdAt: asDate(card.createdAt)!,
      reviewedAt: asDate(card.reviewedAt) ?? null,
    })),
    dailyChallengeCompletions: (raw.dailyChallengeCompletions ?? []).map(completion => ({
      ...completion,
      completedAt: asDate(completion.completedAt)!,
    })),
  };
}

function loadFileState(): LocalState {
  if (fileState) return fileState;

  const file = dataFile();
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as LocalState;
      fileState = normalizeState(raw);
      return fileState;
    }
  } catch (error) {
    console.warn("[LocalData] Could not read local database, starting fresh:", error);
  }

  fileState = emptyState();
  return fileState;
}

function saveFileState() {
  const current = loadFileState();
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

async function loadRedisState(): Promise<LocalState> {
  const raw = await getRedis().get<Partial<LocalState>>(STATE_KEY);
  if (!raw) return emptyState();
  return normalizeState(raw);
}

async function readState(): Promise<LocalState> {
  if (usesRedisStorage()) return loadRedisState();
  return loadFileState();
}

type WorkResult<T> = { result: T; changed: boolean };

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

async function withRedisLock<T>(work: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  const token = nanoid(24);
  const startedAt = Date.now();
  let acquired = false;

  while (!acquired) {
    const result = await redis.set(LOCK_KEY, token, { nx: true, px: LOCK_TTL_MS });
    if (result === "OK") {
      acquired = true;
      break;
    }
    if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
      throw new Error("The database is busy. Please try again.");
    }
    await new Promise(resolve => setTimeout(resolve, 35 + Math.floor(Math.random() * 60)));
  }

  try {
    return await work();
  } finally {
    try {
      await redis.eval(RELEASE_LOCK_SCRIPT, [LOCK_KEY], [token]);
    } catch (error) {
      // The lock expires on its own; never mask the operation result.
      console.warn("[LocalData] Could not release the Redis lock:", error);
    }
  }
}

/**
 * Apply a change to the whole document. Redis mode holds a short-lived lock so
 * read-modify-write cycles from different serverless instances cannot silently
 * overwrite each other.
 */
async function transaction<T>(work: (state: LocalState) => WorkResult<T>): Promise<T> {
  if (usesRedisStorage()) {
    return withRedisLock(async () => {
      const state = await loadRedisState();
      const { result, changed } = work(state);
      if (changed) await getRedis().set(STATE_KEY, state);
      return result;
    });
  }

  const state = loadFileState();
  const { result, changed } = work(state);
  if (changed) saveFileState();
  return result;
}

function ensureProfile(state: LocalState, userId: number) {
  const existing = state.learnerProfiles.find(profile => profile.userId === userId);
  if (existing) return { profile: existing, created: false };

  const now = new Date();
  const profile: LearnerProfile = {
    id: nanoid(),
    userId,
    englishLevel: "Intermediate",
    targetRole: "Information Systems Professional",
    focusAreas: ["Workplace English", "IT Vocabulary"],
    dailyGoal: 1,
    createdAt: now,
    updatedAt: now,
  };
  state.learnerProfiles.push(profile);
  return { profile, created: true };
}

export function getLocalDataFile() {
  return dataFile();
}

/** Test-only helper: forget cached state and remove the temporary data file. */
export async function resetLocalDataForTests() {
  fileState = null;
  try {
    fs.rmSync(dataFile(), { force: true });
  } catch {
    // Ignore cleanup failures in test environments.
  }
}

export async function upsertUser(user: InsertUser): Promise<User> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  return transaction(state => {
    const now = new Date();
    const existing = state.users.find(item => item.openId === user.openId);

    if (existing) {
      if (user.name !== undefined) existing.name = user.name ?? null;
      if (user.email !== undefined) existing.email = user.email ?? null;
      if (user.passwordHash !== undefined) existing.passwordHash = user.passwordHash ?? null;
      if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
      if (user.role !== undefined) existing.role = user.role;
      if (user.status !== undefined) existing.status = user.status;
      existing.lastSignedIn = user.lastSignedIn ?? now;
      existing.updatedAt = now;
      return { result: existing, changed: true };
    }

    const created: User = {
      id: state.nextUserId++,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      passwordHash: user.passwordHash ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? "user",
      status: user.status ?? "active",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: user.lastSignedIn ?? now,
    };
    state.users.push(created);
    return { result: created, changed: true };
  });
}

export async function getUserByOpenId(openId: string) {
  return (await readState()).users.find(user => user.openId === openId);
}

export async function getUserById(id: number) {
  return (await readState()).users.find(user => user.id === id);
}

export async function getUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return (await readState()).users.find(
    user => user.email?.trim().toLowerCase() === normalized
  );
}

export async function updateUserAccount(
  userId: number,
  values: { name: string; email: string }
) {
  return transaction(state => {
    const user = state.users.find(item => item.id === userId);
    if (!user) return { result: undefined, changed: false };

    const email = values.email.trim().toLowerCase();
    const duplicate = state.users.find(
      item => item.id !== userId && item.email?.trim().toLowerCase() === email
    );
    if (duplicate) throw new Error("That email address is already in use.");

    user.name = values.name.trim();
    user.email = email;
    user.updatedAt = new Date();
    return { result: user, changed: true };
  });
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  return transaction(state => {
    const user = state.users.find(item => item.id === userId);
    if (!user) return { result: undefined, changed: false };
    user.passwordHash = passwordHash;
    user.updatedAt = new Date();
    return { result: user, changed: true };
  });
}

export async function deleteUserAccount(userId: number) {
  return transaction(state => {
    const exists = state.users.some(user => user.id === userId);
    if (!exists) return { result: false, changed: false };

    state.users = state.users.filter(user => user.id !== userId);
    state.userSessions = state.userSessions.filter(session => session.userId !== userId);
    state.learnerProfiles = state.learnerProfiles.filter(profile => profile.userId !== userId);
    const conversationIds = new Set(
      state.tutorConversations
        .filter(conversation => conversation.userId === userId)
        .map(conversation => conversation.id)
    );
    state.tutorConversations = state.tutorConversations.filter(
      conversation => conversation.userId !== userId
    );
    state.tutorMessages = state.tutorMessages.filter(
      message => message.userId !== userId && !conversationIds.has(message.conversationId)
    );
    state.practiceAttempts = state.practiceAttempts.filter(attempt => attempt.userId !== userId);
    state.scenarioCompletions = state.scenarioCompletions.filter(
      completion => completion.userId !== userId
    );
    state.vocabularyFlashcards = state.vocabularyFlashcards.filter(
      card => card.userId !== userId
    );
    state.dailyChallengeCompletions = state.dailyChallengeCompletions.filter(
      completion => completion.userId !== userId
    );
    return { result: true, changed: true };
  });
}

export async function countPasswordAccounts() {
  return (await readState()).users.filter(user => user.loginMethod === "password").length;
}

export async function listAllUsers() {
  return [...(await readState()).users].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export async function countActiveAdmins() {
  return (await readState()).users.filter(
    user => user.role === "admin" && user.status === "active"
  ).length;
}

export async function updateUserModeration(
  userId: number,
  values: { role?: "user" | "admin"; status?: "active" | "disabled" }
) {
  return transaction(state => {
    const user = state.users.find(item => item.id === userId);
    if (!user) return { result: undefined, changed: false };
    if (values.role !== undefined) user.role = values.role;
    if (values.status !== undefined) user.status = values.status;
    user.updatedAt = new Date();
    return { result: user, changed: true };
  });
}

export async function countActiveSessions(userId: number) {
  return (await listSessions(userId)).length;
}

export async function createSession(session: UserSession) {
  return transaction(state => {
    const now = Date.now();
    state.userSessions = state.userSessions.filter(
      item => item.expiresAt.getTime() > now
    );
    state.userSessions.push(session);
    return { result: session, changed: true };
  });
}

export async function getSession(sessionId: string) {
  const session = (await readState()).userSessions.find(item => item.id === sessionId);
  if (!session) return undefined;
  if (session.expiresAt.getTime() <= Date.now()) return undefined;
  return session;
}

export async function listSessions(userId: number) {
  return (await readState()).userSessions
    .filter(
      session => session.userId === userId && session.expiresAt.getTime() > Date.now()
    )
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}

export async function touchSession(sessionId: string, lastSeenAt: Date) {
  return transaction(state => {
    const session = state.userSessions.find(item => item.id === sessionId);
    if (!session) return { result: undefined, changed: false };
    session.lastSeenAt = lastSeenAt;
    return { result: session, changed: true };
  });
}

export async function revokeSession(userId: number, sessionId: string) {
  return transaction(state => {
    const before = state.userSessions.length;
    state.userSessions = state.userSessions.filter(
      session => !(session.id === sessionId && session.userId === userId)
    );
    const removed = state.userSessions.length !== before;
    return { result: removed, changed: removed };
  });
}

export async function revokeOtherSessions(userId: number, keepSessionId?: string) {
  return transaction(state => {
    const before = state.userSessions.length;
    state.userSessions = state.userSessions.filter(
      session =>
        session.userId !== userId ||
        (keepSessionId !== undefined && session.id === keepSessionId)
    );
    const removed = before - state.userSessions.length;
    return { result: removed, changed: removed > 0 };
  });
}

export async function revokeAllSessions(userId: number) {
  return revokeOtherSessions(userId);
}

export async function getProfile(userId: number): Promise<LearnerProfile> {
  return transaction(state => {
    const { profile, created } = ensureProfile(state, userId);
    return { result: profile, changed: created };
  });
}

export async function updateProfile(
  userId: number,
  values: { englishLevel: string; targetRole: string; focusAreas: string[]; dailyGoal: number }
) {
  return transaction(state => {
    const { profile } = ensureProfile(state, userId);
    Object.assign(profile, values, { updatedAt: new Date() });
    return { result: profile, changed: true };
  });
}

export async function listConversations(userId: number) {
  return (await readState()).tutorConversations
    .filter(conversation => conversation.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 30);
}

export async function getConversation(userId: number, conversationId: string) {
  const state = await readState();
  const conversation = state.tutorConversations.find(
    item => item.id === conversationId && item.userId === userId
  );
  if (!conversation) return undefined;
  const messages = state.tutorMessages
    .filter(message => message.conversationId === conversationId && message.userId === userId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return { conversation, messages };
}

export async function createConversation(
  userId: number,
  mode: TutorMode,
  title: string,
  scenarioSlug?: string
): Promise<TutorConversation> {
  const now = new Date();
  const conversation: TutorConversation = {
    id: nanoid(),
    userId,
    mode,
    title,
    scenarioSlug: scenarioSlug ?? null,
    createdAt: now,
    updatedAt: now,
  };
  return transaction(state => {
    state.tutorConversations.push(conversation);
    return { result: conversation, changed: true };
  });
}

export async function addMessage(
  userId: number,
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  const message: TutorMessage = {
    id: nanoid(),
    conversationId,
    userId,
    role,
    content,
    createdAt: new Date(),
  };
  return transaction(state => {
    state.tutorMessages.push(message);
    const conversation = state.tutorConversations.find(
      item => item.id === conversationId && item.userId === userId
    );
    if (conversation) conversation.updatedAt = new Date();
    return { result: message, changed: true };
  });
}

export async function savePracticeAttempt(
  userId: number,
  input: { activityType: PracticeType; prompt: string; response: string; feedback: PracticeFeedback }
): Promise<PracticeAttempt> {
  const attempt: PracticeAttempt = {
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
      vocabulary: input.feedback.vocabulary,
    },
    completedAt: new Date(),
  };
  return transaction(state => {
    state.practiceAttempts.push(attempt);
    return { result: attempt, changed: true };
  });
}

export async function getScenarioCompletions(userId: number) {
  return (await readState()).scenarioCompletions.filter(
    completion => completion.userId === userId
  );
}

export async function completeScenario(
  userId: number,
  scenarioSlug: string,
  conversationId?: string
) {
  return transaction(state => {
    const now = new Date();
    const existing = state.scenarioCompletions.find(
      completion => completion.userId === userId && completion.scenarioSlug === scenarioSlug
    );
    if (existing) {
      existing.conversationId = conversationId ?? null;
      existing.completedAt = now;
      return { result: existing, changed: true };
    }
    const completion: ScenarioCompletion = {
      id: nanoid(),
      userId,
      scenarioSlug,
      conversationId: conversationId ?? null,
      completedAt: now,
    };
    state.scenarioCompletions.push(completion);
    return { result: completion, changed: true };
  });
}

export async function listFlashcards(userId: number) {
  return (await readState()).vocabularyFlashcards
    .filter(card => card.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function saveFlashcard(
  userId: number,
  input: { term: string; definition: string; example: string; sourceConversationId?: string }
): Promise<VocabularyFlashcard> {
  return transaction(state => {
    const normalised = input.term.trim().toLowerCase();
    const existing = state.vocabularyFlashcards.find(
      card => card.userId === userId && card.term.trim().toLowerCase() === normalised
    );
    if (existing) {
      existing.definition = input.definition;
      existing.example = input.example;
      existing.sourceConversationId = input.sourceConversationId ?? null;
      return { result: existing, changed: true };
    }
    const card: VocabularyFlashcard = {
      id: nanoid(),
      userId,
      term: input.term,
      definition: input.definition,
      example: input.example,
      sourceConversationId: input.sourceConversationId ?? null,
      createdAt: new Date(),
      reviewedAt: null,
    };
    state.vocabularyFlashcards.push(card);
    return { result: card, changed: true };
  });
}

export async function markFlashcardReviewed(userId: number, flashcardId: string) {
  return transaction(state => {
    const card = state.vocabularyFlashcards.find(
      item => item.id === flashcardId && item.userId === userId
    );
    if (!card) return { result: undefined, changed: false };
    card.reviewedAt = new Date();
    return { result: card, changed: true };
  });
}

export async function getChallengeCompletion(userId: number, challengeDate: string) {
  return (await readState()).dailyChallengeCompletions.find(
    completion => completion.userId === userId && completion.challengeDate === challengeDate
  );
}

export async function completeDailyChallenge(
  userId: number,
  input: { challengeDate: string; challengeId: string; response: string }
) {
  return transaction(state => {
    const existing = state.dailyChallengeCompletions.find(
      completion =>
        completion.userId === userId && completion.challengeDate === input.challengeDate
    );
    if (existing) {
      existing.challengeId = input.challengeId;
      existing.response = input.response;
      existing.completedAt = new Date();
      return { result: existing, changed: true };
    }
    const completion: DailyChallengeCompletion = {
      id: nanoid(),
      userId,
      challengeDate: input.challengeDate,
      challengeId: input.challengeId,
      response: input.response,
      completedAt: new Date(),
    };
    state.dailyChallengeCompletions.push(completion);
    return { result: completion, changed: true };
  });
}

export async function getProgressOverview(userId: number) {
  return transaction(state => {
    const { profile, created } = ensureProfile(state, userId);
    const overview = buildProgressOverview({
      dailyGoal: profile.dailyGoal,
      attempts: state.practiceAttempts.filter(attempt => attempt.userId === userId),
      completions: state.scenarioCompletions.filter(
        completion => completion.userId === userId
      ),
      challenges: state.dailyChallengeCompletions.filter(
        completion => completion.userId === userId
      ),
      flashcards: state.vocabularyFlashcards.filter(card => card.userId === userId),
    });
    return { result: overview, changed: created };
  });
}
