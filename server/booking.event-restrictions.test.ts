import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { bookingEventRestrictions, rooms } from "../drizzle/schema";
import { createEventRestriction, deleteEventRestriction, getAvailableRooms } from "./booking";
import { getDb } from "./db";

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for event-restriction coverage.");
  return db;
}

function dateOffset(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe.sequential("special-event booking restrictions", () => {
  it("enforces event booking windows and event-specific minimum stays", async () => {
    const db = await databaseOrThrow();
    const key = nanoid(12).toLowerCase();
    const slug = `event-rule-${key}`;
    await db.insert(rooms).values({
      slug,
      name: `Event rule room ${key}`,
      summary: "Temporary event-rule validation fixture.",
      bed: "Validation bed",
      bath: "Validation bath",
      weekdayRateCents: 12_500,
      weekendRateCents: 15_000,
      sortOrder: 99_995,
      isActive: 1,
    });
    const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room) throw new Error("Unable to create event-rule test room.");
    const eventStart = dateOffset(60);
    const twoNightCheckOut = dateOffset(62);
    const eventEnd = dateOffset(64);
    const threeNightCheckOut = dateOffset(63);

    const createdRestrictionIds: number[] = [];
    try {
      const futureWindow = await createEventRestriction({
        name: `Future opening ${key}`,
        eventStart,
        eventEnd,
        minimumNights: 1,
        bookingOpensOn: "2033-01-01",
      });
      if (!futureWindow) throw new Error("Unable to create future opening restriction.");
      createdRestrictionIds.push(futureWindow.id);

      await expect(getAvailableRooms(eventStart, twoNightCheckOut)).rejects.toThrow("reservations open on 2033-01-01");
      await deleteEventRestriction(futureWindow.id);
      createdRestrictionIds.pop();

      const minimumStay = await createEventRestriction({
        name: `Minimum stay ${key}`,
        eventStart,
        eventEnd,
        minimumNights: 3,
      });
      if (!minimumStay) throw new Error("Unable to create minimum-stay restriction.");
      createdRestrictionIds.push(minimumStay.id);

      await expect(getAvailableRooms(eventStart, twoNightCheckOut)).rejects.toThrow("requires a minimum stay of 3 nights");
      const availability = await getAvailableRooms(eventStart, threeNightCheckOut);
      expect(availability.some(item => item.room.id === room.id)).toBe(true);
    } finally {
      for (const restrictionId of createdRestrictionIds) {
        await db.delete(bookingEventRestrictions).where(eq(bookingEventRestrictions.id, restrictionId));
      }
      await db.delete(rooms).where(eq(rooms.id, room.id));
    }
  });
});
