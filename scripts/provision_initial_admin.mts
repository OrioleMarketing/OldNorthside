import { eq } from "drizzle-orm";
import { websiteAdmins } from "../drizzle/schema";
import { getDb } from "../server/db";
import { hashWebsiteAdminPassword, websiteAdminEmail } from "../server/websiteAdminAuth";

const name = process.env.INITIAL_ADMIN_NAME?.trim() || "Bruce A Mayo";
const email = websiteAdminEmail(process.env.INITIAL_ADMIN_EMAIL || "Bruce@OrioleMarketing.com");
const password = process.env.INITIAL_ADMIN_PASSWORD;

if (!password || password.length < 12) {
  throw new Error("INITIAL_ADMIN_PASSWORD must be supplied securely and be at least 12 characters.");
}

const db = await getDb();
if (!db) throw new Error("Database connection is unavailable.");

const passwordHash = await hashWebsiteAdminPassword(password);
const existing = await db.select().from(websiteAdmins).where(eq(websiteAdmins.email, email)).limit(1);

if (existing[0]) {
  await db.update(websiteAdmins).set({ name, passwordHash, isActive: 1, updatedAt: new Date() }).where(eq(websiteAdmins.id, existing[0].id));
  console.log("Initial website administrator refreshed.");
} else {
  await db.insert(websiteAdmins).values({ name, email, passwordHash, isActive: 1 });
  console.log("Initial website administrator created.");
}
