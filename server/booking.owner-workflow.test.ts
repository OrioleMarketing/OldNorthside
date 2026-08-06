import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { bookingEmailEvents, channelSyncEvents, reservationAuditEvents, reservationBlocks, reservations, rooms } from "../drizzle/schema";
import { cancelOwnerBlock, cancelReservationForOwner, createOwnerBlock, createOwnerReservation, getAvailableRooms, recordStripePayment } from "./booking";
import { getDb } from "./db";

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for owner-workflow coverage.");
  return db;
}

function dateOffset(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function removeFixture(roomId: number) {
  const db = await databaseOrThrow();
  const roomReservations = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.roomId, roomId));
  const reservationIds = roomReservations.map(reservation => reservation.id);
  const roomBlocks = await db.select({ id: reservationBlocks.id }).from(reservationBlocks).where(eq(reservationBlocks.roomId, roomId));
  const blockIds = roomBlocks.map(block => block.id);
  if (blockIds.length > 0) {
    await db.delete(reservationAuditEvents).where(inArray(reservationAuditEvents.reservationBlockId, blockIds));
    await db.delete(reservationBlocks).where(inArray(reservationBlocks.id, blockIds));
  }
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
    const checkIn = dateOffset(30);
    const checkOut = dateOffset(32);

    try {
      const created = await createOwnerReservation({
        roomId: room.id,
        checkIn,
        checkOut,
        guestName: "Owner Workflow Validation",
        guestEmail: "owner-workflow@example.test",
        guestPhone: "317-555-0115",
        guestCount: 2,
        adultGuests: [
          { name: "Owner Workflow Validation", hasStayedBefore: false },
          { name: "Second Workflow Guest", hasStayedBefore: true },
        ],
        markDepositCollected: false,
      });
      expect(created.reservation.source).toBe("owner");
      expect(created.reservation.status).toBe("pending_deposit");
      expect(created.reservation.adultGuestDetailsJson).toBe(JSON.stringify([
        { name: "Owner Workflow Validation", hasStayedBefore: false },
        { name: "Second Workflow Guest", hasStayedBefore: true },
      ]));

      const unavailable = await getAvailableRooms(checkIn, checkOut);
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

      const released = await getAvailableRooms(checkIn, checkOut);
      expect(released.some(item => item.room.id === room.id)).toBe(true);

      const audit = await db.select().from(reservationAuditEvents).where(eq(reservationAuditEvents.reservationId, created.reservation.id));
      expect(audit.some(event => event.action === "reservation_cancelled" && event.actorUserId === 42)).toBe(true);
      const reminder = await db.select().from(bookingEmailEvents).where(eq(bookingEmailEvents.reservationId, created.reservation.id)).limit(1);
      expect(reminder[0]?.status).toBe("cancelled");
    } finally {
      await removeFixture(room.id);
    }
  });

  it("persists adult details and children, honors a full-stay selection, and releases an owner block when unblocked", async () => {
    const db = await databaseOrThrow();
    const key = nanoid(12).toLowerCase();
    const slug = `owner-unblock-${key}`;
    await db.insert(rooms).values({
      slug,
      name: `Owner unblock room ${key}`,
      summary: "Temporary room for owner block validation.",
      bed: "Validation bed",
      bath: "Validation bath",
      weekdayRateCents: 12_500,
      weekendRateCents: 15_000,
      sortOrder: 99_996,
      isActive: 1,
    });
    const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room) throw new Error("Unable to create owner-unblock test room.");
    const checkIn = dateOffset(45);
    const checkOut = dateOffset(47);

    try {
      const fullStay = await createOwnerReservation({
        roomId: room.id,
        checkIn,
        checkOut,
        guestName: "Child Count Validation",
        guestEmail: "child-count@example.test",
        guestPhone: "317-555-0116",
        guestCount: 2,
        childCount: 1,
        adultGuests: [
          { name: "Child Count Validation", hasStayedBefore: false },
          { name: "Second Adult Validation", hasStayedBefore: false },
        ],
        paymentSelection: "full_stay",
        markDepositCollected: false,
      });
      expect(fullStay.reservation.childCount).toBe(1);
      expect(fullStay.reservation.adultGuestDetailsJson).toContain("Second Adult Validation");
      expect(fullStay.reservation.balanceDueCents).toBe(0);
      expect(fullStay.reservation.depositDueCents).toBe(fullStay.reservation.totalCents);

      await cancelReservationForOwner({
        reservationId: fullStay.reservation.id,
        actorUserId: 42,
        reason: "Freeing dates for the owner-block validation.",
      });

      await createOwnerBlock({
        roomId: room.id,
        checkIn,
        checkOut,
        reason: "Maintenance validation block",
        createdByUserId: 42,
      });
      const [block] = await db.select().from(reservationBlocks).where(eq(reservationBlocks.roomId, room.id)).limit(1);
      if (!block) throw new Error("Unable to create owner block for validation.");

      const blockedAvailability = await getAvailableRooms(checkIn, checkOut);
      expect(blockedAvailability.some(item => item.room.id === room.id)).toBe(false);

      const cancelled = await cancelOwnerBlock({
        reservationBlockId: block.id,
        actorUserId: 42,
        reason: "Maintenance block cleared.",
      });
      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.cancellationReason).toBe("Maintenance block cleared.");

      const releasedAvailability = await getAvailableRooms(checkIn, checkOut);
      expect(releasedAvailability.some(item => item.room.id === room.id)).toBe(true);

      const blockAudit = await db.select().from(reservationAuditEvents).where(eq(reservationAuditEvents.reservationBlockId, block.id));
      expect(blockAudit.some(event => event.action === "block_cancelled" && event.actorUserId === 42)).toBe(true);
    } finally {
      await removeFixture(room.id);
    }
  });
});
