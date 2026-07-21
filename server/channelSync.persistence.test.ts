import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { channelSyncEvents } from "../drizzle/schema";
import {
  applyInboundChannelInventoryEvent,
  claimChannelSyncEvent,
  finishChannelSyncEvent,
  recordChannelSyncEvent,
} from "./channelSync";
import { getDb } from "./db";

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for channel-sync persistence coverage.");
  return db;
}

async function removeEvent(idempotencyKey: string) {
  const db = await databaseOrThrow();
  await db.delete(channelSyncEvents).where(eq(channelSyncEvents.idempotencyKey, idempotencyKey));
}

function uniqueEventKey(label: string) {
  return `${label}-${nanoid(14)}`;
}

describe.sequential("channel-sync event persistence", () => {
  it("records a duplicate provider delivery as one durable audit event", async () => {
    const key = uniqueEventKey("duplicate");
    const first = await recordChannelSyncEvent({
      provider: "channel-persistence-test",
      direction: "inbound",
      eventType: "reservation_created",
      idempotencyKey: key,
      externalReservationId: "external-duplicate",
    });

    try {
      const second = await recordChannelSyncEvent({
        provider: "channel-persistence-test",
        direction: "inbound",
        eventType: "reservation_created",
        idempotencyKey: key,
        externalReservationId: "external-duplicate",
      });
      const db = await databaseOrThrow();
      const stored = await db.select().from(channelSyncEvents).where(eq(channelSyncEvents.idempotencyKey, first.idempotencyKey));

      expect(second.id).toBe(first.id);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ direction: "inbound", status: "received" });
    } finally {
      await removeEvent(first.idempotencyKey);
    }
  });

  it("allows exactly one concurrent worker to claim a received event", async () => {
    const key = uniqueEventKey("atomic-claim");
    const event = await recordChannelSyncEvent({
      provider: "channel-persistence-test",
      direction: "inbound",
      eventType: "reservation_modified",
      idempotencyKey: key,
    });

    try {
      const claims = await Promise.all([claimChannelSyncEvent(event.idempotencyKey), claimChannelSyncEvent(event.idempotencyKey)]);
      const winners = claims.filter((claim): claim is NonNullable<typeof claim> => claim !== null);

      expect(winners).toHaveLength(1);
      expect(winners[0].event.status).toBe("processing");

      const db = await databaseOrThrow();
      const stored = await db.select().from(channelSyncEvents).where(eq(channelSyncEvents.idempotencyKey, event.idempotencyKey)).limit(1);
      expect(stored[0]).toMatchObject({ status: "processing", processingToken: winners[0].token });
    } finally {
      await removeEvent(event.idempotencyKey);
    }
  });

  it("requires the owning claim token for terminal state transitions", async () => {
    const key = uniqueEventKey("terminal");
    const event = await recordChannelSyncEvent({
      provider: "channel-persistence-test",
      direction: "outbound",
      eventType: "availability_changed",
      idempotencyKey: key,
    });

    try {
      const claim = await claimChannelSyncEvent(event.idempotencyKey);
      expect(claim).not.toBeNull();
      if (!claim) throw new Error("Expected a newly received channel event to be claimable.");

      await finishChannelSyncEvent({ idempotencyKey: event.idempotencyKey, token: "wrong-token", status: "failed" });
      const db = await databaseOrThrow();
      let stored = await db.select().from(channelSyncEvents).where(eq(channelSyncEvents.idempotencyKey, event.idempotencyKey)).limit(1);
      expect(stored[0]).toMatchObject({ status: "processing", processingToken: claim.token });

      await finishChannelSyncEvent({ idempotencyKey: event.idempotencyKey, token: claim.token, status: "processed" });
      stored = await db.select().from(channelSyncEvents).where(eq(channelSyncEvents.idempotencyKey, event.idempotencyKey)).limit(1);
      expect(stored[0].status).toBe("processed");
      expect(stored[0].processingToken).toBeNull();
      expect(stored[0].processedAt).toBeInstanceOf(Date);
      await expect(claimChannelSyncEvent(event.idempotencyKey)).resolves.toBeNull();
    } finally {
      await removeEvent(event.idempotencyKey);
    }
  });

  it("treats a replayed inbound inventory delivery as a duplicate without creating another event", async () => {
    const key = uniqueEventKey("inbound-replay");
    const input = {
      provider: "channel-persistence-test",
      eventType: "reservation_created" as const,
      idempotencyKey: key,
      externalReservationId: `external-${key}`,
      externalRoomId: `room-${key}`,
      checkIn: "2027-02-10",
      checkOut: "2027-02-12",
      eventVersion: "v1",
    };
    const scopedKey = `channel-persistence-test:${key}`;

    try {
      const first = await applyInboundChannelInventoryEvent(input);
      const replay = await applyInboundChannelInventoryEvent(input);
      const db = await databaseOrThrow();
      const stored = await db.select().from(channelSyncEvents).where(eq(channelSyncEvents.idempotencyKey, scopedKey));

      expect(first.status).toBe("ignored");
      expect(replay).toEqual({ accepted: true, duplicate: true, status: "processed" });
      expect(stored).toHaveLength(1);
    } finally {
      await removeEvent(scopedKey);
    }
  });

  it("keeps repeated equivalent outbound availability events to a single auditable record", async () => {
    const key = uniqueEventKey("outbound-replay");
    const input = {
      provider: "channel-persistence-test",
      direction: "outbound" as const,
      eventType: "availability_changed",
      idempotencyKey: `availability:room-77:2027-03-04:2027-03-06:${key}`,
      detail: { roomId: 77, checkIn: "2027-03-04", checkOut: "2027-03-06", eventVersion: key },
    };
    const first = await recordChannelSyncEvent(input);

    try {
      const replay = await recordChannelSyncEvent(input);
      const db = await databaseOrThrow();
      const stored = await db.select().from(channelSyncEvents).where(eq(channelSyncEvents.idempotencyKey, first.idempotencyKey));

      expect(replay.id).toBe(first.id);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ direction: "outbound", eventType: "availability_changed", status: "received" });
    } finally {
      await removeEvent(first.idempotencyKey);
    }
  });
});
