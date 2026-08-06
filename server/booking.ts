import { and, asc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  bookingEmailEvents,
  bookingEventRestrictions,
  bookingSettings,
  channelInventoryBlocks,
  reservationAuditEvents,
  reservationBlocks,
  reservations,
  rooms,
  type Room,
} from "../drizzle/schema";
import { getDb } from "./db";
import { queueOutboundAvailabilityUpdate } from "./channelSync";

export const HOLD_DURATION_MINUTES = 20;
export const MAX_STAY_NIGHTS = 28;
export const MINIMUM_BOOKING_LEAD_DAYS = 1;
export const MAX_ADVANCE_BOOKING_DAYS = 160;

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
  firstNightDepositDueCents: number;
  depositDueCents: number;
  balanceDueCents: number;
  isShortTermTaxable: boolean;
};

export type EventRestrictionInput = {
  name: string;
  eventStart: string;
  eventEnd: string;
  minimumNights: number;
  bookingOpensOn?: string | null;
  bookingClosesOn?: string | null;
};

export type BookingInput = {
  roomId: number;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCount: number;
  childCount?: number;
  adultGuests: Array<{ name: string; hasStayedBefore: boolean }>;
  paymentSelection?: "deposit" | "full_stay";
  hasPet?: boolean;
  dogCount?: number;
  dogsUnder25Lbs?: boolean;
  petPolicyAcknowledged?: boolean;
  savePaymentMethodForBalance?: boolean;
};

const defaultSettings: PublicBookingSettings = {
  depositNights: 1,
  paymentCollectionMode: "first_night_deposit",
  balanceReminderDays: 6,
  stateTaxRateBasisPoints: 700,
  countyTaxRateBasisPoints: 1000,
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
  if (nights > MAX_STAY_NIGHTS) {
    throw new Error(`Reservations are limited to a maximum of ${MAX_STAY_NIGHTS} nights.`);
  }
  return nights;
}

function indianapolisDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not determine the local booking date.");
  return `${year}-${month}-${day}`;
}

export function earliestBookableCheckIn(now = new Date()) {
  const today = dateAtUtcMidnight(indianapolisDateKey(now));
  today.setUTCDate(today.getUTCDate() + MINIMUM_BOOKING_LEAD_DAYS);
  return today.toISOString().slice(0, 10);
}

export function latestBookableCheckIn(now = new Date()) {
  const today = dateAtUtcMidnight(indianapolisDateKey(now));
  today.setUTCDate(today.getUTCDate() + MAX_ADVANCE_BOOKING_DAYS);
  return today.toISOString().slice(0, 10);
}

function assertBookingLeadTime(checkIn: string, now = new Date()) {
  const earliest = earliestBookableCheckIn(now);
  if (checkIn < earliest) {
    throw new Error(`Reservations must be made at least ${MINIMUM_BOOKING_LEAD_DAYS} day in advance.`);
  }
}

export function assertBookingAdvanceWindow(checkIn: string, now = new Date()) {
  const latest = latestBookableCheckIn(now);
  if (checkIn > latest) {
    throw new Error(`Reservations may be made up to ${MAX_ADVANCE_BOOKING_DAYS} days in advance.`);
  }
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
  const firstNightDepositDueCents = depositRoomCents + depositTaxCents;
  const depositDueCents = normalizedSettings.paymentCollectionMode === "full_stay"
    ? totalCents
    : firstNightDepositDueCents;

  return {
    nights,
    nightlyBreakdown,
    subtotalCents,
    stateTaxCents,
    countyTaxCents,
    totalCents,
    firstNightDepositDueCents,
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
        eq(reservationBlocks.status, "active"),
      ),
    );
  const channelBlocksInRange = await db
    .select({ roomId: channelInventoryBlocks.roomId })
    .from(channelInventoryBlocks)
    .where(
      and(
        lt(channelInventoryBlocks.checkIn, checkOut),
        gt(channelInventoryBlocks.checkOut, checkIn),
        inArray(channelInventoryBlocks.status, ["active", "conflict"]),
      ),
    );
  return new Set([
    ...reservationsInRange.map(item => item.roomId),
    ...blocksInRange.map(item => item.roomId),
    ...channelBlocksInRange.map(item => item.roomId),
  ]);
}

function validateEventRestrictionInput(input: EventRestrictionInput) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) throw new Error("Enter a special-event name between 2 and 160 characters.");
  const eventStart = dateAtUtcMidnight(input.eventStart);
  const eventEnd = dateAtUtcMidnight(input.eventEnd);
  if (eventEnd <= eventStart) throw new Error("The special-event end date must be after its start date.");
  if (!Number.isInteger(input.minimumNights) || input.minimumNights < 1 || input.minimumNights > MAX_STAY_NIGHTS) {
    throw new Error(`Special-event minimum stays must be between one and ${MAX_STAY_NIGHTS} nights.`);
  }
  const bookingOpensOn = input.bookingOpensOn?.trim() || null;
  const bookingClosesOn = input.bookingClosesOn?.trim() || null;
  if (bookingOpensOn) dateAtUtcMidnight(bookingOpensOn);
  if (bookingClosesOn) dateAtUtcMidnight(bookingClosesOn);
  if (bookingOpensOn && bookingClosesOn && bookingClosesOn < bookingOpensOn) {
    throw new Error("The special-event booking close date cannot be before its opening date.");
  }
  return { name, eventStart: input.eventStart, eventEnd: input.eventEnd, minimumNights: input.minimumNights, bookingOpensOn, bookingClosesOn };
}

function validateEventRestrictionsForStay(
  restrictions: Array<typeof bookingEventRestrictions.$inferSelect>,
  checkIn: string,
  checkOut: string,
  now = new Date(),
) {
  const nights = getNights(checkIn, checkOut);
  const bookingDate = indianapolisDateKey(now);
  for (const restriction of restrictions) {
    if (!(restriction.eventStart < checkOut && restriction.eventEnd > checkIn)) continue;
    if (nights < restriction.minimumNights) {
      throw new Error(`${restriction.name} requires a minimum stay of ${restriction.minimumNights} night${restriction.minimumNights === 1 ? "" : "s"}.`);
    }
    if (restriction.bookingOpensOn && bookingDate < restriction.bookingOpensOn) {
      throw new Error(`${restriction.name} reservations open on ${restriction.bookingOpensOn}.`);
    }
    if (restriction.bookingClosesOn && bookingDate > restriction.bookingClosesOn) {
      throw new Error(`${restriction.name} reservations closed on ${restriction.bookingClosesOn}. Please call the inn for assistance.`);
    }
  }
}

async function assertEventRestrictions(checkIn: string, checkOut: string, now = new Date()) {
  const db = await getDb();
  if (!db) return;
  const restrictions = await db
    .select()
    .from(bookingEventRestrictions)
    .where(and(lt(bookingEventRestrictions.eventStart, checkOut), gt(bookingEventRestrictions.eventEnd, checkIn)));
  validateEventRestrictionsForStay(restrictions, checkIn, checkOut, now);
}

export async function listEventRestrictions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookingEventRestrictions).orderBy(asc(bookingEventRestrictions.eventStart), asc(bookingEventRestrictions.id));
}

export async function createEventRestriction(input: EventRestrictionInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const values = validateEventRestrictionInput(input);
  await db.insert(bookingEventRestrictions).values(values);
  const created = await db.select().from(bookingEventRestrictions)
    .where(and(eq(bookingEventRestrictions.name, values.name), eq(bookingEventRestrictions.eventStart, values.eventStart)))
    .orderBy(sql`${bookingEventRestrictions.id} desc`)
    .limit(1);
  return created[0];
}

export async function deleteEventRestriction(restrictionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const [result] = await db.delete(bookingEventRestrictions).where(eq(bookingEventRestrictions.id, restrictionId));
  if (result.affectedRows !== 1) throw new Error("That special-event restriction could not be found.");
  return { deleted: true } as const;
}

export async function getAvailableRooms(checkIn: string, checkOut: string) {
  getNights(checkIn, checkOut);
  assertBookingLeadTime(checkIn);
  assertBookingAdvanceWindow(checkIn);
  await assertEventRestrictions(checkIn, checkOut);
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

export function getValidatedPetDetails(input: BookingInput) {
  const hasPet = input.hasPet ?? false;
  if (!hasPet) {
    return { hasPet: 0, dogCount: 0, dogsUnder25Lbs: 0, petPolicyAcknowledged: 0 };
  }

  const dogCount = input.dogCount ?? 0;
  if (!Number.isInteger(dogCount) || dogCount < 1 || dogCount > 2) {
    throw new Error("A maximum of two dogs may stay with you.");
  }
  if (!input.dogsUnder25Lbs) {
    throw new Error("Each dog must weigh under 25 pounds to stay at the inn.");
  }
  if (!input.petPolicyAcknowledged) {
    throw new Error("Please review and acknowledge the Pet Policy before continuing.");
  }

  return { hasPet: 1, dogCount, dogsUnder25Lbs: 1, petPolicyAcknowledged: 1 };
}

function getValidatedAdultGuests(input: BookingInput) {
  if (!Number.isInteger(input.guestCount) || input.guestCount < 1 || input.guestCount > 2) {
    throw new Error("Select one or two adult guests.");
  }
  const childCount = input.childCount ?? 0;
  if (!Number.isInteger(childCount) || childCount < 0 || childCount > 2) {
    throw new Error("Select between zero and two children.");
  }
  if (input.adultGuests.length !== input.guestCount) {
    throw new Error("Provide the name and returning-guest answer for each adult guest.");
  }
  return {
    childCount,
    adultGuests: input.adultGuests.map(adult => {
      const name = adult.name.trim();
      if (name.length < 2 || name.length > 180) {
        throw new Error("Enter a full name for each adult guest.");
      }
      return { name, hasStayedBefore: Boolean(adult.hasStayedBefore) };
    }),
  };
}

export async function createReservationHold(
  input: BookingInput,
  options?: { source?: "direct" | "owner"; holdDurationMinutes?: number },
) {
  getNights(input.checkIn, input.checkOut);
  assertBookingLeadTime(input.checkIn);
  assertBookingAdvanceWindow(input.checkIn);
  await assertEventRestrictions(input.checkIn, input.checkOut);
  const { childCount, adultGuests } = getValidatedAdultGuests(input);
  const petDetails = getValidatedPetDetails(input);
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
    const quote = calculateQuote(room, input.checkIn, input.checkOut, {
      ...(settings ?? defaultSettings),
      ...(input.paymentSelection === "full_stay" ? { paymentCollectionMode: "full_stay" as const } : input.paymentSelection === "deposit" ? { paymentCollectionMode: "first_night_deposit" as const } : {}),
    });
    const holdDurationMinutes = options?.holdDurationMinutes ?? HOLD_DURATION_MINUTES;
    const holdExpiresAt = new Date(now.getTime() + holdDurationMinutes * 60_000);
    const bookingReference = generateBookingReference();

    await tx.insert(reservations).values({
      bookingReference,
      roomId: room.id,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      guestCount: input.guestCount,
      childCount,
      adultGuestDetailsJson: JSON.stringify(adultGuests),
      ...petDetails,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      status: "pending_deposit",
      source: options?.source ?? "direct",
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
  stripeCustomerId?: string | null;
  stripePaymentMethodId?: string | null;
  savePaymentMethodForBalance?: boolean;
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
        holdExpiresAt: null,
        stripeDepositPaymentIntentId: input.paymentIntentId ?? reservation.stripeDepositPaymentIntentId,
        stripeCustomerId: input.stripeCustomerId ?? reservation.stripeCustomerId,
        stripePaymentMethodId: input.stripePaymentMethodId ?? reservation.stripePaymentMethodId,
        paymentMethodConsentAt: input.savePaymentMethodForBalance ? now : reservation.paymentMethodConsentAt,
      })
      .where(eq(reservations.id, reservation.id));

    try {
      await queueOutboundAvailabilityUpdate({
        roomId: reservation.roomId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        reservationId: reservation.id,
        eventVersion: `direct-confirmation-${reservation.id}`,
      });
    } catch (error) {
      // Channel integration must never prevent a paid direct reservation from being confirmed.
      console.error("[Channel sync] Unable to queue direct booking inventory update:", error);
    }

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

export async function appendReservationAuditEvent(input: {
  action:
    | "reservation_cancelled"
    | "block_cancelled"
    | "payment_link_created"
    | "off_session_charge_attempted"
    | "off_session_charge_succeeded"
    | "off_session_charge_failed";
  actorUserId: number;
  reservationId?: number;
  reservationBlockId?: number;
  stripePaymentIntentId?: string | null;
  detail?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while recording the owner action.");
  await db.insert(reservationAuditEvents).values({
    action: input.action,
    actorUserId: input.actorUserId,
    reservationId: input.reservationId ?? null,
    reservationBlockId: input.reservationBlockId ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    detail: input.detail?.slice(0, 500) ?? null,
  });
}

export async function getOwnerReservationById(reservationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const result = await db
    .select({ reservation: reservations, room: rooms })
    .from(reservations)
    .innerJoin(rooms, eq(reservations.roomId, rooms.id))
    .where(eq(reservations.id, reservationId))
    .limit(1);
  return result[0];
}

export async function createOwnerReservation(input: BookingInput & { markDepositCollected: boolean }) {
  const created = await createReservationHold(input, { source: "owner", holdDurationMinutes: 48 * 60 });
  if (!input.markDepositCollected) return created;

  const confirmed = await recordStripePayment({ reservationId: created.reservation.id, paymentKind: "deposit" });
  return { ...created, reservation: confirmed };
}

export async function cancelReservationForOwner(input: { reservationId: number; actorUserId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const reservation = await getOwnerReservationById(input.reservationId);
  if (!reservation) throw new Error("Reservation not found.");
  if (reservation.reservation.status === "cancelled" || reservation.reservation.status === "expired") {
    throw new Error("This reservation is already inactive.");
  }

  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(reservations).set({
      status: "cancelled",
      cancelledAt: now,
      cancelledByUserId: input.actorUserId,
      cancellationReason: input.reason.trim(),
      holdExpiresAt: null,
    }).where(eq(reservations.id, input.reservationId));
    await tx.update(bookingEmailEvents).set({ status: "cancelled" }).where(
      and(
        eq(bookingEmailEvents.reservationId, input.reservationId),
        inArray(bookingEmailEvents.status, ["scheduled", "failed"]),
      ),
    );
    await tx.insert(reservationAuditEvents).values({
      reservationId: input.reservationId,
      action: "reservation_cancelled",
      actorUserId: input.actorUserId,
      detail: input.reason.trim().slice(0, 500),
    });
  });

  try {
    await queueOutboundAvailabilityUpdate({
      roomId: reservation.reservation.roomId,
      checkIn: reservation.reservation.checkIn,
      checkOut: reservation.reservation.checkOut,
      reservationId: reservation.reservation.id,
      eventVersion: `owner-cancellation-${reservation.reservation.id}-${now.getTime()}`,
    });
  } catch (error) {
    console.error("[Channel sync] Unable to queue owner reservation cancellation:", error);
  }
  return { ...reservation, reservation: { ...reservation.reservation, status: "cancelled" as const, cancelledAt: now, cancelledByUserId: input.actorUserId, cancellationReason: input.reason.trim() } };
}

export async function cancelOwnerBlock(input: { reservationBlockId: number; actorUserId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const existing = await db.select().from(reservationBlocks).where(eq(reservationBlocks.id, input.reservationBlockId)).limit(1);
  const block = existing[0];
  if (!block) throw new Error("Owner block not found.");
  if (block.status !== "active") throw new Error("This owner block is already inactive.");

  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(reservationBlocks).set({
      status: "cancelled",
      cancelledAt: now,
      cancelledByUserId: input.actorUserId,
      cancellationReason: input.reason.trim(),
    }).where(eq(reservationBlocks.id, block.id));
    await tx.insert(reservationAuditEvents).values({
      reservationBlockId: block.id,
      action: "block_cancelled",
      actorUserId: input.actorUserId,
      detail: input.reason.trim().slice(0, 500),
    });
  });

  try {
    await queueOutboundAvailabilityUpdate({
      roomId: block.roomId,
      checkIn: block.checkIn,
      checkOut: block.checkOut,
      eventVersion: `owner-block-cancellation-${block.id}-${now.getTime()}`,
    });
  } catch (error) {
    console.error("[Channel sync] Unable to queue owner block cancellation:", error);
  }
  return { ...block, status: "cancelled" as const, cancelledAt: now, cancelledByUserId: input.actorUserId, cancellationReason: input.reason.trim() };
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
  try {
    await queueOutboundAvailabilityUpdate({
      roomId: input.roomId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      eventVersion: `owner-block-${input.roomId}-${input.checkIn}-${input.checkOut}`,
    });
  } catch (error) {
    // An owner block remains valid locally even if a future connector cannot queue its update.
    console.error("[Channel sync] Unable to queue owner block inventory update:", error);
  }
}

export async function listOwnerBlocks(range?: { start?: string; end?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (range?.start) conditions.push(gt(reservationBlocks.checkOut, range.start));
  if (range?.end) conditions.push(lt(reservationBlocks.checkIn, range.end));
  conditions.push(eq(reservationBlocks.status, "active"));
  return db
    .select({ block: reservationBlocks, room: rooms })
    .from(reservationBlocks)
    .innerJoin(rooms, eq(reservationBlocks.roomId, rooms.id))
    .where(and(...conditions))
    .orderBy(asc(reservationBlocks.checkIn), asc(rooms.sortOrder));
}

export async function updateBookingSettings(input: Partial<PublicBookingSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const normalizedInput: Partial<PublicBookingSettings> = {
    ...input,
    ...(input.channelProvider !== undefined
      ? { channelProvider: input.channelProvider?.trim().toLowerCase() || null }
      : {}),
  };
  const current = await db.select().from(bookingSettings).limit(1);
  if (!current[0]) {
    await db.insert(bookingSettings).values({ ...defaultSettings, ...normalizedInput });
  } else {
    await db.update(bookingSettings).set(normalizedInput).where(eq(bookingSettings.id, current[0].id));
  }
  return getPublicSettings();
}
