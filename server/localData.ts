import fs from "node:fs";
import path from "node:path";
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
  VocabularyFlashcard,
} from "../drizzle/schema";
import {
  buildProgressOverview,
  type PracticeFeedback,
  type PracticeType,
  type TutorMode,
} from "./learning";

type LocalState = {
  version: 1;
  nextUserId: number;
  users: User[];
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

let state: LocalState | null = null;

function emptyState(): LocalState {
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
    dailyChallengeCompletions: [],
  };
}

const asDate = (value: Date | string | null | undefined) =>
  value == null ? value : value instanceof Date ? value : new Date(value);

function loadState(): LocalState {
  if (state) return state;

  const file = dataFile();
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as LocalState;
      state = {
        ...emptyState(),
        ...raw,
        version: 1,
        users: (raw.users ?? []).map(user => ({
          ...user,
          createdAt: asDate(user.createdAt)!,
          updatedAt: asDate(user.updatedAt)!,
          lastSignedIn: asDate(user.lastSignedIn)!,
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

export function getLocalDataFile() {
  return dataFile();
}

/** Test-only helper: forget cached state and remove the temporary data file. */
export function resetLocalDataForTests() {
  state = null;
  try {
    fs.rmSync(dataFile(), { force: true });
  } catch {
    // Ignore cleanup failures in test environments.
  }
}

export function upsertUser(user: InsertUser): User {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const current = loadState();
  const now = new Date();
  const existing = current.users.find(item => item.openId === user.openId);

  if (existing) {
    if (user.name !== undefined) existing.name = user.name ?? null;
    if (user.email !== undefined) existing.email = user.email ?? null;
    if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
    if (user.role !== undefined) existing.role = user.role;
    existing.lastSignedIn = user.lastSignedIn ?? now;
    existing.updatedAt = now;
    saveState();
    return existing;
  }

  const created: User = {
    id: current.nextUserId++,
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role: user.role ?? "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: user.lastSignedIn ?? now,
  };
  current.users.push(created);
  saveState();
  return created;
}

export function getUserByOpenId(openId: string) {
  return loadState().users.find(user => user.openId === openId);
}

export function getProfile(userId: number): LearnerProfile {
  const current = loadState();
  const existing = current.learnerProfiles.find(profile => profile.userId === userId);
  if (existing) return existing;

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
  current.learnerProfiles.push(profile);
  saveState();
  return profile;
}

export function updateProfile(
  userId: number,
  values: { englishLevel: string; targetRole: string; focusAreas: string[]; dailyGoal: number }
) {
  const current = loadState();
  const profile = getProfile(userId);
  Object.assign(profile, values, { updatedAt: new Date() });
  if (!current.learnerProfiles.includes(profile)) current.learnerProfiles.push(profile);
  saveState();
  return profile;
}

export function listConversations(userId: number) {
  return loadState()
    .tutorConversations.filter(conversation => conversation.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 30);
}

export function getConversation(userId: number, conversationId: string) {
  const current = loadState();
  const conversation = current.tutorConversations.find(
    item => item.id === conversationId && item.userId === userId
  );
  if (!conversation) return undefined;
  const messages = current.tutorMessages
    .filter(message => message.conversationId === conversationId && message.userId === userId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return { conversation, messages };
}

export function createConversation(
  userId: number,
  mode: TutorMode,
  title: string,
  scenarioSlug?: string
): TutorConversation {
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
  loadState().tutorConversations.push(conversation);
  saveState();
  return conversation;
}

export function addMessage(
  userId: number,
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  const current = loadState();
  const message: TutorMessage = {
    id: nanoid(),
    conversationId,
    userId,
    role,
    content,
    createdAt: new Date(),
  };
  current.tutorMessages.push(message);
  const conversation = current.tutorConversations.find(
    item => item.id === conversationId && item.userId === userId
  );
  if (conversation) conversation.updatedAt = new Date();
  saveState();
  return message;
}

export function savePracticeAttempt(
  userId: number,
  input: { activityType: PracticeType; prompt: string; response: string; feedback: PracticeFeedback }
): PracticeAttempt {
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
  loadState().practiceAttempts.push(attempt);
  saveState();
  return attempt;
}

export function getScenarioCompletions(userId: number) {
  return loadState().scenarioCompletions.filter(completion => completion.userId === userId);
}

export function completeScenario(userId: number, scenarioSlug: string, conversationId?: string) {
  const current = loadState();
  const now = new Date();
  const existing = current.scenarioCompletions.find(
    completion => completion.userId === userId && completion.scenarioSlug === scenarioSlug
  );
  if (existing) {
    existing.conversationId = conversationId ?? null;
    existing.completedAt = now;
    saveState();
    return existing;
  }
  const completion: ScenarioCompletion = {
    id: nanoid(),
    userId,
    scenarioSlug,
    conversationId: conversationId ?? null,
    completedAt: now,
  };
  current.scenarioCompletions.push(completion);
  saveState();
  return completion;
}

export function listFlashcards(userId: number) {
  return loadState()
    .vocabularyFlashcards.filter(card => card.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function saveFlashcard(
  userId: number,
  input: { term: string; definition: string; example: string; sourceConversationId?: string }
): VocabularyFlashcard {
  const current = loadState();
  const normalised = input.term.trim().toLowerCase();
  const existing = current.vocabularyFlashcards.find(
    card => card.userId === userId && card.term.trim().toLowerCase() === normalised
  );
  if (existing) {
    existing.definition = input.definition;
    existing.example = input.example;
    existing.sourceConversationId = input.sourceConversationId ?? null;
    saveState();
    return existing;
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
  current.vocabularyFlashcards.push(card);
  saveState();
  return card;
}

export function markFlashcardReviewed(userId: number, flashcardId: string) {
  const card = loadState().vocabularyFlashcards.find(
    item => item.id === flashcardId && item.userId === userId
  );
  if (!card) return;
  card.reviewedAt = new Date();
  saveState();
}

export function getChallengeCompletion(userId: number, challengeDate: string) {
  return loadState().dailyChallengeCompletions.find(
    completion => completion.userId === userId && completion.challengeDate === challengeDate
  );
}

export function completeDailyChallenge(
  userId: number,
  input: { challengeDate: string; challengeId: string; response: string }
) {
  const current = loadState();
  const existing = current.dailyChallengeCompletions.find(
    completion =>
      completion.userId === userId && completion.challengeDate === input.challengeDate
  );
  if (existing) {
    existing.challengeId = input.challengeId;
    existing.response = input.response;
    existing.completedAt = new Date();
    saveState();
    return existing;
  }
  const completion: DailyChallengeCompletion = {
    id: nanoid(),
    userId,
    challengeDate: input.challengeDate,
    challengeId: input.challengeId,
    response: input.response,
    completedAt: new Date(),
  };
  current.dailyChallengeCompletions.push(completion);
  saveState();
  return completion;
}

export function getProgressOverview(userId: number) {
  const current = loadState();
  const profile = getProfile(userId);
  return buildProgressOverview({
    dailyGoal: profile.dailyGoal,
    attempts: current.practiceAttempts.filter(attempt => attempt.userId === userId),
    completions: current.scenarioCompletions.filter(completion => completion.userId === userId),
    challenges: current.dailyChallengeCompletions.filter(completion => completion.userId === userId),
    flashcards: current.vocabularyFlashcards.filter(card => card.userId === userId),
  });
}
