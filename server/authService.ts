import { COOKIE_NAME } from "@shared/const";
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import type { User } from "../drizzle/schema";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
  verifyPasswordOrDummy,
} from "./_core/password";
import { sdk } from "./_core/sdk";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type AuthErrorCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMIT";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode = "BAD_REQUEST"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_AUTH_ATTEMPTS = 12;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

/** Small in-process guard against password guessing. */
export function assertAuthAttemptAllowed(key: string) {
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    authAttempts.delete(key);
    return;
  }
  if (entry.count >= MAX_AUTH_ATTEMPTS) {
    const minutes = Math.max(1, Math.ceil((entry.resetAt - now) / 60_000));
    throw new AuthError(
      `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      "RATE_LIMIT"
    );
  }
}

export function recordAuthFailure(key: string) {
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return;
  }
  entry.count += 1;
  // Keep the map from growing without bound in a long-lived process.
  if (authAttempts.size > 5_000) {
    Array.from(authAttempts.entries()).forEach(([storedKey, value]) => {
      if (value.resetAt <= now) authAttempts.delete(storedKey);
    });
  }
}

export function clearAuthFailures(key: string) {
  authAttempts.delete(key);
}

/** Test-only helper: clear in-process login attempt counters. */
export function resetAuthFailuresForTests() {
  authAttempts.clear();
}

export type PublicUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  status: "active" | "disabled";
  createdAt: Date;
  lastSignedIn: Date;
  hasPassword: boolean;
};

/** Strip secrets and session internals before a user object crosses the wire. */
export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
    hasPassword: Boolean(user.passwordHash),
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertValidName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new AuthError("Enter your name (at least 2 characters).");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new AuthError(`Keep your name under ${MAX_NAME_LENGTH} characters.`);
  }
  return trimmed;
}

function assertValidEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > MAX_EMAIL_LENGTH) {
    throw new AuthError("Enter a valid email address.");
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new AuthError("Enter a valid email address.");
  }
  return normalized;
}

export function getClientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0];
  const value = (raw || req.socket?.remoteAddress || "").trim();
  return value.replace(/^::ffff:/, "").slice(0, 64) || null;
}

export function describeUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /OPR\//i.test(userAgent)
      ? "Opera"
      : /Chrome\//i.test(userAgent)
        ? "Chrome"
        : /Firefox\//i.test(userAgent)
          ? "Firefox"
          : /Safari\//i.test(userAgent)
            ? "Safari"
            : null;

  const platform = /Windows NT/i.test(userAgent)
    ? "Windows"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "iOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /Mac OS X/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : null;

  if (browser && platform) return `${browser} on ${platform}`;
  return browser || platform || "Unknown device";
}

export async function registerLocalUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const name = assertValidName(input.name);
  const email = assertValidEmail(input.email);
  const passwordError = validatePassword(input.password);
  if (passwordError) throw new AuthError(passwordError);

  const existing = await db.getUserByEmail(email);
  if (existing) {
    throw new AuthError(
      "An account with that email already exists. Sign in instead.",
      "CONFLICT"
    );
  }

  const passwordHash = await hashPassword(input.password);
  const openId = `local-${nanoid(16)}`;
  // The first registered (non-demo) account becomes the initial administrator.
  const isFirstAccount = (await db.countPasswordAccounts()) === 0;
  await db.upsertUser({
    openId,
    name,
    email,
    passwordHash,
    loginMethod: "password",
    role: isFirstAccount ? "admin" : "user",
    status: "active",
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(openId);
  if (!user) throw new AuthError("Could not create your account. Try again.");
  return user;
}

export async function authenticateLocalUser(email: string, password: string) {
  const user = await db.getUserByEmail(normalizeEmail(email));
  const valid = await verifyPasswordOrDummy(password, user?.passwordHash);
  if (!user || !valid) return null;
  if (user.status === "disabled") {
    throw new AuthError(
      "This account has been disabled. Contact an administrator.",
      "FORBIDDEN"
    );
  }

  await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  return (await db.getUserByOpenId(user.openId)) ?? user;
}

export async function issueSession(
  req: Request,
  res: Response,
  user: User,
  durationMs = SESSION_DURATION_MS
) {
  const now = new Date();
  const sessionId = nanoid(32);
  const userAgent = req.headers["user-agent"]?.slice(0, 1000) ?? null;

  await db.createSession({
    id: sessionId,
    userId: user.id,
    userAgent,
    ipAddress: getClientIp(req),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + durationMs),
  });

  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name || "Learner",
    sessionId,
    expiresInMs: durationMs,
  });

  res.cookie(COOKIE_NAME, sessionToken, {
    ...getSessionCookieOptions(req),
    maxAge: durationMs,
  });

  return sessionId;
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
}

export async function destroySession(
  req: Request,
  res: Response,
  userId: number,
  sessionId?: string
) {
  if (sessionId) await db.revokeSession(userId, sessionId);
  clearSessionCookie(req, res);
}

export async function listUserSessions(userId: number, currentSessionId?: string) {
  const sessions = await db.listSessions(userId);
  return sessions
    .map(session => ({
      id: session.id,
      device: describeUserAgent(session.userAgent),
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      current: session.id === currentSessionId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export async function updateAccount(
  user: User,
  input: { name: string; email: string }
) {
  const name = assertValidName(input.name);
  const email = assertValidEmail(input.email);
  try {
    const updated = await db.updateUserAccount(user.id, { name, email });
    if (!updated) throw new AuthError("Could not update your account.");
    return updated;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (error instanceof Error && /already in use/i.test(error.message)) {
      throw new AuthError(error.message, "CONFLICT");
    }
    throw error;
  }
}

export async function changePassword(
  user: User,
  currentPassword: string | undefined,
  newPassword: string
) {
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new AuthError(passwordError);

  if (user.passwordHash) {
    if (!currentPassword) {
      throw new AuthError("Enter your current password.");
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AuthError("Your current password is incorrect.", "UNAUTHORIZED");
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await db.updateUserPassword(user.id, passwordHash);
  return true;
}

export async function deleteAccount(
  user: User,
  input: { password?: string; confirmation: string }
) {
  if (input.confirmation !== "DELETE") {
    throw new AuthError('Type DELETE to confirm account deletion.');
  }

  if (user.role === "admin" && user.status === "active") {
    const activeAdmins = await db.countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new AuthError(
        "You are the only active administrator. Promote another admin before deleting this account."
      );
    }
  }

  if (user.passwordHash) {
    if (!input.password) {
      throw new AuthError("Enter your password to delete your account.");
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new AuthError("Your password is incorrect.", "UNAUTHORIZED");
    }
  }

  await db.deleteUserAccount(user.id);
  return true;
}
