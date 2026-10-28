import type { Express, Request, Response } from "express";
import * as db from "../db";
import { issueSession } from "../authService";
import { ENV } from "./env";

export const LOCAL_DEMO_OPEN_ID = "local-demo-user";

/**
 * Local sign-in is a development convenience, not a production identity
 * provider. It is enabled explicitly with `LOCAL_AUTH=true`, or automatically
 * outside production when Manus OAuth has not been configured. Production
 * deployments (including Vercel) must configure real OAuth or opt in.
 */
export function isLocalAuthEnabled() {
  return ENV.localAuthEnabled;
}

/**
 * Email/password accounts are the application's own identity layer. They are
 * available wherever the app is deployed and do not depend on the one-click
 * demo account. Set `PASSWORD_AUTH=false` to run an SSO-only deployment.
 */
export function isPasswordAuthEnabled() {
  return process.env.PASSWORD_AUTH !== "false";
}

function safeReturnTo(value: unknown) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}

async function ensureDemoUser() {
  let user = await db.getUserByOpenId(LOCAL_DEMO_OPEN_ID);
  if (!user) {
    await db.upsertUser({
      openId: LOCAL_DEMO_OPEN_ID,
      name: "Alex Morgan",
      email: "alex.morgan@example.com",
      loginMethod: "local",
      role: "user",
      status: "active",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(LOCAL_DEMO_OPEN_ID);
  }
  return user;
}

export function registerLocalAuthRoutes(app: Express) {
  app.get("/api/auth/local", async (req: Request, res: Response) => {
    if (!isLocalAuthEnabled()) {
      res.status(404).json({
        error:
          "Local sign-in is disabled. Set LOCAL_AUTH=true for local development or configure OAuth.",
      });
      return;
    }

    try {
      const user = await ensureDemoUser();
      if (!user) throw new Error("Demo user could not be created");

      await issueSession(req, res, user);
      res.redirect(302, safeReturnTo(req.query.returnTo));
    } catch (error) {
      console.error("[LocalAuth] Sign-in failed", error);
      res.status(500).json({ error: "Local sign-in failed" });
    }
  });
}
