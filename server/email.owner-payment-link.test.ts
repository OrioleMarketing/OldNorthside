import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reservations, rooms } from "../drizzle/schema";
import { getDb } from "./db";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class ResendMock {
    emails = { send: mocks.send };
  },
}));

import { sendOwnerPaymentLink } from "./email";

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for owner payment-link email coverage.");
  return db;
}

async function createFixture() {
  const db = await databaseOrThrow();
  const key = nanoid(10).toLowerCase();
  const slug = `payment-link-email-${key}`;
  await db.insert(rooms).values({
    slug,
    name: `Payment link validation ${key}`,
    summary: "Temporary payment-link email validation room.",
    bed: "Validation bed",
    bath: "Validation bath",
    weekdayRateCents: 12_500,
    weekendRateCents: 15_000,
    sortOrder: 99_996,
    isActive: 1,
  });
  const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
  if (!room) throw new Error("Unable to create payment-link email test room.");
  const bookingReference = `ON-EMAIL-${key}`.toUpperCase();
  await db.insert(reservations).values({
    bookingReference,
    roomId: room.id,
    guestName: "Payment Link Guest",
    guestEmail: "payment-link@example.test",
    guestPhone: "317-555-0101",
    guestCount: 1,
    checkIn: "2032-09-12",
    checkOut: "2032-09-14",
    status: "pending_deposit",
    source: "owner",
    nightlyRateCents: 12_500,
    subtotalCents: 25_000,
    stateTaxCents: 1_750,
    countyTaxCents: 750,
    totalCents: 27_500,
    depositDueCents: 13_750,
    balanceDueCents: 13_750,
  });
  const [reservation] = await db.select().from(reservations).where(eq(reservations.bookingReference, bookingReference)).limit(1);
  if (!reservation) throw new Error("Unable to create payment-link email test reservation.");
  return { roomId: room.id, reservationId: reservation.id, bookingReference };
}

async function removeFixture(roomId: number, reservationId: number) {
  const db = await databaseOrThrow();
  await db.delete(reservations).where(eq(reservations.id, reservationId));
  await db.delete(rooms).where(eq(rooms.id, roomId));
}

describe.sequential("owner payment-link email", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>> | undefined;

  beforeEach(async () => {
    process.env.RESEND_API_KEY = "re_owner_payment_link_mock";
    process.env.RESEND_FROM_EMAIL = "reservations@oldnorthsidebedandbreakfast.com";
    mocks.send.mockReset();
    fixture = await createFixture();
  });

  afterEach(async () => {
    if (fixture) await removeFixture(fixture.roomId, fixture.reservationId);
    fixture = undefined;
  });

  it("delivers a deposit payment-link email with the hosted checkout URL and stable idempotency key", async () => {
    mocks.send.mockResolvedValue({ data: { id: "re_payment_link_sent" }, error: null });

    const result = await sendOwnerPaymentLink({
      reservationId: fixture!.reservationId,
      checkoutUrl: "https://checkout.stripe.test/cs_payment_link",
      paymentKind: "deposit",
    });

    expect(result).toBe("sent");
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: "reservations@oldnorthsidebedandbreakfast.com",
      to: "payment-link@example.test",
      subject: expect.stringContaining("Secure first-night deposit link"),
      html: expect.stringContaining("https://checkout.stripe.test/cs_payment_link"),
      headers: { "Idempotency-Key": `old-northside-payment-link-${fixture!.reservationId}-deposit` },
    }));
  });

  it("surfaces provider rejection instead of reporting a failed payment-link email as delivered", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "Test provider rejection" } });

    await expect(sendOwnerPaymentLink({
      reservationId: fixture!.reservationId,
      checkoutUrl: "https://checkout.stripe.test/cs_payment_link_rejected",
      paymentKind: "deposit",
    })).rejects.toThrow("transactional email provider rejected the payment-link message");
  });
});
