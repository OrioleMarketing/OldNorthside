import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { bookingEmailEvents, channelSyncEvents, reservationAuditEvents, reservations, rooms } from "../drizzle/schema";
import { cancelReservationForOwner, createOwnerReservation, getAvailableRooms, recordStripePayment } from "./booking";
import { getDb } from "./db";

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for owner-workflow coverage.");
  return db;
}

async function removeFixture(roomId: number) {
  const db = await databaseOrThrow();
  const roomReservations = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.roomId, roomId));
  const reservationIds = roomReservations.map(reservation => reservation.id);
  if (reservationIds.length > 0) {
    await db.delete(reservationAuditEvents).where(inArray(reservationAuditEvents.reservationId, reservationIds));
    await db.delete(bookingEmailEvents).where(inArray(bookingEmailEvents.reservationId, reservationIds));
    await db.delete(channelSyncEvents).where(inArray(channelSyncEvents.reservationId, reservationIds));
    await db.delete(reservations).where(inArray(reservations.id, reservationIds));
  }
  await db.delete(rooms).where(eq(rooms.id, roomId));
}

describe.sequential("owner reservation and cancellation workflow", () => {
  it("records an owner reservation, securely records payment-method consent, and releases inventory after cancellation", async () => {
    const db = await databaseOrThrow();
    const key = nanoid(12).toLowerCase();
    const slug = `owner-workflow-${key}`;
    await db.insert(rooms).values({
      slug,
      name: `Owner workflow room ${key}`,
      summary: "Temporary owner-workflow test room.",
      bed: "Validation bed",
      bath: "Validation bath",
      weekdayRateCents: 12_500,
      weekendRateCents: 15_000,
      sortOrder: 99_997,
      isActive: 1,
    });
    const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room) throw new Error("Unable to create owner-workflow test room.");

    try {
      const created = await createOwnerReservation({
        roomId: room.id,
        checkIn: "2032-04-11",
        checkOut: "2032-04-13",
        guestName: "Owner Workflow Validation",
        guestEmail: "owner-workflow@example.test",
        guestPhone: "317-555-0115",
        guestCount: 2,
        markDepositCollected: false,
      });
      expect(created.reservation.source).toBe("owner");
      expect(created.reservation.status).toBe("pending_deposit");

      const unavailable = await getAvailableRooms("2032-04-11", "2032-04-13");
      expect(unavailable.some(item => item.room.id === room.id)).toBe(false);

      const confirmed = await recordStripePayment({
        reservationId: created.reservation.id,
        paymentKind: "deposit",
        paymentIntentId: `pi_owner_deposit_${key}`,
        stripeCustomerId: `cus_owner_${key}`,
        stripePaymentMethodId: `pm_owner_${key}`,
        savePaymentMethodForBalance: true,
      });
      expect(confirmed.status).toBe("confirmed");
      expect(confirmed.stripeCustomerId).toBe(`cus_owner_${key}`);
      expect(confirmed.stripePaymentMethodId).toBe(`pm_owner_${key}`);
      expect(confirmed.paymentMethodConsentAt).toBeInstanceOf(Date);

      const cancelled = await cancelReservationForOwner({
        reservationId: created.reservation.id,
        actorUserId: 42,
        reason: "Guest requested cancellation during workflow validation.",
      });
      expect(cancelled.reservation.status).toBe("cancelled");
      expect(cancelled.reservation.cancelledAt).toBeInstanceOf(Date);
      expect(cancelled.reservation.cancelledByUserId).toBe(42);
      expect(cancelled.reservation.cancellationReason).toContain("Guest requested cancellation");

      const released = await getAvailableRooms("2032-04-11", "2032-04-13");
      expect(released.some(item => item.room.id === room.id)).toBe(true);

      const audit = await db.select().from(reservationAuditEvents).where(eq(reservationAuditEvents.reservationId, created.reservation.id));
      expect(audit.some(event => event.action === "reservation_cancelled" && event.actorUserId === 42)).toBe(true);
      const reminder = await db.select().from(bookingEmailEvents).where(eq(bookingEmailEvents.reservationId, created.reservation.id)).limit(1);
      expect(reminder[0]?.status).toBe("cancelled");
    } finally {
      await removeFixture(room.id);
    }
  });
});
