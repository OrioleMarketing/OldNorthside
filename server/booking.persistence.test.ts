import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { bookingEmailEvents, channelSyncEvents, reservations, rooms } from "../drizzle/schema";
import { createReservationHold, getAvailableRooms, recordStripePayment } from "./booking";
import { getDb } from "./db";

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for booking persistence coverage.");
  return db;
}

function dateOffset(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function removeBookingFixture(roomId: number) {
  const db = await databaseOrThrow();
  const roomReservations = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(eq(reservations.roomId, roomId));
  const reservationIds = roomReservations.map(reservation => reservation.id);

  if (reservationIds.length > 0) {
    await db.delete(bookingEmailEvents).where(inArray(bookingEmailEvents.reservationId, reservationIds));
    await db.delete(channelSyncEvents).where(inArray(channelSyncEvents.reservationId, reservationIds));
    await db.delete(reservations).where(inArray(reservations.id, reservationIds));
  }
  await db.delete(rooms).where(eq(rooms.id, roomId));
}

describe.sequential("booking persistence safeguards", () => {
  it("excludes an active hold from availability, rejects an overlapping hold, and advances paid reservations through reminder states", async () => {
    const db = await databaseOrThrow();
    const key = nanoid(12).toLowerCase();
    const slug = `booking-validation-${key}`;
    await db.insert(rooms).values({
      slug,
      name: `Automated booking validation ${key}`,
      summary: "Temporary automated validation fixture.",
      bed: "Validation bed",
      bath: "Validation bath",
      weekdayRateCents: 12_500,
      weekendRateCents: 15_000,
      sortOrder: 99_999,
      isActive: 1,
    });
    const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room) throw new Error("Unable to create booking validation room.");
    const checkIn = dateOffset(50);
    const checkOut = dateOffset(52);
    const overlapCheckIn = dateOffset(51);
    const overlapCheckOut = dateOffset(53);

    try {
      const initialHold = await createReservationHold({
        roomId: room.id,
        checkIn,
        checkOut,
        guestName: "Automated Booking Validation",
        guestEmail: "booking-validation@example.test",
        guestPhone: "317-555-0110",
        guestCount: 1,
        adultGuests: [{ name: "Automated Booking Validation", hasStayedBefore: false }],
      });

      expect(initialHold.reservation.status).toBe("pending_deposit");
      expect(initialHold.quote.depositDueCents).toBeGreaterThan(0);
      expect(initialHold.quote.balanceDueCents).toBeGreaterThan(0);

      const availability = await getAvailableRooms(checkIn, checkOut);
      expect(availability.some(item => item.room.id === room.id)).toBe(false);

      await expect(
        createReservationHold({
          roomId: room.id,
          checkIn: overlapCheckIn,
          checkOut: overlapCheckOut,
          guestName: "Overlapping Validation",
          guestEmail: "overlap-validation@example.test",
          guestPhone: "317-555-0111",
          guestCount: 1,
          adultGuests: [{ name: "Overlapping Validation", hasStayedBefore: false }],
        }),
      ).rejects.toThrow("Those dates have just become unavailable");

      const confirmed = await recordStripePayment({
        reservationId: initialHold.reservation.id,
        paymentKind: "deposit",
        paymentIntentId: `pi_validation_deposit_${key}`,
      });
      expect(confirmed.status).toBe("confirmed");
      expect(confirmed.depositPaidAt).toBeInstanceOf(Date);
      expect(confirmed.stripeDepositPaymentIntentId).toBe(`pi_validation_deposit_${key}`);

      const reminder = await db
        .select()
        .from(bookingEmailEvents)
        .where(eq(bookingEmailEvents.reservationId, initialHold.reservation.id))
        .limit(1);
      expect(reminder[0]).toMatchObject({ kind: "balance_reminder", status: "scheduled" });
      expect(reminder[0]?.scheduledFor).toBeInstanceOf(Date);

      const balancePaid = await recordStripePayment({
        reservationId: initialHold.reservation.id,
        paymentKind: "balance",
        paymentIntentId: `pi_validation_balance_${key}`,
      });
      expect(balancePaid.balancePaidAt).toBeInstanceOf(Date);
      expect(balancePaid.stripeBalancePaymentIntentId).toBe(`pi_validation_balance_${key}`);

      const cancelledReminder = await db
        .select()
        .from(bookingEmailEvents)
        .where(eq(bookingEmailEvents.reservationId, initialHold.reservation.id))
        .limit(1);
      expect(cancelledReminder[0]?.status).toBe("cancelled");
    } finally {
      await removeBookingFixture(room.id);
    }
  });
});
