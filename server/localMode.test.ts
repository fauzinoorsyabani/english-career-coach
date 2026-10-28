import { beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import * as local from "./localData";
import { correctEnglish, localPracticeFeedback, localTutorReply } from "./localCoach";

process.env.LOCAL_DATA_FILE = path.join(
  os.tmpdir(),
  `english-career-coach-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
);

beforeEach(async () => {
  await local.resetLocalDataForTests();
});

describe("local data store", () => {
  it("creates users and persists profile changes", async () => {
    const user = await local.upsertUser({ openId: "learner-one", name: "Alex" });
    expect(user.id).toBeGreaterThan(0);
    expect((await local.getUserByOpenId("learner-one"))?.name).toBe("Alex");

    const profile = await local.getProfile(user.id);
    expect(profile.englishLevel).toBe("Intermediate");

    const updated = await local.updateProfile(user.id, {
      englishLevel: "Advanced",
      targetRole: "Business Analyst",
      focusAreas: ["Workplace English"],
      dailyGoal: 2,
    });
    expect(updated.englishLevel).toBe("Advanced");
    expect((await local.getProfile(user.id)).dailyGoal).toBe(2);
  });

  it("scopes tutor conversations and messages to their owner", async () => {
    const first = await local.upsertUser({ openId: "learner-one", name: "Alex" });
    const second = await local.upsertUser({ openId: "learner-two", name: "Sam" });
    const conversation = await local.createConversation(
      first.id,
      "workplace",
      "Stand-up practice"
    );
    await local.addMessage(first.id, conversation.id, "user", "Yesterday I finished the API work.");

    expect((await local.getConversation(first.id, conversation.id))?.messages).toHaveLength(1);
    expect(await local.getConversation(second.id, conversation.id)).toBeUndefined();
    expect(await local.listConversations(second.id)).toHaveLength(0);
  });

  it("persists practice, flashcards, scenarios, challenges and progress", async () => {
    const user = await local.upsertUser({ openId: "learner-one", name: "Alex" });
    const feedback = localPracticeFeedback({
      activityType: "grammar",
      prompt: "Correct this sentence.",
      response: "I am agree with the plan.",
    });
    await local.savePracticeAttempt(user.id, {
      activityType: "grammar",
      prompt: "Correct this sentence.",
      response: "I am agree with the plan.",
      feedback,
    });
    await local.saveFlashcard(user.id, {
      term: "blocker",
      definition: "Something that prevents progress.",
      example: "My only blocker is access.",
    });
    await local.completeScenario(user.id, "daily-stand-up", "conversation-id");
    await local.completeDailyChallenge(user.id, {
      challengeDate: "2026-10-28",
      challengeId: "incident-summary",
      response: "The portal is unavailable.",
    });

    const progress = await local.getProgressOverview(user.id);
    expect(progress.completedSessions).toBe(3);
    expect(progress.flashcardsCount).toBe(1);
    expect(progress.errorCategories.some(item => item.name === "Grammar")).toBe(true);
    expect(progress.recentActivity).toHaveLength(3);
    expect(progress.streak).toBe(1);
  });

  it("keeps daily challenge completion idempotent per user and date", async () => {
    const user = await local.upsertUser({ openId: "learner-one", name: "Alex" });
    const input = {
      challengeDate: "2026-10-28",
      challengeId: "incident-summary",
      response: "First response",
    };
    await local.completeDailyChallenge(user.id, input);
    await local.completeDailyChallenge(user.id, { ...input, response: "Updated response" });

    const completion = await local.getChallengeCompletion(user.id, input.challengeDate);
    expect(completion?.response).toBe("Updated response");
    expect(
      (await local.getProgressOverview(user.id)).recentActivity.filter(
        item => item.kind === "challenge"
      )
    ).toHaveLength(1);
  });
});

describe("offline coach", () => {
  it("corrects common IT-English grammar patterns", () => {
    const { corrected, notes } = correctEnglish(
      "I am agree with the plan and we was ready to deploy."
    );
    expect(corrected).toBe("I agree with the plan and we were ready to deploy.");
    expect(notes.map(note => note.category)).toContain("Grammar");
    expect(notes.map(note => note.category)).toContain("Verb tense");
  });

  it("returns structured practice feedback", () => {
    const feedback = localPracticeFeedback({
      activityType: "grammar",
      prompt: "Correct this sentence.",
      response: "I want improve my English and discuss about the project",
    });
    expect(feedback.score).toBeGreaterThan(0);
    expect(feedback.score).toBeLessThanOrEqual(100);
    expect(feedback.correction).toContain("want to improve");
    expect(feedback.correction).toContain("discuss the project");
    expect(feedback.naturalAlternative.length).toBeGreaterThan(0);
    expect(feedback.errorCategories).toContain("Grammar");
  });

  it("uses the required five tutor sections", () => {
    const reply = localTutorReply({
      message: "I want improve my English for work.",
      systemPrompt: "Focus on concise, professional workplace English for collaboration.",
    });
    expect(reply).toContain("**Answer**");
    expect(reply).toContain("**Correction**");
    expect(reply).toContain("**Why**");
    expect(reply).toContain("**More natural way to say it**");
    expect(reply).toContain("**Try next**");
  });
});
