import { and, desc, eq } from "drizzle-orm";
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
  users,
  vocabularyFlashcards,
} from "../drizzle/schema";
import { calculateStreak, PracticeFeedback, PracticeType, TutorMode } from "./learning";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
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
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getProfile(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const profile = { id: nanoid(), userId, englishLevel: "Intermediate", targetRole: "Information Systems Professional", focusAreas: ["Workplace English", "IT Vocabulary"], dailyGoal: 1 };
  await db.insert(learnerProfiles).values(profile);
  const created = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  return created[0]!;
}

export async function updateProfile(userId: number, values: { englishLevel: string; targetRole: string; focusAreas: string[]; dailyGoal: number }) {
  const db = await requireDb();
  await getProfile(userId);
  await db.update(learnerProfiles).set(values).where(eq(learnerProfiles.userId, userId));
  return getProfile(userId);
}

export async function listConversations(userId: number) {
  const db = await requireDb();
  return db.select().from(tutorConversations).where(eq(tutorConversations.userId, userId)).orderBy(desc(tutorConversations.updatedAt)).limit(30);
}

export async function getConversation(userId: number, conversationId: string) {
  const db = await requireDb();
  const conversations = await db.select().from(tutorConversations).where(and(eq(tutorConversations.id, conversationId), eq(tutorConversations.userId, userId))).limit(1);
  if (!conversations[0]) return undefined;
  const messages = await db.select().from(tutorMessages).where(and(eq(tutorMessages.conversationId, conversationId), eq(tutorMessages.userId, userId))).orderBy(tutorMessages.createdAt);
  return { conversation: conversations[0], messages };
}

export async function createConversation(userId: number, mode: TutorMode, title: string, scenarioSlug?: string) {
  const db = await requireDb();
  const conversation = { id: nanoid(), userId, mode, title, scenarioSlug: scenarioSlug ?? null };
  await db.insert(tutorConversations).values(conversation);
  return conversation;
}

export async function addMessage(userId: number, conversationId: string, role: "user" | "assistant", content: string) {
  const db = await requireDb();
  await db.insert(tutorMessages).values({ id: nanoid(), userId, conversationId, role, content });
  await db.update(tutorConversations).set({ updatedAt: new Date() }).where(and(eq(tutorConversations.id, conversationId), eq(tutorConversations.userId, userId)));
}

export async function savePracticeAttempt(userId: number, input: { activityType: PracticeType; prompt: string; response: string; feedback: PracticeFeedback }) {
  const db = await requireDb();
  const attempt = {
    id: nanoid(), userId, activityType: input.activityType, prompt: input.prompt, response: input.response, score: input.feedback.score,
    feedback: { correction: input.feedback.correction, explanation: input.feedback.explanation, naturalAlternative: input.feedback.naturalAlternative, errorCategories: input.feedback.errorCategories, vocabulary: input.feedback.vocabulary },
  };
  await db.insert(practiceAttempts).values(attempt);
  return attempt;
}

export async function getScenarioCompletions(userId: number) {
  const db = await requireDb();
  return db.select().from(scenarioCompletions).where(eq(scenarioCompletions.userId, userId));
}

export async function completeScenario(userId: number, scenarioSlug: string, conversationId?: string) {
  const db = await requireDb();
  await db.insert(scenarioCompletions).values({ id: nanoid(), userId, scenarioSlug, conversationId: conversationId ?? null, completedAt: new Date() }).onDuplicateKeyUpdate({ set: { conversationId: conversationId ?? null, completedAt: new Date() } });
}

export async function listFlashcards(userId: number) {
  const db = await requireDb();
  return db.select().from(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId)).orderBy(desc(vocabularyFlashcards.createdAt));
}

export async function saveFlashcard(userId: number, input: { term: string; definition: string; example: string; sourceConversationId?: string }) {
  const db = await requireDb();
  await db.insert(vocabularyFlashcards).values({ id: nanoid(), userId, term: input.term, definition: input.definition, example: input.example, sourceConversationId: input.sourceConversationId ?? null }).onDuplicateKeyUpdate({ set: { definition: input.definition, example: input.example, sourceConversationId: input.sourceConversationId ?? null } });
  const cards = await db.select().from(vocabularyFlashcards).where(and(eq(vocabularyFlashcards.userId, userId), eq(vocabularyFlashcards.term, input.term))).limit(1);
  return cards[0]!;
}

export async function markFlashcardReviewed(userId: number, flashcardId: string) {
  const db = await requireDb();
  await db.update(vocabularyFlashcards).set({ reviewedAt: new Date() }).where(and(eq(vocabularyFlashcards.id, flashcardId), eq(vocabularyFlashcards.userId, userId)));
}

export async function getChallengeCompletion(userId: number, challengeDate: string) {
  const db = await requireDb();
  const rows = await db.select().from(dailyChallengeCompletions).where(and(eq(dailyChallengeCompletions.userId, userId), eq(dailyChallengeCompletions.challengeDate, challengeDate))).limit(1);
  return rows[0];
}

export async function completeDailyChallenge(userId: number, input: { challengeDate: string; challengeId: string; response: string }) {
  const db = await requireDb();
  await db.insert(dailyChallengeCompletions).values({ id: nanoid(), userId, ...input, completedAt: new Date() }).onDuplicateKeyUpdate({ set: { challengeId: input.challengeId, response: input.response, completedAt: new Date() } });
  return getChallengeCompletion(userId, input.challengeDate);
}

export async function getProgressOverview(userId: number) {
  const db = await requireDb();
  const [profile, attempts, completions, challenges, flashcards] = await Promise.all([
    getProfile(userId),
    db.select().from(practiceAttempts).where(eq(practiceAttempts.userId, userId)).orderBy(desc(practiceAttempts.completedAt)),
    db.select().from(scenarioCompletions).where(eq(scenarioCompletions.userId, userId)).orderBy(desc(scenarioCompletions.completedAt)),
    db.select().from(dailyChallengeCompletions).where(eq(dailyChallengeCompletions.userId, userId)).orderBy(desc(dailyChallengeCompletions.completedAt)),
    db.select().from(vocabularyFlashcards).where(eq(vocabularyFlashcards.userId, userId)),
  ]);
  const activityDates = [...attempts.map(item => item.completedAt), ...completions.map(item => item.completedAt), ...challenges.map(item => item.completedAt)];
  const errorMap = new Map<string, number>();
  attempts.forEach(item => item.feedback.errorCategories.forEach(category => errorMap.set(category, (errorMap.get(category) ?? 0) + 1)));
  const errorCategories = Array.from(errorMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const recentActivity = [
    ...attempts.map(item => ({ id: item.id, title: `${item.activityType[0].toUpperCase()}${item.activityType.slice(1)} practice completed`, date: item.completedAt, score: item.score, kind: "practice" as const })),
    ...completions.map(item => ({ id: item.id, title: "Career scenario completed", date: item.completedAt, score: null, kind: "career" as const })),
    ...challenges.map(item => ({ id: item.id, title: "Daily IT-English challenge completed", date: item.completedAt, score: null, kind: "challenge" as const })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = activityDates.filter(date => date.toISOString().slice(0, 10) === today).length;
  return {
    dailyGoal: profile.dailyGoal,
    todaySessions,
    streak: calculateStreak(activityDates),
    completedSessions: activityDates.length,
    vocabularyLearned: Math.max(flashcards.length, attempts.filter(item => item.activityType === "vocabulary" && item.score >= 70).length * 5),
    flashcardsCount: flashcards.length,
    errorCategories,
    recentActivity,
  };
}
