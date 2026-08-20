import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { websiteAdminInvites, websiteAdmins } from "../drizzle/schema";
import { getDb } from "./db";
import { hashWebsiteAdminPassword, websiteAdminEmail } from "./websiteAdminAuth";

const INVITE_TTL_MS = 1000 * 60 * 60 * 72;

export type PublicWebsiteAdminInvite = {
  name: string;
  email: string;
  expiresAt: Date;
};

export type WebsiteAdminAccessRecord = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  lastSignedIn: Date | null;
  createdAt: Date;
};

export type WebsiteAdminInviteRecord = {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  activatedAt: Date | null;
  revokedAt: Date | null;
  status: "pending" | "activated" | "revoked" | "expired";
};

function statusForInvite(invite: { expiresAt: Date; activatedAt: Date | null; revokedAt: Date | null }): WebsiteAdminInviteRecord["status"] {
  if (invite.activatedAt) return "activated";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= Date.now()) return "expired";
  return "pending";
}

function randomInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashWebsiteAdminInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function toInviteRecord(invite: typeof websiteAdminInvites.$inferSelect): WebsiteAdminInviteRecord {
  return {
    id: invite.id,
    name: invite.name,
    email: invite.email,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    activatedAt: invite.activatedAt,
    revokedAt: invite.revokedAt,
    status: statusForInvite(invite),
  };
}

export async function listWebsiteAdminAccess() {
  const db = await getDb();
  if (!db) throw new Error("Website administrator access is temporarily unavailable.");

  const [admins, invites] = await Promise.all([
    db.select({
      id: websiteAdmins.id,
      name: websiteAdmins.name,
      email: websiteAdmins.email,
      isActive: websiteAdmins.isActive,
      lastSignedIn: websiteAdmins.lastSignedIn,
      createdAt: websiteAdmins.createdAt,
    }).from(websiteAdmins),
    db.select().from(websiteAdminInvites),
  ]);

  return {
    admins: admins
      .map(admin => ({ ...admin, isActive: admin.isActive === 1 }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.email.localeCompare(right.email)),
    invites: invites
      .map(toInviteRecord)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
  };
}

export async function createWebsiteAdminInvitation(input: { name: string; email: string; createdByAdminId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Website administrator access is temporarily unavailable.");

  const name = input.name.trim();
  const email = websiteAdminEmail(input.email);
  const existingAdmin = await db.select({ id: websiteAdmins.id }).from(websiteAdmins).where(eq(websiteAdmins.email, email)).limit(1);
  if (existingAdmin[0]) throw new Error("An innkeeper administrator already uses that email address.");

  const token = randomInvitationToken();
  const tokenHash = hashWebsiteAdminInvitationToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  const existingInvite = await db.select().from(websiteAdminInvites).where(eq(websiteAdminInvites.email, email)).limit(1);

  if (existingInvite[0]) {
    await db.update(websiteAdminInvites)
      .set({ name, tokenHash, createdByAdminId: input.createdByAdminId, expiresAt, activatedAt: null, revokedAt: null })
      .where(eq(websiteAdminInvites.id, existingInvite[0].id));
    return { invite: { ...toInviteRecord({ ...existingInvite[0], name, tokenHash, createdByAdminId: input.createdByAdminId, expiresAt, activatedAt: null, revokedAt: null }), status: "pending" as const }, token };
  }

  const created = await db.insert(websiteAdminInvites).values({ name, email, tokenHash, createdByAdminId: input.createdByAdminId, expiresAt });
  const inviteId = Number(created[0].insertId);
  return {
    invite: { id: inviteId, name, email, createdAt: now, expiresAt, activatedAt: null, revokedAt: null, status: "pending" as const },
    token,
  };
}

export async function getPublicWebsiteAdminInvitation(token: string): Promise<PublicWebsiteAdminInvite | null> {
  if (!token || token.length > 256) return null;
  const db = await getDb();
  if (!db) throw new Error("Website administrator access is temporarily unavailable.");

  const now = new Date();
  const matches = await db.select({ name: websiteAdminInvites.name, email: websiteAdminInvites.email, expiresAt: websiteAdminInvites.expiresAt })
    .from(websiteAdminInvites)
    .where(and(
      eq(websiteAdminInvites.tokenHash, hashWebsiteAdminInvitationToken(token)),
      isNull(websiteAdminInvites.activatedAt),
      isNull(websiteAdminInvites.revokedAt),
      gt(websiteAdminInvites.expiresAt, now),
    ))
    .limit(1);
  return matches[0] ?? null;
}

export async function activateWebsiteAdminInvitation(input: { token: string; password: string }) {
  if (!input.token || input.token.length > 256) throw new Error("This invitation is invalid or no longer active.");
  const db = await getDb();
  if (!db) throw new Error("Website administrator access is temporarily unavailable.");

  const tokenHash = hashWebsiteAdminInvitationToken(input.token);
  const passwordHash = await hashWebsiteAdminPassword(input.password);
  const now = new Date();

  await db.transaction(async tx => {
    const invitations = await tx.select().from(websiteAdminInvites).where(eq(websiteAdminInvites.tokenHash, tokenHash)).limit(1);
    const invitation = invitations[0];
    if (!invitation || invitation.activatedAt || invitation.revokedAt || invitation.expiresAt.getTime() <= now.getTime()) {
      throw new Error("This invitation is invalid or no longer active.");
    }

    const existingAdmins = await tx.select({ id: websiteAdmins.id }).from(websiteAdmins).where(eq(websiteAdmins.email, invitation.email)).limit(1);
    if (existingAdmins[0]) throw new Error("An innkeeper administrator already uses this email address.");

    const claim = await tx.update(websiteAdminInvites)
      .set({ activatedAt: now })
      .where(and(
        eq(websiteAdminInvites.id, invitation.id),
        isNull(websiteAdminInvites.activatedAt),
        isNull(websiteAdminInvites.revokedAt),
        gt(websiteAdminInvites.expiresAt, now),
      ));
    if (!claim[0].affectedRows) throw new Error("This invitation is invalid or no longer active.");

    await tx.insert(websiteAdmins).values({
      email: invitation.email,
      name: invitation.name,
      passwordHash,
      isActive: 1,
      lastSignedIn: now,
    });
  });
}

export async function revokeWebsiteAdministrator(adminId: number) {
  const db = await getDb();
  if (!db) throw new Error("Website administrator access is temporarily unavailable.");
  const result = await db.update(websiteAdmins)
    .set({ isActive: 0 })
    .where(and(eq(websiteAdmins.id, adminId), eq(websiteAdmins.isActive, 1)));
  return Boolean(result[0].affectedRows);
}

export async function revokeWebsiteAdminInvitation(inviteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Website administrator access is temporarily unavailable.");
  const result = await db.update(websiteAdminInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(websiteAdminInvites.id, inviteId), isNull(websiteAdminInvites.activatedAt), isNull(websiteAdminInvites.revokedAt)));
  return Boolean(result[0].affectedRows);
}

export function websiteAdminIdForUser(userId: number) {
  const id = -userId;
  return Number.isInteger(id) && id > 0 ? id : null;
}
