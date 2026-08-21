import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 17,
      openId: "learner-17",
      name: "Private Learner",
      email: "learner@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("protected learning input validation", () => {
  it("rejects empty tutor messages before any private conversation query or AI request", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    await expect(caller.tutor.send({ mode: "general", message: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an invalid learner goal before profile persistence", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    await expect(caller.profile.update({ englishLevel: "Intermediate", targetRole: "Systems Analyst", focusAreas: ["Workplace English"], dailyGoal: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
