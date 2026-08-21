import { describe, expect, it } from "vitest";
import { calculateStreak, getDailyChallenge, isSupportedAudioMime, parsePracticeFeedback, TUTOR_MODES, tutorModeLabels } from "./learning";

describe("learning helpers", () => {
  it("keeps all required tutor modes with their exact learner-facing labels", () => {
    expect(TUTOR_MODES).toEqual(["general", "workplace", "interview", "it_vocabulary"]);
    expect(Object.values(tutorModeLabels)).toEqual(["General English", "Workplace English", "Interview Practice", "IT Vocabulary"]);
  });

  it("parses and bounds structured practice feedback", () => {
    const feedback = parsePracticeFeedback(JSON.stringify({ score: 104, correction: "I deployed the update.", explanation: "Use the past tense.", naturalAlternative: "I released the update to production.", errorCategories: ["Verb tense"], vocabulary: ["deploy"] }));
    expect(feedback.score).toBe(100);
    expect(feedback.errorCategories).toEqual(["Verb tense"]);
  });

  it("calculates a consecutive study streak without counting another user’s dates", () => {
    const now = new Date("2026-08-21T10:00:00.000Z");
    const currentUserDates = [new Date("2026-08-21T08:00:00.000Z"), new Date("2026-08-20T08:00:00.000Z")];
    expect(calculateStreak(currentUserDates, now)).toBe(2);
    expect(calculateStreak([new Date("2026-08-19T08:00:00.000Z")], now)).toBe(0);
  });

  it("selects a stable IT-English challenge for a given daily date", () => {
    const date = new Date("2026-08-21T08:00:00.000Z");
    expect(getDailyChallenge(date)).toEqual(getDailyChallenge(date));
    expect(getDailyChallenge(date).prompt).toMatch(/IT|incident|stand-up|stakeholder|release|technical/i);
  });

  it("accepts only supported role-play audio formats", () => {
    expect(isSupportedAudioMime("audio/webm")).toBe(true);
    expect(isSupportedAudioMime("video/mp4")).toBe(false);
  });
});
