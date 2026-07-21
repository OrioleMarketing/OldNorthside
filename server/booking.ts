import { and, asc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  bookingEmailEvents,
  bookingSettings,
  reservationBlocks,
  reservations,
  rooms,
  type Room,
} from "../drizzle/schema";
import { getDb } from "./db";

export const HOLD_DURATION_MINUTES = 20;

export type PublicBookingSettings = {
  depositNights: number;
  paymentCollectionMode: "first_night_deposit" | "full_stay";
  balanceReminderDays: number;
  stateTaxRateBasisPoints: number;
  countyTaxRateBasisPoints: number;
  shortTermTaxThresholdNights: number;
  channelProvider: string | null;
  channelConnectionStatus: "not_connected" | "pending" | "connected" | "error";
};

export type ReservationQuote = {
  nights: number;
  nightlyBreakdown: Array<{ date: string; rateCents: number }>;
  subtotalCents: number;
  stateTaxCents: number;
  countyTaxCents: number;
  totalCents: number;
  depositDueCents: number;
  balanceDueCents: number;
  isShortTermTaxable: boolean;
};

export type BookingInput = {
  roomId: number;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCount: number;
};

const defaultSettings: PublicBookingSettings = {
  depositNights: 1,
  paymentCollectionMode: "first_night_deposit",
  balanceReminderDays: 7,
  stateTaxRateBasisPoints: 700,
  countyTaxRateBasisPoints: 300,
  shortTermTaxThresholdNights: 30,
  channelProvider: null,
  channelConnectionStatus: "not_connected",
};

function dateAtUtcMidnight(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Use valid check-in and check-out dates.");
  }
  return parsed;
}

export function getNights(checkIn: string, checkOut: string) {
  const start = dateAtUtcMidnight(checkIn);
  const end = dateAtUtcMidnight(checkOut);
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (nights < 1) {
    throw new Error("Check-out must be at least one night after check-in.");
  }
  return nights;
}

function getSettingsForQuote(settings: Partial<PublicBookingSettings>): PublicBookingSettings {
  return {
    ...defaultSettings,
    ...settings,
  };
}

function isWeekendNight(date: Date) {
  const day = date.getUTCDay();
  return day === 5 || day === 6;
}

export function calculateQuote(
  room: Pick<Room, "weekdayRateCents" | "weekendRateCents">,
  checkIn: string,
  checkOut: string,
  settings: Partial<PublicBookingSettings>,
): ReservationQuote {
  const normalizedSettings = getSettingsForQuote(settings);
  const nights = getNights(checkIn, checkOut);
  const current = dateAtUtcMidnight(checkIn);
  const nightlyBreakdown: Array<{ date: string; rateCents: number }> = [];

  for (let offset = 0; offset < nights; offset += 1) {
    const stayDate = new Date(current.getTime() + offset * 86_400_000);
    nightlyBreakdown.push({
      date: stayDate.toISOString().slice(0, 10),
      rateCents: isWeekendNight(stayDate) ? room.weekendRateCents : room.weekdayRateCents,
    });
  }

  const subtotalCents = nightlyBreakdown.reduce((sum, night) => sum + night.rateCents, 0);
  const isShortTermTaxable = nights < normalizedSettings.shortTermTaxThresholdNights;
  const stateTaxCents = isShortTermTaxable
    ? Math.round((subtotalCents * normalizedSettings.stateTaxRateBasisPoints) / 10_000)
    : 0;
  const countyTaxCents = isShortTermTaxable
    ? Math.round((subtotalCents * normalizedSettings.countyTaxRateBasisPoints) / 10_000)
    : 0;
  const totalCents = subtotalCents + stateTaxCents + countyTaxCents;
  const depositNightCount = Math.min(Math.max(normalizedSettings.depositNights, 1), nights);
  const depositRoomCents = nightlyBreakdown
    .slice(0, depositNightCount)
    .reduce((sum, night) => sum + night.rateCents, 0);
  const depositTaxCents = isShortTermTaxable
    ? Math.round(
        (depositRoomCents *
          (normalizedSettings.stateTaxRateBasisPoints + normalizedSettings.countyTaxRateBasisPoints)) /
          10_000,
      )
    : 0;
  const depositDueCents = normalizedSettings.paymentCollectionMode === "full_stay"
    ? totalCents
    : depositRoomCents + depositTaxCents;

  return {
    nights,
    nightlyBreakdown,
    subtotalCents,
    stateTaxCents,
    countyTaxCents,
    totalCents,
    depositDueCents,
    balanceDueCents: totalCents - depositDueCents,
    isShortTermTaxable,
  };
}

export async function getPublicSettings(): Promise<PublicBookingSettings> {
  const db = await getDb();
  if (!db) return defaultSettings;
  const result = await db.select().from(bookingSettings).limit(1);
  const settings = result[0];
  if (!settings) return defaultSettings;
  return {
    depositNights: settings.depositNights,
    paymentCollectionMode: settings.paymentCollectionMode,
    balanceReminderDays: settings.balanceReminderDays,
    stateTaxRateBasisPoints: settings.stateTaxRateBasisPoints,
    countyTaxRateBasisPoints: settings.countyTaxRateBasisPoints,
    shortTermTaxThresholdNights: settings.shortTermTaxThresholdNights,
    channelProvider: settings.channelProvider,
    channelConnectionStatus: settings.channelConnectionStatus,
  };
}

export async function getBalanceReminderScheduleTaskUid() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ taskUid: bookingSettings.balanceReminderScheduleTaskUid }).from(bookingSettings).limit(1);
  return result[0]?.taskUid ?? null;
}

export async function hasBalanceReminderScheduleTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select({ id: bookingSettings.id })
    .from(bookingSettings)
    .where(eq(bookingSettings.balanceReminderScheduleTaskUid, taskUid))
    .limit(1);
  return Boolean(result[0]);
}

export async function setBalanceReminderScheduleTaskUid(taskUid: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const current = await db.select({ id: bookingSettings.id }).from(bookingSettings).limit(1);
  if (!current[0]) {
    await db.insert(bookingSettings).values({ ...defaultSettings, balanceReminderScheduleTaskUid: taskUid });
  } else {
    await db.update(bookingSettings).set({ balanceReminderScheduleTaskUid: taskUid }).where(eq(bookingSettings.id, current[0].id));
  }
}

export async function getActiveRooms() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(rooms)
    .where(eq(rooms.isActive, 1))
    .orderBy(asc(rooms.sortOrder));
}

async function getUnavailableRoomIds(checkIn: string, checkOut: string) {
  const db = await getDb();
  if (!db) return new Set<number>();
  const now = new Date();
  const reservationsInRange = await db
    .select({ roomId: reservations.roomId })
    .from(reservations)
    .where(
      and(
        lt(reservations.checkIn, checkOut),
        gt(reservations.checkOut, checkIn),
        or(
          eq(reservations.status, "confirmed"),
          and(
            inArray(reservations.status, ["hold", "pending_deposit"]),
            gt(reservations.holdExpiresAt, now),
          ),
        ),
      ),
    );
  const blocksInRange = await db
    .select({ roomId: reservationBlocks.roomId })
    .from(reservationBlocks)
    .where(
      and(
        lt(reservationBlocks.checkIn, checkOut),
        gt(reservationBlocks.checkOut, checkIn),
      ),
    );
  return new Set([...reservationsInRange.map(item => item.roomId), ...blocksInRange.map(item => item.roomId)]);
}

export async function getAvailableRooms(checkIn: string, checkOut: string) {
  getNights(checkIn, checkOut);
  const [activeRooms, settings, unavailableRoomIds] = await Promise.all([
    getActiveRooms(),
    getPublicSettings(),
    getUnavailableRoomIds(checkIn, checkOut),
  ]);
  return activeRooms
    .filter(room => !unavailableRoomIds.has(room.id))
    .map(room => ({ room, quote: calculateQuote(room, checkIn, checkOut, settings) }));
}

function generateBookingReference() {
  return `ONB-${nanoid(8).toUpperCase()}`;
}

export async function createReservationHold(input: BookingInput) {
  getNights(input.checkIn, input.checkOut);
  const db = await getDb();
  if (!db) throw new Error("Reservations are temporarily unavailable. Please try again shortly.");

  const created = await db.transaction(async tx => {
    // Serializes reservation creation for a room so two concurrent guests cannot both reserve its dates.
    await tx.execute(sql`SELECT id FROM rooms WHERE id = ${input.roomId} FOR UPDATE`);
    const roomResult = await tx
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, input.roomId), eq(rooms.isActive, 1)))
      .limit(1);
    const room = roomResult[0];
    if (!room) throw new Error("That room is no longer available.");

    const now = new Date();
    const reservationConflict = await tx
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.roomId, input.roomId),
          lt(reservations.checkIn, input.checkOut),
          gt(reservations.checkOut, input.checkIn),
          or(
            eq(reservations.status, "confirmed"),
            and(
              inArray(reservations.status, ["hold", "pending_deposit"]),
              gt(reservations.holdExpiresAt, now),
            ),
          ),
        ),
      )
      .limit(1);
    const blockConflict = await tx
      .select({ id: reservationBlocks.id })
      .from(reservationBlocks)
      .where(
        and(
          eq(reservationBlocks.roomId, input.roomId),
          lt(reservationBlocks.checkIn, input.checkOut),
          gt(reservationBlocks.checkOut, input.checkIn),
        ),
      )
      .limit(1);
    if (reservationConflict[0] || blockConflict[0]) {
      throw new Error("Those dates have just become unavailable. Please choose another room or date.");
    }

    const settingsResult = await tx.select().from(bookingSettings).limit(1);
    const settings = settingsResult[0];
    const quote = calculateQuote(room, input.checkIn, input.checkOut, settings ?? defaultSettings);
    const holdExpiresAt = new Date(now.getTime() + HOLD_DURATION_MINUTES * 60_000);
    const bookingReference = generateBookingReference();

    await tx.insert(reservations).values({
      bookingReference,
      roomId: room.id,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      guestCount: input.guestCount,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      status: "pending_deposit",
      source: "direct",
      nightlyRateCents: quote.nightlyBreakdown[0]?.rateCents ?? room.weekdayRateCents,
      subtotalCents: quote.subtotalCents,
      stateTaxCents: quote.stateTaxCents,
      countyTaxCents: quote.countyTaxCents,
      totalCents: quote.totalCents,
      depositDueCents: quote.depositDueCents,
      balanceDueCents: quote.balanceDueCents,
      holdExpiresAt,
    });

    const reservationResult = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.bookingReference, bookingReference))
      .limit(1);
    const reservation = reservationResult[0];
    if (!reservation) throw new Error("The reservation hold could not be created.");
    return { room, reservation, quote };
  });

  return created;
}

export async function saveDepositCheckoutSession(reservationId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(reservations)
    .set({ stripeDepositCheckoutSessionId: sessionId })
    .where(eq(reservations.id, reservationId));
}

export async function saveBalanceCheckoutSession(reservationId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(reservations)
    .set({ stripeBalanceCheckoutSessionId: sessionId })
    .where(eq(reservations.id, reservationId));
}

export async function expireReservationHold(reservationId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(reservations)
    .set({ status: "expired" })
    .where(and(eq(reservations.id, reservationId), eq(reservations.status, "pending_deposit")));
}

function reminderDate(checkIn: string, reminderDays: number) {
  const date = dateAtUtcMidnight(checkIn);
  date.setUTCDate(date.getUTCDate() - reminderDays);
  // Preserve a daytime send window and avoid a date-only timestamp around DST transitions.
  date.setUTCHours(14, 0, 0, 0);
  return date;
}

export async function recordStripePayment(input: {
  reservationId: number;
  paymentKind: "deposit" | "balance";
  paymentIntentId?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while recording payment.");
  const reservationResult = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, input.reservationId))
    .limit(1);
  const reservation = reservationResult[0];
  if (!reservation) throw new Error("Reservation not found.");

  const now = new Date();
  if (input.paymentKind === "deposit") {
    if (reservation.depositPaidAt) return reservation;
    await db
      .update(reservations)
      .set({
        status: "confirmed",
        depositPaidAt: now,
        stripeDepositPaymentIntentId: input.paymentIntentId ?? reservation.stripeDepositPaymentIntentId,
      })
      .where(eq(reservations.id, reservation.id));

    if (reservation.balanceDueCents > 0) {
      const settings = await getPublicSettings();
      const scheduledFor = reminderDate(reservation.checkIn, settings.balanceReminderDays);
      await db
        .insert(bookingEmailEvents)
        .values({
          reservationId: reservation.id,
          kind: "balance_reminder",
          status: "scheduled",
          scheduledFor: scheduledFor > now ? scheduledFor : now,
        })
        .onDuplicateKeyUpdate({ set: { status: "scheduled", scheduledFor: scheduledFor > now ? scheduledFor : now } });
    }
  } else {
    if (reservation.balancePaidAt) return reservation;
    await db
      .update(reservations)
      .set({
        balancePaidAt: now,
        stripeBalancePaymentIntentId: input.paymentIntentId ?? reservation.stripeBalancePaymentIntentId,
      })
      .where(eq(reservations.id, reservation.id));
    await db
      .update(bookingEmailEvents)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(bookingEmailEvents.reservationId, reservation.id),
          eq(bookingEmailEvents.kind, "balance_reminder"),
          or(eq(bookingEmailEvents.status, "scheduled"), eq(bookingEmailEvents.status, "failed")),
        ),
      );
  }

  const updated = await db.select().from(reservations).where(eq(reservations.id, reservation.id)).limit(1);
  return updated[0] ?? reservation;
}

export async function getReservationByReference(bookingReference: string, guestEmail: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ reservation: reservations, room: rooms })
    .from(reservations)
    .innerJoin(rooms, eq(reservations.roomId, rooms.id))
    .where(and(eq(reservations.bookingReference, bookingReference), eq(reservations.guestEmail, guestEmail)))
    .limit(1);
  return result[0];
}

export async function listOwnerReservations(range?: { start?: string; end?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (range?.start) conditions.push(gt(reservations.checkOut, range.start));
  if (range?.end) conditions.push(lt(reservations.checkIn, range.end));
  return db
    .select({ reservation: reservations, room: rooms })
    .from(reservations)
    .innerJoin(rooms, eq(reservations.roomId, rooms.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(reservations.checkIn), asc(rooms.sortOrder));
}

export async function createOwnerBlock(input: {
  roomId: number;
  checkIn: string;
  checkOut: string;
  reason: string;
  createdByUserId: number;
}) {
  getNights(input.checkIn, input.checkOut);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  await db.insert(reservationBlocks).values(input);
}

export async function listOwnerBlocks(range?: { start?: string; end?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (range?.start) conditions.push(gt(reservationBlocks.checkOut, range.start));
  if (range?.end) conditions.push(lt(reservationBlocks.checkIn, range.end));
  return db
    .select({ block: reservationBlocks, room: rooms })
    .from(reservationBlocks)
    .innerJoin(rooms, eq(reservationBlocks.roomId, rooms.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(reservationBlocks.checkIn), asc(rooms.sortOrder));
}

export async function updateBookingSettings(input: Partial<PublicBookingSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const current = await db.select().from(bookingSettings).limit(1);
  if (!current[0]) {
    await db.insert(bookingSettings).values({ ...defaultSettings, ...input });
  } else {
    await db.update(bookingSettings).set(input).where(eq(bookingSettings.id, current[0].id));
  }
  return getPublicSettings();
}
