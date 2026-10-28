import type { User } from "../drizzle/schema";
import * as db from "./db";
import { AuthError } from "./authService";

const DEMO_OPEN_ID = "local-demo-user";

export type AdminUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  status: "active" | "disabled";
  loginMethod: string | null;
  createdAt: Date;
  lastSignedIn: Date;
  activeSessions: number;
  hasPassword: boolean;
  isDemo: boolean;
};

export async function listAdminUsers(): Promise<AdminUser[]> {
  const users = await db.listAllUsers();
  const sessionCounts = await Promise.all(
    users.map(user => db.countActiveSessions(user.id))
  );

  return users.map((user, index) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    loginMethod: user.loginMethod,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
    activeSessions: sessionCounts[index] ?? 0,
    hasPassword: Boolean(user.passwordHash),
    isDemo: user.openId === DEMO_OPEN_ID,
  }));
}

export async function updateUserModeration(
  actor: User,
  input: {
    userId: number;
    role?: "user" | "admin";
    status?: "active" | "disabled";
  }
) {
  const target = await db.getUserById(input.userId);
  if (!target) throw new AuthError("That user no longer exists.");

  if (target.id === actor.id) {
    const changesSelf =
      (input.role !== undefined && input.role !== target.role) ||
      (input.status !== undefined && input.status !== target.status);
    if (changesSelf) {
      throw new AuthError(
        "You cannot change your own role or account status."
      );
    }
    return target;
  }

  if (target.openId === DEMO_OPEN_ID) {
    throw new AuthError("The demo account cannot be moderated.");
  }

  const removesActiveAdmin =
    target.role === "admin" &&
    target.status === "active" &&
    (input.role === "user" || input.status === "disabled");

  if (removesActiveAdmin) {
    const activeAdmins = await db.countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new AuthError("At least one active administrator is required.");
    }
  }

  const updated = await db.updateUserModeration(target.id, {
    role: input.role,
    status: input.status,
  });
  if (!updated) throw new AuthError("Could not update that user.");

  if (input.status === "disabled") {
    await db.revokeAllSessions(target.id);
  }

  return updated;
}

export async function revokeUserSessions(actor: User, userId: number) {
  if (actor.id === userId) {
    throw new AuthError(
      "Manage your own sessions from Settings instead."
    );
  }

  const target = await db.getUserById(userId);
  if (!target) throw new AuthError("That user no longer exists.");
  if (target.openId === DEMO_OPEN_ID) {
    throw new AuthError("The demo account cannot be moderated.");
  }

  await db.revokeAllSessions(userId);
  return { success: true } as const;
}
