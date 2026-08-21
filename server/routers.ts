import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { careerScenarios, parsePracticeFeedback, PracticeType, TUTOR_MODES, tutorModeLabels, tutorSystemPrompt } from "./learning";

const tutorModeSchema = z.enum(TUTOR_MODES);
const practiceTypeSchema = z.enum(["vocabulary", "grammar", "rewrite", "writing"] satisfies [PracticeType, ...PracticeType[]]);
const cleanText = z.string().trim().min(1).max(1800);

function assistantText(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("The tutor returned an empty response");
  return content.trim();
}

function aiError(error: unknown) {
  if (error instanceof TRPCError) return error;
  console.error("[Learning AI]", error);
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The AI tutor is temporarily unavailable. Please try again in a moment." });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => db.getProfile(ctx.user.id)),
    update: protectedProcedure.input(z.object({
      englishLevel: z.string().trim().min(2).max(32),
      targetRole: z.string().trim().min(2).max(120),
      focusAreas: z.array(z.string().trim().min(2).max(60)).min(1).max(6),
      dailyGoal: z.number().int().min(1).max(6),
    })).mutation(({ ctx, input }) => db.updateProfile(ctx.user.id, input)),
  }),
  tutor: router({
    listConversations: protectedProcedure.query(({ ctx }) => db.listConversations(ctx.user.id)),
    getConversation: protectedProcedure.input(z.object({ conversationId: z.string().min(8).max(24) })).query(async ({ ctx, input }) => {
      const conversation = await db.getConversation(ctx.user.id, input.conversationId);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "This tutor conversation was not found." });
      return conversation;
    }),
    send: protectedProcedure.input(z.object({
      conversationId: z.string().min(8).max(24).optional(),
      mode: tutorModeSchema,
      message: cleanText,
    })).mutation(async ({ ctx, input }) => {
      try {
        const existing = input.conversationId ? await db.getConversation(ctx.user.id, input.conversationId) : undefined;
        if (input.conversationId && !existing) throw new TRPCError({ code: "NOT_FOUND", message: "This tutor conversation was not found." });
        const conversation = existing?.conversation ?? await db.createConversation(ctx.user.id, input.mode, input.message.slice(0, 72));
        await db.addMessage(ctx.user.id, conversation.id, "user", input.message);
        const history = await db.getConversation(ctx.user.id, conversation.id);
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [{ role: "system", content: tutorSystemPrompt(conversation.mode) }, ...(history?.messages ?? []).slice(-12).map(message => ({ role: message.role, content: message.content }))],
        });
        const content = assistantText(response);
        await db.addMessage(ctx.user.id, conversation.id, "assistant", content);
        return { conversationId: conversation.id, assistantMessage: content };
      } catch (error) { throw aiError(error); }
    }),
  }),
  practice: router({
    submit: protectedProcedure.input(z.object({ activityType: practiceTypeSchema, prompt: cleanText, response: cleanText })).mutation(async ({ ctx, input }) => {
      try {
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: "You are a careful English coach for IT professionals. Assess one short English-learning exercise. Give fair, practical feedback; do not claim to provide a certification. Return only the requested JSON." },
            { role: "user", content: `Activity type: ${input.activityType}\nPrompt: ${input.prompt}\nLearner response: ${input.response}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "practice_feedback", strict: true, schema: {
            type: "object", properties: {
              score: { type: "integer", description: "A motivational 0-100 practice score" },
              correction: { type: "string" }, explanation: { type: "string" }, naturalAlternative: { type: "string" },
              errorCategories: { type: "array", items: { type: "string" } }, vocabulary: { type: "array", items: { type: "string" } },
            }, required: ["score", "correction", "explanation", "naturalAlternative", "errorCategories", "vocabulary"], additionalProperties: false,
          } } },
        });
        const feedback = parsePracticeFeedback(assistantText(response));
        await db.savePracticeAttempt(ctx.user.id, { ...input, feedback });
        return feedback;
      } catch (error) { throw aiError(error); }
    }),
  }),
  career: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const complete = new Set((await db.getScenarioCompletions(ctx.user.id)).map(item => item.scenarioSlug));
      return careerScenarios.map(scenario => ({ ...scenario, modeLabel: tutorModeLabels[scenario.mode], completed: complete.has(scenario.slug) }));
    }),
    start: protectedProcedure.input(z.object({ slug: z.string().min(3).max(80) })).mutation(async ({ ctx, input }) => {
      const scenario = careerScenarios.find(item => item.slug === input.slug);
      if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "This career scenario was not found." });
      const conversation = await db.createConversation(ctx.user.id, scenario.mode, scenario.title, scenario.slug);
      await db.addMessage(ctx.user.id, conversation.id, "assistant", `## ${scenario.title}\n\nWe will practise this IT communication situation together. I will respond like a supportive colleague or interviewer, then help you improve your English.\n\n**Your first task:** ${scenario.prompt}\n\nWrite your first answer when you are ready.`);
      return { conversationId: conversation.id };
    }),
    complete: protectedProcedure.input(z.object({ slug: z.string().min(3).max(80), conversationId: z.string().min(8).max(24) })).mutation(async ({ ctx, input }) => {
      const conversation = await db.getConversation(ctx.user.id, input.conversationId);
      if (!conversation || conversation.conversation.scenarioSlug !== input.slug) throw new TRPCError({ code: "NOT_FOUND", message: "This guided scenario was not found." });
      await db.completeScenario(ctx.user.id, input.slug, input.conversationId);
      return { success: true };
    }),
  }),
  progress: router({ overview: protectedProcedure.query(({ ctx }) => db.getProgressOverview(ctx.user.id)) }),
});

export type AppRouter = typeof appRouter;
