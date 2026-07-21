import { eq } from "drizzle-orm";
import { websiteAdmins } from "../drizzle/schema";
import { getDb } from "../server/db";

const db = await getDb();
if (!db) throw new Error("Database connection is unavailable.");
const records = await db.select({ id: websiteAdmins.id, name: websiteAdmins.name, email: websiteAdmins.email, isActive: websiteAdmins.isActive, createdAt: websiteAdmins.createdAt }).from(websiteAdmins).where(eq(websiteAdmins.email, "bruce@oriolemarketing.com")).limit(1);
if (!records[0] || records[0].isActive !== 1) throw new Error("Active initial website administrator record was not found.");
console.log(`Verified active website administrator: ${records[0].email}`);
