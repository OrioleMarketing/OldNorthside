import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { websiteAdmins, type WebsiteAdmin } from "../drizzle/schema";
import type { AuthUser } from "./auth";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";

const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_N = 16_384;
const PASSWORD_R = 8;
const PASSWORD_P = 1;
const SESSION_COOKIE = "old_northside_admin_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

type WebsiteAdminSession = { adminId: number; expiresAt: number };
type LoginAttempt = { count: number; resetAt: number };
const loginAttempts = new Map<string, LoginAttempt>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function derivePasswordKey(password: string, salt: string, N: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, PASSWORD_KEY_LENGTH, { N, r, p }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

function cookieValue(req: Request, name: string) {
  const source = req.headers.cookie ?? "";
  for (const part of source.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function sessionSignature(value: string) {
  if (!ENV.cookieSecret) throw new Error("A session secret is required for website administrator access.");
  return createHmac("sha256", ENV.cookieSecret).update(value).digest("base64url");
}

function sessionToken(session: WebsiteAdminSession) {
  const value = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${value}.${sessionSignature(value)}`;
}

function parseSessionToken(token?: string): WebsiteAdminSession | null {
  if (!token) return null;
  const [value, signature] = token.split(".");
  if (!value || !signature) return null;
  const expected = sessionSignature(value);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as WebsiteAdminSession;
    if (!Number.isInteger(parsed.adminId) || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function toContextUser(admin: WebsiteAdmin): AuthUser {
  return {
    id: -admin.id,
    name: admin.name,
    email: admin.email,
    role: "admin",
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
    lastSignedIn: admin.lastSignedIn ?? admin.createdAt,
  };
}

function loginAttemptKey(req: Request, email: string) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip ?? "unknown";
  return `${ip}:${normalizeEmail(email)}`;
}

export function ensureLoginAllowed(req: Request, email: string) {
  const attempt = loginAttempts.get(loginAttemptKey(req, email));
  if (!attempt) return;
  if (attempt.resetAt <= Date.now()) {
    loginAttempts.delete(loginAttemptKey(req, email));
    return;
  }
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    throw new Error("Too many sign-in attempts. Please wait 15 minutes and try again.");
  }
}

export function recordFailedLogin(req: Request, email: string) {
  const key = loginAttemptKey(req, email);
  const previous = loginAttempts.get(key);
  if (!previous || previous.resetAt <= Date.now()) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  loginAttempts.set(key, { count: previous.count + 1, resetAt: previous.resetAt });
}

export function clearLoginAttempts(req: Request, email: string) {
  loginAttempts.delete(loginAttemptKey(req, email));
}

export async function hashWebsiteAdminPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await derivePasswordKey(password, salt, PASSWORD_N, PASSWORD_R, PASSWORD_P);
  return `scrypt$${PASSWORD_N}$${PASSWORD_R}$${PASSWORD_P}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyWebsiteAdminPassword(password: string, encoded: string) {
  const [algorithm, n, r, p, salt, expected] = encoded.split("$");
  const workFactor = Number(n);
  const blockSize = Number(r);
  const parallelization = Number(p);
  if (
    algorithm !== "scrypt" ||
    !n ||
    !r ||
    !p ||
    !salt ||
    !expected ||
    !/^[A-Za-z0-9_-]+$/.test(salt) ||
    !/^[A-Za-z0-9_-]+$/.test(expected) ||
    !Number.isInteger(workFactor) ||
    workFactor < 2 ||
    workFactor > 1_048_576 ||
    (workFactor & (workFactor - 1)) !== 0 ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    blockSize > 64 ||
    !Number.isInteger(parallelization) ||
    parallelization < 1 ||
    parallelization > 16
  ) {
    return false;
  }

  try {
    const expectedBuffer = Buffer.from(expected, "base64url");
    if (expectedBuffer.length !== PASSWORD_KEY_LENGTH) return false;
    const derived = await derivePasswordKey(password, salt, workFactor, blockSize, parallelization);
    return timingSafeEqual(derived, expectedBuffer);
  } catch {
    return false;
  }
}

export async function getWebsiteAdminFromRequest(req: Request): Promise<AuthUser | null> {
  const session = parseSessionToken(cookieValue(req, SESSION_COOKIE));
  if (!session) return null;
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(websiteAdmins).where(eq(websiteAdmins.id, session.adminId)).limit(1);
  const admin = results[0];
  if (!admin || admin.isActive !== 1) return null;
  return toContextUser(admin);
}

export async function authenticateWebsiteAdmin(email: string, password: string): Promise<AuthUser | null> {
  const db = await getDb();
  if (!db) throw new Error("Website administrator access is temporarily unavailable.");
  const results = await db.select().from(websiteAdmins).where(eq(websiteAdmins.email, normalizeEmail(email))).limit(1);
  const admin = results[0];
  if (!admin || admin.isActive !== 1 || !(await verifyWebsiteAdminPassword(password, admin.passwordHash))) return null;
  const now = new Date();
  await db.update(websiteAdmins).set({ lastSignedIn: now }).where(eq(websiteAdmins.id, admin.id));
  return toContextUser({ ...admin, lastSignedIn: now });
}

export function setWebsiteAdminSession(res: Response, req: Request, user: AuthUser) {
  const adminId = -user.id;
  if (!Number.isInteger(adminId) || adminId <= 0) throw new Error("Website administrator session could not be created.");
  res.cookie(SESSION_COOKIE, sessionToken({ adminId, expiresAt: Date.now() + SESSION_MAX_AGE_MS }), {
    ...getSessionCookieOptions(req),
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearWebsiteAdminSession(res: Response, req: Request) {
  res.clearCookie(SESSION_COOKIE, { ...getSessionCookieOptions(req), sameSite: "lax", maxAge: -1 });
}

export const WEBSITE_ADMIN_SESSION_COOKIE = SESSION_COOKIE;
export const websiteAdminEmail = normalizeEmail;
