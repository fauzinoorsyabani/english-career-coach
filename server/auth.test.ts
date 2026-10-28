import { beforeEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import os from "node:os";
import path from "node:path";
import { COOKIE_NAME } from "@shared/const";
import { appRouter } from "./routers";
import * as adminService from "./adminService";
import * as auth from "./authService";
import * as db from "./db";
import * as local from "./localData";
import { hashPassword, validatePassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";

process.env.LOCAL_DATA = "true";
delete process.env.DATABASE_URL;
process.env.LOCAL_DATA_FILE = path.join(
  os.tmpdir(),
  `english-career-coach-auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
);

type CookieCapture = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

function createRequest(headers: Record<string, string> = {}): Request {
  return {
    headers,
    socket: { remoteAddress: "127.0.0.1" },
    protocol: "http",
  } as unknown as Request;
}

function createResponse() {
  const cookies: CookieCapture[] = [];
  const res = {
    cookies,
    cookie(name: string, value: string, options?: Record<string, unknown>) {
      cookies.push({ name, value, options });
      return res;
    },
    clearCookie(name: string, options?: Record<string, unknown>) {
      cookies.push({ name, value: "", options });
      return res;
    },
  };
  return res as unknown as Response & { cookies: CookieCapture[] };
}

async function registerViaRouter(
  name: string,
  email: string,
  password = "SecurePass1"
) {
  const req = createRequest({
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  });
  const res = createResponse();
  const caller = appRouter.createCaller({ req, res, user: null });
  const user = await caller.auth.register({ name, email, password });
  const cookie = res.cookies.find(item => item.name === COOKIE_NAME);
  if (!cookie) throw new Error("Registration did not set a session cookie");
  return { user, cookie: cookie.value, res };
}

async function loginViaRouter(email: string, password = "SecurePass1") {
  const req = createRequest({
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  });
  const res = createResponse();
  const caller = appRouter.createCaller({ req, res, user: null });
  const user = await caller.auth.login({ email, password });
  const cookie = res.cookies.find(item => item.name === COOKIE_NAME);
  if (!cookie) throw new Error("Login did not set a session cookie");
  return { user, cookie: cookie.value, res };
}

function requestWithCookie(cookieValue: string) {
  return createRequest({
    cookie: `${COOKIE_NAME}=${cookieValue}`,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  });
}

async function authenticate(cookieValue: string) {
  return sdk.authenticateRequest(requestWithCookie(cookieValue));
}

async function sessionIdFromCookie(cookieValue: string) {
  const payload = await sdk.verifySession(cookieValue);
  if (!payload?.sid) throw new Error("Session cookie did not contain a sid");
  return payload.sid;
}

beforeEach(async () => {
  await local.resetLocalDataForTests();
  auth.resetAuthFailuresForTests();
});

describe("password primitives", () => {
  it("hashes and verifies passwords without storing the plain text", async () => {
    const hash = await hashPassword("SecurePass1");
    expect(hash).not.toContain("SecurePass1");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("SecurePass1", hash)).toBe(true);
    expect(await verifyPassword("WrongPass1", hash)).toBe(false);
    expect(await verifyPassword("SecurePass1", "not-a-hash")).toBe(false);
  });

  it("uses a fresh salt for every hash", async () => {
    const first = await hashPassword("SecurePass1");
    const second = await hashPassword("SecurePass1");
    expect(first).not.toBe(second);
    expect(await verifyPassword("SecurePass1", first)).toBe(true);
    expect(await verifyPassword("SecurePass1", second)).toBe(true);
  });

  it("enforces the password policy", () => {
    expect(validatePassword("short1")).toMatch(/8 characters/i);
    expect(validatePassword("onlyletters")).toMatch(/letter and one number/i);
    expect(validatePassword("12345678")).toMatch(/letter and one number/i);
    expect(validatePassword("Password1")).toMatch(/too common/i);
    expect(validatePassword("SecurePass1")).toBeNull();
  });
});

describe("local registration and sign-in", () => {
  it("makes the first registered account an administrator and later accounts users", async () => {
    const first = await auth.registerLocalUser({
      name: "First Admin",
      email: "First@Example.com",
      password: "SecurePass1",
    });
    const second = await auth.registerLocalUser({
      name: "Second Learner",
      email: "second@example.com",
      password: "SecurePass1",
    });

    expect(first.role).toBe("admin");
    expect(first.email).toBe("first@example.com");
    expect(second.role).toBe("user");
  });

  it("rejects duplicate emails regardless of casing", async () => {
    await auth.registerLocalUser({
      name: "First Admin",
      email: "learner@example.com",
      password: "SecurePass1",
    });

    await expect(
      auth.registerLocalUser({
        name: "Another Learner",
        email: "LEARNER@example.com",
        password: "SecurePass1",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("signs in with the right password and rejects the wrong one", async () => {
    const user = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });

    const signedIn = await auth.authenticateLocalUser(
      "LEARNER@EXAMPLE.COM",
      "SecurePass1"
    );
    expect(signedIn?.id).toBe(user.id);

    const rejected = await auth.authenticateLocalUser(
      "learner@example.com",
      "WrongPass1"
    );
    expect(rejected).toBeNull();
  });

  it("blocks disabled accounts from signing in", async () => {
    const user = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });
    await db.updateUserModeration(user.id, { status: "disabled" });

    await expect(
      auth.authenticateLocalUser("learner@example.com", "SecurePass1")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("session lifecycle", () => {
  it("issues 30-day tracked sessions and marks the current device", async () => {
    const user = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });
    const res = createResponse();
    await auth.issueSession(
      createRequest({
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      }),
      res,
      user
    );

    expect(res.cookies[0]?.name).toBe(COOKIE_NAME);
    expect(res.cookies[0]?.options?.maxAge).toBe(auth.SESSION_DURATION_MS);

    const sessions = await db.listSessions(user.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].expiresAt.getTime() - sessions[0].createdAt.getTime()).toBe(
      auth.SESSION_DURATION_MS
    );

    const listed = await auth.listUserSessions(user.id, sessions[0].id);
    expect(listed[0].current).toBe(true);
    expect(listed[0].device).toContain("Windows");
  });

  it("revokes one other session without signing out the current one", async () => {
    const user = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });
    const firstRes = createResponse();
    const secondRes = createResponse();
    const first = await auth.issueSession(createRequest(), firstRes, user);
    const second = await auth.issueSession(createRequest(), secondRes, user);

    expect(await db.revokeSession(user.id, second)).toBe(true);
    expect(await db.getSession(first)).toBeTruthy();
    expect(await db.getSession(second)).toBeUndefined();
    expect(await db.listSessions(user.id)).toHaveLength(1);
  });

  it("revokes every session except the current one", async () => {
    const user = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });
    const fakeRes = createResponse();
    const keep = await auth.issueSession(createRequest(), fakeRes, user);
    await auth.issueSession(createRequest(), fakeRes, user);
    await auth.issueSession(createRequest(), fakeRes, user);

    await db.revokeOtherSessions(user.id, keep);
    const remaining = await db.listSessions(user.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(keep);
  });

  it("ignores expired sessions", async () => {
    const user = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });
    await db.createSession({
      id: "expired-session",
      userId: user.id,
      userAgent: "test",
      ipAddress: "127.0.0.1",
      createdAt: new Date(Date.now() - 1000),
      lastSeenAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() - 1),
    });

    expect(await db.getSession("expired-session")).toBeUndefined();
    expect(await db.listSessions(user.id)).toHaveLength(0);
  });
});

describe("account management", () => {
  it("updates the account when the email is available and rejects duplicates", async () => {
    const first = await auth.registerLocalUser({
      name: "First",
      email: "first@example.com",
      password: "SecurePass1",
    });
    const second = await auth.registerLocalUser({
      name: "Second",
      email: "second@example.com",
      password: "SecurePass1",
    });

    const updated = await auth.updateAccount(first, {
      name: "First Updated",
      email: "first.updated@example.com",
    });
    expect(updated.name).toBe("First Updated");
    expect(updated.email).toBe("first.updated@example.com");

    await expect(
      auth.updateAccount(first, {
        name: "First Updated",
        email: second.email!,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires the current password before replacing it and revokes nothing itself", async () => {
    const user = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });

    await expect(
      auth.changePassword(user, "WrongPass1", "AnotherPass2")
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await auth.changePassword(user, "SecurePass1", "AnotherPass2");
    expect(
      await auth.authenticateLocalUser("learner@example.com", "SecurePass1")
    ).toBeNull();
    expect(
      (await auth.authenticateLocalUser("learner@example.com", "AnotherPass2"))?.id
    ).toBe(user.id);
  });

  it("deletes the account and all of its sessions", async () => {
    // The first registered account is the administrator, so create an
    // administrator first and delete a regular learner account below.
    await auth.registerLocalUser({
      name: "Admin",
      email: "admin@example.com",
      password: "SecurePass1",
    });
    const user = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });
    const res = createResponse();
    await auth.issueSession(createRequest(), res, user);
    await db.getProfile(user.id);

    await expect(
      auth.deleteAccount(user, { confirmation: "delete", password: "SecurePass1" })
    ).rejects.toThrow(/Type DELETE/i);

    await auth.deleteAccount(user, {
      confirmation: "DELETE",
      password: "SecurePass1",
    });
    expect(await db.getUserById(user.id)).toBeUndefined();
    expect(await db.listSessions(user.id)).toHaveLength(0);
  });

  it("protects the last active administrator from deleting their own account", async () => {
    const admin = await auth.registerLocalUser({
      name: "Admin",
      email: "admin@example.com",
      password: "SecurePass1",
    });

    await expect(
      auth.deleteAccount(admin, {
        confirmation: "DELETE",
        password: "SecurePass1",
      })
    ).rejects.toThrow(/only active administrator/i);
  });
});

describe("admin guardrails", () => {
  it("returns a safe account list and flags the demo account", async () => {
    const admin = await auth.registerLocalUser({
      name: "Admin",
      email: "admin@example.com",
      password: "SecurePass1",
    });
    await local.upsertUser({
      openId: "local-demo-user",
      name: "Alex Morgan",
      email: "alex.morgan@example.com",
      loginMethod: "local",
    });

    const users = await adminService.listAdminUsers();
    const demo = users.find(user => user.isDemo);
    const listedAdmin = users.find(user => user.id === admin.id);

    expect(demo?.name).toBe("Alex Morgan");
    expect(listedAdmin?.role).toBe("admin");
    expect(listedAdmin?.hasPassword).toBe(true);
    expect(JSON.stringify(users)).not.toContain("passwordHash");
  });

  it("blocks self-moderation and any moderation of the demo account", async () => {
    const admin = await auth.registerLocalUser({
      name: "Admin",
      email: "admin@example.com",
      password: "SecurePass1",
    });
    const demo = await local.upsertUser({
      openId: "local-demo-user",
      name: "Alex Morgan",
      email: "alex.morgan@example.com",
      loginMethod: "local",
    });

    await expect(
      adminService.updateUserModeration(admin, {
        userId: admin.id,
        role: "user",
      })
    ).rejects.toThrow(/cannot change your own role/i);

    await expect(
      adminService.updateUserModeration(admin, {
        userId: demo.id,
        status: "disabled",
      })
    ).rejects.toThrow(/demo account cannot be moderated/i);
  });

  it("keeps at least one active administrator", async () => {
    const first = await auth.registerLocalUser({
      name: "First",
      email: "first@example.com",
      password: "SecurePass1",
    });
    const second = await auth.registerLocalUser({
      name: "Second",
      email: "second@example.com",
      password: "SecurePass1",
    });

    await adminService.updateUserModeration(first, {
      userId: second.id,
      role: "admin",
    });

    // Two active admins: demoting one is allowed.
    const demoted = await adminService.updateUserModeration(second, {
      userId: first.id,
      role: "user",
    });
    expect(demoted.role).toBe("user");

    // The remaining admin cannot demote or disable themselves, and cannot
    // delete the last administrator account.
    await expect(
      adminService.updateUserModeration(second, {
        userId: second.id,
        role: "user",
      })
    ).rejects.toThrow(/cannot change your own role/i);

    await expect(
      adminService.updateUserModeration(second, {
        userId: second.id,
        status: "disabled",
      })
    ).rejects.toThrow(/cannot change your own role/i);

    await expect(
      auth.deleteAccount(second, {
        confirmation: "DELETE",
        password: "SecurePass1",
      })
    ).rejects.toThrow(/only active administrator/i);
  });

  it("disabling a user revokes their sessions and signing them out is guarded", async () => {
    const admin = await auth.registerLocalUser({
      name: "Admin",
      email: "admin@example.com",
      password: "SecurePass1",
    });
    const learner = await auth.registerLocalUser({
      name: "Learner",
      email: "learner@example.com",
      password: "SecurePass1",
    });
    const res = createResponse();
    await auth.issueSession(createRequest(), res, learner);

    await expect(
      adminService.revokeUserSessions(admin, admin.id)
    ).rejects.toThrow(/Manage your own sessions/i);

    await adminService.revokeUserSessions(admin, learner.id);
    expect(await db.listSessions(learner.id)).toHaveLength(0);

    await auth.issueSession(createRequest(), createResponse(), learner);
    await adminService.updateUserModeration(admin, {
      userId: learner.id,
      status: "disabled",
    });
    expect(await db.listSessions(learner.id)).toHaveLength(0);
    expect((await db.getUserById(learner.id))?.status).toBe("disabled");
  });
});

describe("tRPC auth flow", () => {
  it("registers, authenticates the issued cookie, and lists the current session", async () => {
    const registration = await registerViaRouter(
      "Router Learner",
      "router@example.com"
    );
    const user = await authenticate(registration.cookie);
    expect(user.email).toBe("router@example.com");
    expect(user.sessionId).toBe(await sessionIdFromCookie(registration.cookie));

    const caller = appRouter.createCaller({
      req: requestWithCookie(registration.cookie),
      res: createResponse(),
      user,
      sessionId: user.sessionId,
    });
    const me = await caller.auth.me();
    expect(me?.id).toBe(user.id);
    expect(me?.role).toBe("admin");

    const sessions = await caller.auth.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].current).toBe(true);
  });

  it("revokes other devices, then signs out the current device", async () => {
    await registerViaRouter("Router Learner", "router@example.com");
    const first = await loginViaRouter("router@example.com");
    const second = await loginViaRouter("router@example.com");

    const firstUser = await authenticate(first.cookie);
    const firstCaller = appRouter.createCaller({
      req: requestWithCookie(first.cookie),
      res: createResponse(),
      user: firstUser,
      sessionId: firstUser.sessionId,
    });
    const secondSid = await sessionIdFromCookie(second.cookie);

    const otherResult = await firstCaller.auth.revokeSession({
      sessionId: secondSid,
    });
    expect(otherResult.signedOut).toBe(false);
    await expect(authenticate(second.cookie)).rejects.toThrow();

    const currentSid = await sessionIdFromCookie(first.cookie);
    const currentResult = await firstCaller.auth.revokeSession({
      sessionId: currentSid,
    });
    expect(currentResult.signedOut).toBe(true);
    await expect(authenticate(first.cookie)).rejects.toThrow();
  });

  it("lets an administrator promote, disable, and sign out another account", async () => {
    const adminRegistration = await registerViaRouter(
      "Router Admin",
      "admin@example.com"
    );
    await registerViaRouter("Router Learner", "learner@example.com");
    const admin = await authenticate(adminRegistration.cookie);

    const adminCaller = appRouter.createCaller({
      req: requestWithCookie(adminRegistration.cookie),
      res: createResponse(),
      user: admin,
      sessionId: admin.sessionId,
    });

    const users = await adminCaller.admin.listUsers();
    const learner = users.find(user => user.email === "learner@example.com");
    expect(learner).toBeTruthy();

    const promoted = await adminCaller.admin.updateUser({
      userId: learner!.id,
      role: "admin",
    });
    expect(promoted.role).toBe("admin");

    const disabled = await adminCaller.admin.updateUser({
      userId: learner!.id,
      status: "disabled",
    });
    expect(disabled.status).toBe("disabled");

    const revoked = await adminCaller.admin.revokeUserSessions({
      userId: learner!.id,
    });
    expect(revoked.success).toBe(true);
  });

  it("rate-limits repeated failed sign-ins", async () => {
    await registerViaRouter("Router Learner", "router@example.com");
    const req = createRequest({ "x-forwarded-for": "203.0.113.10" });
    const res = createResponse();
    const caller = appRouter.createCaller({ req, res, user: null });

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await expect(
        caller.auth.login({
          email: "router@example.com",
          password: "WrongPass1",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    await expect(
      caller.auth.login({
        email: "router@example.com",
        password: "WrongPass1",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
