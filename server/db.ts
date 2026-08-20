import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return result[0];
}

export async function createPasswordUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [result] = await db.insert(users).values({
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    role: "user",
    lastSignedIn: new Date(),
  });
  return getUserById(Number(result.insertId));
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const lastSignedIn = new Date();
  await db.update(users).set({ lastSignedIn }).where(eq(users.id, id));
  return lastSignedIn;
}

// TODO: add feature queries here as your schema grows.
