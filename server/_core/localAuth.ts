import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

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

function safeReturnTo(value: unknown) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
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
      await db.upsertUser({
        openId: LOCAL_DEMO_OPEN_ID,
        name: "Alex Morgan",
        email: "alex.morgan@example.com",
        loginMethod: "local",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(LOCAL_DEMO_OPEN_ID);
      const sessionToken = await sdk.createSessionToken(LOCAL_DEMO_OPEN_ID, {
        name: user?.name || "Alex Morgan",
        expiresInMs: ONE_YEAR_MS,
      });

      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.redirect(302, safeReturnTo(req.query.returnTo));
    } catch (error) {
      console.error("[LocalAuth] Sign-in failed", error);
      res.status(500).json({ error: "Local sign-in failed" });
    }
  });
}
