import { and, desc, eq, lte, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  dailyChallengeCompletions,
  InsertUser,
  learnerProfiles,
  practiceAttempts,
  scenarioCompletions,
  tutorConversations,
  tutorMessages,
  userSessions,
  users,
  vocabularyFlashcards,
} from "../drizzle/schema";
import type { UserSession } from "../drizzle/schema";
import { buildProgressOverview, PracticeFeedback, PracticeType, TutorMode } from "./learning";
import { ENV } from "./_core/env";
import * as localData from "./localData";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Local mode keeps the app fully usable without external credentials. It is
 * enabled by `LOCAL_DATA=true`, automatically outside production when no MySQL
 * `DATABASE_URL` is configured, or in production when Upstash Redis is attached.
 * Redis keeps the JSON document durable across serverless instances; a missing
 * database or Redis store still fails loudly instead of silently writing to an
 * ephemeral filesystem.
 */
function usesLocalData() {
  return (
    !process.env.DATABASE_URL &&
    (process.env.LOCAL_DATA === "true" ||
      process.env.NODE_ENV !== "production" ||
      localData.usesRedisStorage())
  );
}

export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  if (usesLocalData()) {
    await localData.upsertUser(user);
    return;
  }
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "passwordHash", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.status !== undefined) {
    values.status = user.status;
    updateSet.status = user.status;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  if (usesLocalData()) return localData.getUserByOpenId(openId);
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  if (usesLocalData()) return localData.getUserById(id);
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  if (usesLocalData()) return localData.getUserByEmail(email);
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return result[0];
}

export async function updateUserAccount(userId: number, values: { name: string; email: string }) {
  if (usesLocalData()) return localData.updateUserAccount(userId, values);
  const db = await requireDb();
  const email = values.email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0] && existing[0].id !== userId) {
    throw new Error("That email address is already in use.");
  }
  await db
    .update(users)
    .set({ name: values.name.trim(), email })
    .where(eq(users.id, userId));
  return getUserById(userId);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  if (usesLocalData()) return localData.updateUserPassword(userId, passwordHash);
  const db = await requireDb();
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function deleteUserAccount(userId: number) {
  if (usesLocalData()) return localData.deleteUserAccount(userId);
  const db = await requireDb();
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
  await db.delete(tutorMessages).where(eq(tutorMessages.userId, userId));
  await db.delete(tutorConversations).where(eq(tutorConversations.userId, userId));
  await db.delete(learnerProfiles).where(eq(learnerProfiles.userId, userId));
  await db.delete(practiceAttempts).where(eq(practiceAttempts.userId, userId));
  await db.delete(scenarioCompletions).where(eq(scenarioCompletions.userId, userId));
  await db.delete(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId));
  await db.delete(dailyChallengeCompletions).where(eq(dailyChallengeCompletions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  return true;
}

export async function createSession(session: UserSession) {
  if (usesLocalData()) return localData.createSession(session);
  const db = await requireDb();
  await db.delete(userSessions).where(lte(userSessions.expiresAt, new Date()));
  await db.insert(userSessions).values(session);
  return session;
}

export async function getSession(sessionId: string) {
  if (usesLocalData()) return localData.getSession(sessionId);
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.id, sessionId))
    .limit(1);
  const session = result[0];
  if (!session || session.expiresAt.getTime() <= Date.now()) return undefined;
  return session;
}

export async function listSessions(userId: number) {
  if (usesLocalData()) return localData.listSessions(userId);
  const db = await requireDb();
  const rows = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(desc(userSessions.lastSeenAt));
  return rows.filter(session => session.expiresAt.getTime() > Date.now());
}

export async function touchSession(sessionId: string, lastSeenAt: Date) {
  if (usesLocalData()) return localData.touchSession(sessionId, lastSeenAt);
  const db = await getDb();
  if (!db) return;
  await db
    .update(userSessions)
    .set({ lastSeenAt })
    .where(eq(userSessions.id, sessionId));
}

export async function revokeSession(userId: number, sessionId: string) {
  if (usesLocalData()) return localData.revokeSession(userId, sessionId);
  const db = await requireDb();
  await db
    .delete(userSessions)
    .where(and(eq(userSessions.userId, userId), eq(userSessions.id, sessionId)));
  return true;
}

export async function revokeOtherSessions(userId: number, keepSessionId?: string) {
  if (usesLocalData()) return localData.revokeOtherSessions(userId, keepSessionId);
  const db = await requireDb();
  await db
    .delete(userSessions)
    .where(
      keepSessionId
        ? and(eq(userSessions.userId, userId), ne(userSessions.id, keepSessionId))
        : eq(userSessions.userId, userId)
    );
  return true;
}

export async function revokeAllSessions(userId: number) {
  if (usesLocalData()) return localData.revokeAllSessions(userId);
  const db = await requireDb();
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
  return true;
}

export async function countPasswordAccounts() {
  if (usesLocalData()) return localData.countPasswordAccounts();
  const db = await requireDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.loginMethod, "password"));
  return rows.length;
}

export async function listAllUsers() {
  if (usesLocalData()) return localData.listAllUsers();
  const db = await requireDb();
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function countActiveAdmins() {
  if (usesLocalData()) return localData.countActiveAdmins();
  const db = await requireDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));
  return rows.length;
}

export async function updateUserModeration(
  userId: number,
  values: { role?: "user" | "admin"; status?: "active" | "disabled" }
) {
  if (usesLocalData()) return localData.updateUserModeration(userId, values);
  const db = await requireDb();
  const updateSet: { role?: "user" | "admin"; status?: "active" | "disabled" } = {};
  if (values.role !== undefined) updateSet.role = values.role;
  if (values.status !== undefined) updateSet.status = values.status;
  await db.update(users).set(updateSet).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function countActiveSessions(userId: number) {
  if (usesLocalData()) return localData.countActiveSessions(userId);
  const db = await requireDb();
  const rows = await db
    .select({ id: userSessions.id, expiresAt: userSessions.expiresAt })
    .from(userSessions)
    .where(eq(userSessions.userId, userId));
  return rows.filter(row => row.expiresAt.getTime() > Date.now()).length;
}

export async function getProfile(userId: number) {
  if (usesLocalData()) return localData.getProfile(userId);
  const db = await requireDb();
  const rows = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const profile = { id: nanoid(), userId, englishLevel: "Intermediate", targetRole: "Information Systems Professional", focusAreas: ["Workplace English", "IT Vocabulary"], dailyGoal: 1 };
  await db.insert(learnerProfiles).values(profile);
  const created = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  return created[0]!;
}

export async function updateProfile(userId: number, values: { englishLevel: string; targetRole: string; focusAreas: string[]; dailyGoal: number }) {
  if (usesLocalData()) return localData.updateProfile(userId, values);
  const db = await requireDb();
  await getProfile(userId);
  await db.update(learnerProfiles).set(values).where(eq(learnerProfiles.userId, userId));
  return getProfile(userId);
}

export async function listConversations(userId: number) {
  if (usesLocalData()) return localData.listConversations(userId);
  const db = await requireDb();
  return db.select().from(tutorConversations).where(eq(tutorConversations.userId, userId)).orderBy(desc(tutorConversations.updatedAt)).limit(30);
}

export async function getConversation(userId: number, conversationId: string) {
  if (usesLocalData()) return localData.getConversation(userId, conversationId);
  const db = await requireDb();
  const conversations = await db.select().from(tutorConversations).where(and(eq(tutorConversations.id, conversationId), eq(tutorConversations.userId, userId))).limit(1);
  if (!conversations[0]) return undefined;
  const messages = await db.select().from(tutorMessages).where(and(eq(tutorMessages.conversationId, conversationId), eq(tutorMessages.userId, userId))).orderBy(tutorMessages.createdAt);
  return { conversation: conversations[0], messages };
}

export async function createConversation(userId: number, mode: TutorMode, title: string, scenarioSlug?: string) {
  if (usesLocalData()) return localData.createConversation(userId, mode, title, scenarioSlug);
  const db = await requireDb();
  const conversation = { id: nanoid(), userId, mode, title, scenarioSlug: scenarioSlug ?? null };
  await db.insert(tutorConversations).values(conversation);
  return conversation;
}

export async function addMessage(userId: number, conversationId: string, role: "user" | "assistant", content: string) {
  if (usesLocalData()) return localData.addMessage(userId, conversationId, role, content);
  const db = await requireDb();
  await db.insert(tutorMessages).values({ id: nanoid(), userId, conversationId, role, content });
  await db.update(tutorConversations).set({ updatedAt: new Date() }).where(and(eq(tutorConversations.id, conversationId), eq(tutorConversations.userId, userId)));
}

export async function savePracticeAttempt(userId: number, input: { activityType: PracticeType; prompt: string; response: string; feedback: PracticeFeedback }) {
  if (usesLocalData()) return localData.savePracticeAttempt(userId, input);
  const db = await requireDb();
  const attempt = {
    id: nanoid(), userId, activityType: input.activityType, prompt: input.prompt, response: input.response, score: input.feedback.score,
    feedback: { correction: input.feedback.correction, explanation: input.feedback.explanation, naturalAlternative: input.feedback.naturalAlternative, errorCategories: input.feedback.errorCategories, vocabulary: input.feedback.vocabulary },
  };
  await db.insert(practiceAttempts).values(attempt);
  return attempt;
}

export async function getScenarioCompletions(userId: number) {
  if (usesLocalData()) return localData.getScenarioCompletions(userId);
  const db = await requireDb();
  return db.select().from(scenarioCompletions).where(eq(scenarioCompletions.userId, userId));
}

export async function completeScenario(userId: number, scenarioSlug: string, conversationId?: string) {
  if (usesLocalData()) return localData.completeScenario(userId, scenarioSlug, conversationId);
  const db = await requireDb();
  await db.insert(scenarioCompletions).values({ id: nanoid(), userId, scenarioSlug, conversationId: conversationId ?? null, completedAt: new Date() }).onDuplicateKeyUpdate({ set: { conversationId: conversationId ?? null, completedAt: new Date() } });
}

export async function listFlashcards(userId: number) {
  if (usesLocalData()) return localData.listFlashcards(userId);
  const db = await requireDb();
  return db.select().from(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId)).orderBy(desc(vocabularyFlashcards.createdAt));
}

export async function saveFlashcard(userId: number, input: { term: string; definition: string; example: string; sourceConversationId?: string }) {
  if (usesLocalData()) return localData.saveFlashcard(userId, input);
  const db = await requireDb();
  await db.insert(vocabularyFlashcards).values({ id: nanoid(), userId, term: input.term, definition: input.definition, example: input.example, sourceConversationId: input.sourceConversationId ?? null }).onDuplicateKeyUpdate({ set: { definition: input.definition, example: input.example, sourceConversationId: input.sourceConversationId ?? null } });
  const cards = await db.select().from(vocabularyFlashcards).where(and(eq(vocabularyFlashcards.userId, userId), eq(vocabularyFlashcards.term, input.term))).limit(1);
  return cards[0]!;
}

export async function markFlashcardReviewed(userId: number, flashcardId: string) {
  if (usesLocalData()) return localData.markFlashcardReviewed(userId, flashcardId);
  const db = await requireDb();
  await db.update(vocabularyFlashcards).set({ reviewedAt: new Date() }).where(and(eq(vocabularyFlashcards.id, flashcardId), eq(vocabularyFlashcards.userId, userId)));
}

export async function getChallengeCompletion(userId: number, challengeDate: string) {
  if (usesLocalData()) return localData.getChallengeCompletion(userId, challengeDate);
  const db = await requireDb();
  const rows = await db.select().from(dailyChallengeCompletions).where(and(eq(dailyChallengeCompletions.userId, userId), eq(dailyChallengeCompletions.challengeDate, challengeDate))).limit(1);
  return rows[0];
}

export async function completeDailyChallenge(userId: number, input: { challengeDate: string; challengeId: string; response: string }) {
  if (usesLocalData()) return localData.completeDailyChallenge(userId, input);
  const db = await requireDb();
  await db.insert(dailyChallengeCompletions).values({ id: nanoid(), userId, ...input, completedAt: new Date() }).onDuplicateKeyUpdate({ set: { challengeId: input.challengeId, response: input.response, completedAt: new Date() } });
  return getChallengeCompletion(userId, input.challengeDate);
}

export async function getProgressOverview(userId: number) {
  if (usesLocalData()) return localData.getProgressOverview(userId);
  const db = await requireDb();
  const [profile, attempts, completions, challenges, flashcards] = await Promise.all([
    getProfile(userId),
    db.select().from(practiceAttempts).where(eq(practiceAttempts.userId, userId)).orderBy(desc(practiceAttempts.completedAt)),
    db.select().from(scenarioCompletions).where(eq(scenarioCompletions.userId, userId)).orderBy(desc(scenarioCompletions.completedAt)),
    db.select().from(dailyChallengeCompletions).where(eq(dailyChallengeCompletions.userId, userId)).orderBy(desc(dailyChallengeCompletions.completedAt)),
    db.select().from(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId)),
  ]);
  return buildProgressOverview({
    dailyGoal: profile.dailyGoal,
    attempts,
    completions,
    challenges,
    flashcards,
  });
}
