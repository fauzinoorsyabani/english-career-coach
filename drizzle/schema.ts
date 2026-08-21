import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
  text,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const learnerProfiles = mysqlTable(
  "learner_profiles",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    englishLevel: varchar("englishLevel", { length: 32 }).default("Intermediate").notNull(),
    targetRole: varchar("targetRole", { length: 120 }).default("Information Systems Professional").notNull(),
    focusAreas: json("focusAreas").$type<string[]>().notNull(),
    dailyGoal: int("dailyGoal").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ userUnique: uniqueIndex("learner_profile_user_idx").on(table.userId) })
);

export const tutorConversations = mysqlTable(
  "tutor_conversations",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    mode: mysqlEnum("mode", ["general", "workplace", "interview", "it_vocabulary"]).notNull(),
    scenarioSlug: varchar("scenarioSlug", { length: 80 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ userUpdated: index("conversation_user_updated_idx").on(table.userId, table.updatedAt) })
);

export const tutorMessages = mysqlTable(
  "tutor_messages",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    conversationId: varchar("conversationId", { length: 24 }).notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ conversationUser: index("message_conversation_user_idx").on(table.conversationId, table.userId) })
);

export const practiceAttempts = mysqlTable(
  "practice_attempts",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    activityType: mysqlEnum("activityType", ["vocabulary", "grammar", "rewrite", "writing"]).notNull(),
    prompt: text("prompt").notNull(),
    response: text("response").notNull(),
    score: int("score").notNull(),
    feedback: json("feedback").$type<{
      correction: string;
      explanation: string;
      naturalAlternative: string;
      errorCategories: string[];
      vocabulary: string[];
    }>().notNull(),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
  },
  table => ({ userCompleted: index("attempt_user_completed_idx").on(table.userId, table.completedAt) })
);

export const scenarioCompletions = mysqlTable(
  "scenario_completions",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    userId: int("userId").notNull(),
    scenarioSlug: varchar("scenarioSlug", { length: 80 }).notNull(),
    conversationId: varchar("conversationId", { length: 24 }),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
  },
  table => ({ userScenario: uniqueIndex("completion_user_scenario_idx").on(table.userId, table.scenarioSlug) })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LearnerProfile = typeof learnerProfiles.$inferSelect;
export type TutorConversation = typeof tutorConversations.$inferSelect;
export type TutorMessage = typeof tutorMessages.$inferSelect;
export type PracticeAttempt = typeof practiceAttempts.$inferSelect;
