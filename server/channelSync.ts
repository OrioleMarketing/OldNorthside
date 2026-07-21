import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  bookingSettings,
  channelInventoryBlocks,
  channelMappings,
  channelSyncEvents,
  reservationBlocks,
  reservations,
} from "../drizzle/schema";
import { getDb } from "./db";

export type ChannelSyncDirection = "inbound" | "outbound";
export type ChannelSyncStatus = "received" | "processing" | "processed" | "retrying" | "failed" | "ignored";
export type ChannelInventoryEventType = "reservation_created" | "reservation_modified" | "reservation_cancelled";

export type ChannelSyncEventInput = {
  provider: string;
  direction: ChannelSyncDirection;
  eventType: string;
  idempotencyKey: string;
  reservationId?: number | null;
  externalReservationId?: string | null;
  /** Safe operational metadata only; never place guest, card, or raw webhook data here. */
  detail?: Record<string, string | number | boolean | null | undefined>;
};

/**
 * Canonical, data-minimized envelope expected from a future authorized channel-manager adapter.
 * Guest identity, payment details, and raw provider payloads are intentionally excluded.
 */
export type InboundChannelInventoryEvent = {
  provider: string;
  eventType: ChannelInventoryEventType;
  idempotencyKey: string;
  externalReservationId: string;
  externalRoomId: string;
  checkIn?: string;
  checkOut?: string;
  eventVersion?: string;
};

export type InboundChannelInventoryResult = {
  accepted: boolean;
  duplicate: boolean;
  status: "processed" | "ignored";
  reason?: "channel_not_ready" | "room_mapping_missing" | "unknown_reservation" | "inventory_conflict";
};

function normalizeProvider(value: string) {
  return value.trim().toLowerCase();
}

function normalizeKey(value: string) {
  const key = value.trim();
  if (!key || key.length > 255) throw new Error("Channel event idempotency keys must be between 1 and 255 characters.");
  return key;
}

function scopedEventKey(provider: string, idempotencyKey: string) {
  const scoped = `${normalizeProvider(provider)}:${normalizeKey(idempotencyKey)}`;
  if (scoped.length > 255) throw new Error("Channel provider and idempotency key combination is too long.");
  return scoped;
}

function normalizeExternalIdentifier(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label} must be between 1 and ${maxLength} characters.`);
  }
  return normalized;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeInboundEvent(input: InboundChannelInventoryEvent) {
  const provider = normalizeProvider(input.provider);
  if (!provider || provider.length > 96) throw new Error("A valid channel provider is required.");

  const eventType = input.eventType.trim().toLowerCase() as ChannelInventoryEventType;
  if (!(["reservation_created", "reservation_modified", "reservation_cancelled"] as const).includes(eventType)) {
    throw new Error("Unsupported channel inventory event type.");
  }

  const normalized = {
    provider,
    eventType,
    idempotencyKey: normalizeKey(input.idempotencyKey),
    externalReservationId: normalizeExternalIdentifier(input.externalReservationId, "External reservation ID", 160),
    externalRoomId: normalizeExternalIdentifier(input.externalRoomId, "External room ID", 160),
    eventVersion: input.eventVersion ? normalizeExternalIdentifier(input.eventVersion, "Event version", 160) : null,
    checkIn: input.checkIn?.trim() ?? null,
    checkOut: input.checkOut?.trim() ?? null,
  };

  if (eventType !== "reservation_cancelled") {
    if (!normalized.checkIn || !normalized.checkOut || !isIsoDate(normalized.checkIn) || !isIsoDate(normalized.checkOut)) {
      throw new Error("Active channel inventory events require ISO check-in and check-out dates.");
    }
    if (normalized.checkOut <= normalized.checkIn) {
      throw new Error("Channel check-out must be after check-in.");
    }
  }

  return normalized;
}

function safeDetail(detail?: ChannelSyncEventInput["detail"]) {
  if (!detail) return null;
  const entries = Object.entries(detail)
    .filter(([, value]) => value !== undefined)
    .slice(0, 24)
    .map(([key, value]) => [key.slice(0, 80), value] as const);
  const value = JSON.stringify(Object.fromEntries(entries));
  return value.length > 2_000 ? value.slice(0, 2_000) : value;
}

/**
 * Adds a single audit event. The database unique key makes repeated provider deliveries idempotent.
 * It intentionally stores only identifiers and safe operational metadata.
 */
export async function recordChannelSyncEvent(input: ChannelSyncEventInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while recording channel activity.");

  const provider = normalizeProvider(input.provider);
  if (!provider) throw new Error("A channel provider is required.");
  const idempotencyKey = scopedEventKey(provider, input.idempotencyKey);

  await db
    .insert(channelSyncEvents)
    .values({
      provider,
      direction: input.direction,
      eventType: input.eventType.slice(0, 120),
      idempotencyKey,
      reservationId: input.reservationId ?? null,
      externalReservationId: input.externalReservationId ?? null,
      status: "received",
      detail: safeDetail(input.detail),
    })
    .onDuplicateKeyUpdate({ set: { idempotencyKey } });

  const existing = await db
    .select()
    .from(channelSyncEvents)
    .where(eq(channelSyncEvents.idempotencyKey, idempotencyKey))
    .limit(1);
  if (!existing[0]) throw new Error("Channel activity could not be recorded.");
  return existing[0];
}

/**
 * Atomically claims a received/retryable event. A connector must only process the event when it
 * receives a token; repeated callbacks or workers receive null instead of duplicating an update.
 */
export async function claimChannelSyncEvent(idempotencyKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while claiming channel activity.");

  const token = nanoid(24);
  await db
    .update(channelSyncEvents)
    .set({ status: "processing", processingToken: token })
    .where(
      and(
        eq(channelSyncEvents.idempotencyKey, normalizeKey(idempotencyKey)),
        inArray(channelSyncEvents.status, ["received", "retrying", "failed"]),
      ),
    );

  const claimed = await db
    .select()
    .from(channelSyncEvents)
    .where(and(eq(channelSyncEvents.idempotencyKey, normalizeKey(idempotencyKey)), eq(channelSyncEvents.processingToken, token)))
    .limit(1);
  return claimed[0] ? { event: claimed[0], token } : null;
}

/** Completes only the worker claim that owns the event, preserving an auditable terminal state. */
export async function finishChannelSyncEvent(input: {
  idempotencyKey: string;
  token: string;
  status: Exclude<ChannelSyncStatus, "received" | "processing">;
  detail?: ChannelSyncEventInput["detail"];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while finalizing channel activity.");
  const terminal = input.status === "processed" || input.status === "ignored";
  await db
    .update(channelSyncEvents)
    .set({
      status: input.status,
      processingToken: null,
      detail: safeDetail(input.detail),
      processedAt: terminal ? new Date() : null,
    })
    .where(
      and(
        eq(channelSyncEvents.idempotencyKey, normalizeKey(input.idempotencyKey)),
        eq(channelSyncEvents.processingToken, input.token),
        eq(channelSyncEvents.status, "processing"),
      ),
    );
}

/**
 * Claims and applies a canonical inbound inventory event. The adapter is deliberately provider-neutral;
 * it only accepts an already-normalized inventory envelope from a configured, authorized connector.
 */
export async function applyInboundChannelInventoryEvent(input: InboundChannelInventoryEvent): Promise<InboundChannelInventoryResult> {
  const event = normalizeInboundEvent(input);
  const recorded = await recordChannelSyncEvent({
    provider: event.provider,
    direction: "inbound",
    eventType: event.eventType,
    idempotencyKey: event.idempotencyKey,
    externalReservationId: event.externalReservationId,
    detail: {
      externalRoomId: event.externalRoomId,
      eventVersion: event.eventVersion,
    },
  });
  const scopedIdempotencyKey = recorded.idempotencyKey;

  const claim = await claimChannelSyncEvent(scopedIdempotencyKey);
  if (!claim) {
    return { accepted: true, duplicate: true, status: "processed" };
  }

  try {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable while processing channel inventory.");

    const settings = await db.select().from(bookingSettings).limit(1);
    const configured = settings[0];
    const configuredProvider = configured?.channelProvider ? normalizeProvider(configured.channelProvider) : null;
    if (configuredProvider !== event.provider || configured?.channelConnectionStatus !== "connected") {
      await finishChannelSyncEvent({
        idempotencyKey: scopedIdempotencyKey,
        token: claim.token,
        status: "ignored",
        detail: { reason: "channel_not_ready" },
      });
      return { accepted: false, duplicate: false, status: "ignored", reason: "channel_not_ready" };
    }

    const mapping = await db
      .select()
      .from(channelMappings)
      .where(
        and(
          eq(channelMappings.provider, event.provider),
          eq(channelMappings.externalRoomId, event.externalRoomId),
          eq(channelMappings.isEnabled, 1),
        ),
      )
      .limit(1);
    const roomMapping = mapping[0];
    if (!roomMapping) {
      await finishChannelSyncEvent({
        idempotencyKey: scopedIdempotencyKey,
        token: claim.token,
        status: "ignored",
        detail: { reason: "room_mapping_missing" },
      });
      return { accepted: false, duplicate: false, status: "ignored", reason: "room_mapping_missing" };
    }

    if (event.eventType === "reservation_cancelled") {
      const current = await db
        .select()
        .from(channelInventoryBlocks)
        .where(
          and(
            eq(channelInventoryBlocks.provider, event.provider),
            eq(channelInventoryBlocks.externalReservationId, event.externalReservationId),
          ),
        )
        .limit(1);
      if (!current[0]) {
        await finishChannelSyncEvent({
          idempotencyKey: event.idempotencyKey,
          token: claim.token,
          status: "ignored",
          detail: { reason: "unknown_reservation" },
        });
        return { accepted: false, duplicate: false, status: "ignored", reason: "unknown_reservation" };
      }

      await db
        .update(channelInventoryBlocks)
        .set({
          status: "cancelled",
          originEventKey: scopedIdempotencyKey,
          lastEventVersion: event.eventVersion,
        })
        .where(eq(channelInventoryBlocks.id, current[0].id));
      await db.update(channelMappings).set({ lastSyncedAt: new Date() }).where(eq(channelMappings.id, roomMapping.id));
      await finishChannelSyncEvent({
        idempotencyKey: scopedIdempotencyKey,
        token: claim.token,
        status: "processed",
        detail: { outcome: "inventory_released", roomId: roomMapping.roomId },
      });
      return { accepted: true, duplicate: false, status: "processed" };
    }

    const outcome = await db.transaction(async tx => {
      // Uses the same row lock as direct booking creation so an inbound event cannot race a guest checkout.
      await tx.execute(sql`SELECT id FROM rooms WHERE id = ${roomMapping.roomId} FOR UPDATE`);
      const existing = await tx
        .select()
        .from(channelInventoryBlocks)
        .where(
          and(
            eq(channelInventoryBlocks.provider, event.provider),
            eq(channelInventoryBlocks.externalReservationId, event.externalReservationId),
          ),
        )
        .limit(1);

      const now = new Date();
      const [reservationOverlap, ownerBlockOverlap, channelBlockOverlap] = await Promise.all([
        tx
          .select({ id: reservations.id })
          .from(reservations)
          .where(
            and(
              eq(reservations.roomId, roomMapping.roomId),
              lt(reservations.checkIn, event.checkOut!),
              gt(reservations.checkOut, event.checkIn!),
              or(
                eq(reservations.status, "confirmed"),
                and(inArray(reservations.status, ["hold", "pending_deposit"]), gt(reservations.holdExpiresAt, now)),
              ),
            ),
          )
          .limit(1),
        tx
          .select({ id: reservationBlocks.id })
          .from(reservationBlocks)
          .where(
            and(
              eq(reservationBlocks.roomId, roomMapping.roomId),
              lt(reservationBlocks.checkIn, event.checkOut!),
              gt(reservationBlocks.checkOut, event.checkIn!),
            ),
          )
          .limit(1),
        tx
          .select({ id: channelInventoryBlocks.id })
          .from(channelInventoryBlocks)
          .where(
            and(
              eq(channelInventoryBlocks.roomId, roomMapping.roomId),
              lt(channelInventoryBlocks.checkIn, event.checkOut!),
              gt(channelInventoryBlocks.checkOut, event.checkIn!),
              inArray(channelInventoryBlocks.status, ["active", "conflict"]),
            ),
          ),
      ]);

      const conflictingChannelBlock = channelBlockOverlap.some(block => block.id !== existing[0]?.id);
      const conflict = Boolean(reservationOverlap[0] || ownerBlockOverlap[0] || conflictingChannelBlock);
      const values = {
        roomId: roomMapping.roomId,
        checkIn: event.checkIn!,
        checkOut: event.checkOut!,
        status: conflict ? ("conflict" as const) : ("active" as const),
        originEventKey: scopedIdempotencyKey,
        lastEventVersion: event.eventVersion,
      };

      if (existing[0]) {
        await tx.update(channelInventoryBlocks).set(values).where(eq(channelInventoryBlocks.id, existing[0].id));
      } else {
        await tx.insert(channelInventoryBlocks).values({
          provider: event.provider,
          externalReservationId: event.externalReservationId,
          ...values,
        });
      }
      await tx.update(channelMappings).set({ lastSyncedAt: new Date() }).where(eq(channelMappings.id, roomMapping.id));
      return { conflict };
    });

    await finishChannelSyncEvent({
      idempotencyKey: scopedIdempotencyKey,
      token: claim.token,
      status: "processed",
      detail: {
        outcome: outcome.conflict ? "inventory_conflict" : "inventory_blocked",
        roomId: roomMapping.roomId,
      },
    });
    return outcome.conflict
      ? { accepted: true, duplicate: false, status: "processed", reason: "inventory_conflict" }
      : { accepted: true, duplicate: false, status: "processed" };
  } catch (error) {
    await finishChannelSyncEvent({
      idempotencyKey: scopedIdempotencyKey,
      token: claim.token,
      status: "failed",
      detail: { reason: "inbound_processing_failed" },
    });
    throw error;
  }
}

/**
 * Queues a direct-booking inventory change only after a named provider is marked connected and
 * the room has an enabled external mapping. No network request is made until an authorized adapter
 * is configured, so this cannot accidentally publish inventory to an unapproved channel.
 */
export async function queueOutboundAvailabilityUpdate(input: {
  roomId: number;
  checkIn: string;
  checkOut: string;
  reservationId?: number | null;
  eventVersion: string;
  origin?: "direct" | "owner" | "channel";
  originEventKey?: string | null;
}) {
  if (input.origin === "channel") {
    return { queued: false as const, reason: "inbound_origin" as const };
  }

  const db = await getDb();
  if (!db) throw new Error("Database unavailable while queuing channel activity.");

  const settings = await db.select().from(bookingSettings).limit(1);
  const configured = settings[0];
  const provider = configured?.channelProvider ? normalizeProvider(configured.channelProvider) : "";
  if (!provider || configured?.channelConnectionStatus !== "connected") {
    return { queued: false as const, reason: "channel_not_connected" as const };
  }

  const mappings = await db
    .select({ externalRoomId: channelMappings.externalRoomId })
    .from(channelMappings)
    .where(and(eq(channelMappings.provider, provider), eq(channelMappings.roomId, input.roomId), eq(channelMappings.isEnabled, 1)))
    .orderBy(asc(channelMappings.externalRoomId));
  if (!mappings.length) return { queued: false as const, reason: "room_not_mapped" as const };

  const event = await recordChannelSyncEvent({
    provider,
    direction: "outbound",
    eventType: "availability_changed",
    idempotencyKey: `availability:${provider}:${input.roomId}:${input.checkIn}:${input.checkOut}:${input.eventVersion}`,
    reservationId: input.reservationId ?? null,
    detail: {
      roomId: input.roomId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      eventVersion: input.eventVersion,
      origin: input.origin ?? "direct",
      originEventKey: input.originEventKey ?? null,
      externalRoomCount: mappings.length,
    },
  });
  return { queued: true as const, event };
}

export async function getChannelSyncReadiness() {
  const db = await getDb();
  if (!db) return { provider: null, status: "not_connected" as const, ready: false, mappedRooms: 0 };
  const settings = await db.select().from(bookingSettings).limit(1);
  const configured = settings[0];
  const provider = configured?.channelProvider ? normalizeProvider(configured.channelProvider) : null;
  if (!provider) return { provider: null, status: configured?.channelConnectionStatus ?? "not_connected", ready: false, mappedRooms: 0 };
  const mappings = await db
    .select({ id: channelMappings.id })
    .from(channelMappings)
    .where(and(eq(channelMappings.provider, provider), eq(channelMappings.isEnabled, 1)));
  const status = configured?.channelConnectionStatus ?? "not_connected";
  return { provider, status, ready: status === "connected" && mappings.length > 0, mappedRooms: mappings.length };
}

export async function listChannelSyncEvents(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: channelSyncEvents.id,
      provider: channelSyncEvents.provider,
      direction: channelSyncEvents.direction,
      eventType: channelSyncEvents.eventType,
      reservationId: channelSyncEvents.reservationId,
      externalReservationId: channelSyncEvents.externalReservationId,
      status: channelSyncEvents.status,
      createdAt: channelSyncEvents.createdAt,
      processedAt: channelSyncEvents.processedAt,
    })
    .from(channelSyncEvents)
    .orderBy(desc(channelSyncEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export const channelSyncInternals = {
  normalizeProvider,
  normalizeKey,
  scopedEventKey,
  normalizeInboundEvent,
  safeDetail,
};
