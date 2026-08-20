import { createHash, randomBytes } from "node:crypto";
import { COOKIE_NAME } from "@shared/const";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { magicLinks, type User } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import {
  createPasswordUser,
  getDb,
  getUserByEmail,
  getUserById,
  normalizeEmail,
  updateUserLastSignedIn,
} from "./db";

const PASSWORD_COST = 12;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REMEMBERED_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAGIC_LINK_MAX_AGE_MS = 15 * 60 * 1000;
const SESSION_ISSUER = "old-northside";
const SESSION_AUDIENCE = "old-northside-web";

type RateLimitEntry = { count: number; resetAt: number };
const authAttempts = new Map<string, RateLimitEntry>();
const dummyPasswordHash = bcrypt.hash(randomBytes(24).toString("base64url"), PASSWORD_COST);

export type AuthUser = Omit<User, "passwordHash">;

export function toAuthUser(user: User): AuthUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function requestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || "unknown";
  if (Array.isArray(forwarded)) return forwarded[0] || "unknown";
  return req.ip || "unknown";
}

function rateLimitKey(req: Request, scope: string, email: string) {
  return `${scope}:${requestIp(req)}:${normalizeEmail(email)}`;
}

export function enforceAuthRateLimit(
  req: Request,
  scope: "login" | "register" | "magic-link",
  email: string,
) {
  const key = rateLimitKey(req, scope, email);
  const now = Date.now();
  const windowMs = scope === "magic-link" ? 15 * 60 * 1000 : 10 * 60 * 1000;
  const maximum = scope === "magic-link" ? 5 : 8;
  const previous = authAttempts.get(key);
  if (!previous || previous.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (previous.count >= maximum) throw new Error("Too many authentication attempts. Please try again later.");
  authAttempts.set(key, { ...previous, count: previous.count + 1 });
}

export function clearAuthRateLimit(req: Request, scope: "login" | "register", email: string) {
  authAttempts.delete(rateLimitKey(req, scope, email));
}

function sessionSecret() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required for authentication.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createSessionToken(userId: number, expiresInMs = SESSION_MAX_AGE_MS) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + Math.floor(expiresInMs / 1000))
    .sign(sessionSecret());
}

export async function setSessionCookie(
  req: Request,
  res: Response,
  userId: number,
  rememberMe = false,
) {
  const maxAge = rememberMe ? REMEMBERED_SESSION_MAX_AGE_MS : SESSION_MAX_AGE_MS;
  const token = await createSessionToken(userId, maxAge);
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge });
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
}

export async function authenticateRequest(req: Request): Promise<AuthUser> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const token = cookies[COOKIE_NAME];
  if (!token) throw new Error("Missing session cookie.");
  const { payload } = await jwtVerify(token, sessionSecret(), {
    algorithms: ["HS256"],
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
  });
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Invalid session subject.");
  const user = await getUserById(userId);
  if (!user) throw new Error("Session user no longer exists.");
  return toAuthUser(user);
}

export async function registerWithPassword(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  if (await getUserByEmail(email)) throw new Error("An account already exists for this email address.");
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_COST);
  const user = await createPasswordUser({ name: input.name, email, passwordHash });
  if (!user) throw new Error("The account could not be created.");
  return toAuthUser(user);
}

export async function authenticateWithPassword(emailInput: string, password: string) {
  const user = await getUserByEmail(emailInput);
  const hash = user?.passwordHash ?? (await dummyPasswordHash);
  const valid = await bcrypt.compare(password, hash);
  if (!user || !user.passwordHash || !valid) return null;
  const lastSignedIn = await updateUserLastSignedIn(user.id);
  return toAuthUser({ ...user, lastSignedIn });
}

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMagicLink(emailInput: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const email = normalizeEmail(emailInput);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_MAX_AGE_MS);
  const token = randomBytes(32).toString("base64url");
  await db.update(magicLinks).set({ usedAt: now }).where(and(eq(magicLinks.email, email), isNull(magicLinks.usedAt)));
  const [result] = await db.insert(magicLinks).values({ email, tokenHash: digestToken(token), expiresAt });
  return { id: Number(result.insertId), email, token, expiresAt };
}

export async function invalidateMagicLinks(emailInput: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const email = normalizeEmail(emailInput);
  await db.update(magicLinks).set({ usedAt: new Date() }).where(and(eq(magicLinks.email, email), isNull(magicLinks.usedAt)));
}

export async function consumeMagicLink(token: string) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const hash = digestToken(token);
  const now = new Date();
  const [result] = await db.update(magicLinks).set({ usedAt: now })
    .where(and(eq(magicLinks.tokenHash, hash), isNull(magicLinks.usedAt), gt(magicLinks.expiresAt, now)));
  if (result.affectedRows !== 1) return null;
  const rows = await db.select().from(magicLinks).where(eq(magicLinks.tokenHash, hash)).limit(1);
  const record = rows[0];
  if (!record) return null;
  const user = await getUserByEmail(record.email);
  if (!user) return null;
  const lastSignedIn = await updateUserLastSignedIn(user.id);
  return toAuthUser({ ...user, lastSignedIn });
}
