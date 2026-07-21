import { describe, expect, it } from "vitest";
import { channelSyncInternals, queueOutboundAvailabilityUpdate } from "./channelSync";

describe("channel sync guards", () => {
  it("normalizes provider names before mapping or queueing inventory updates", () => {
    expect(channelSyncInternals.normalizeProvider("  Lodgify  ")).toBe("lodgify");
    expect(channelSyncInternals.normalizeProvider("Booking.COM")).toBe("booking.com");
  });

  it("rejects blank and oversized idempotency keys", () => {
    expect(() => channelSyncInternals.normalizeKey("   ")).toThrow("idempotency");
    expect(() => channelSyncInternals.normalizeKey("a".repeat(256))).toThrow("idempotency");
  });

  it("scopes provider event IDs so separate channel systems cannot collide", () => {
    expect(channelSyncInternals.scopedEventKey("Manager A", "evt-1")).toBe("manager a:evt-1");
    expect(channelSyncInternals.scopedEventKey("Manager B", "evt-1")).toBe("manager b:evt-1");
  });

  it("keeps sync-event metadata bounded and free of undefined values", () => {
    const serialized = channelSyncInternals.safeDetail({ roomId: 3, available: false, omitted: undefined });
    expect(serialized).toBe('{"roomId":3,"available":false}');
  });

  it("normalizes an inbound inventory event without accepting guest or payment details", () => {
    expect(
      channelSyncInternals.normalizeInboundEvent({
        provider: "  Authorized Manager ",
        eventType: "reservation_created",
        idempotencyKey: "event-100",
        externalReservationId: "res-455",
        externalRoomId: "room-a",
        checkIn: "2026-10-01",
        checkOut: "2026-10-04",
        eventVersion: "v2",
      }),
    ).toEqual({
      provider: "authorized manager",
      eventType: "reservation_created",
      idempotencyKey: "event-100",
      externalReservationId: "res-455",
      externalRoomId: "room-a",
      checkIn: "2026-10-01",
      checkOut: "2026-10-04",
      eventVersion: "v2",
    });
  });

  it("requires valid dates for created or modified inventory events", () => {
    expect(() =>
      channelSyncInternals.normalizeInboundEvent({
        provider: "manager",
        eventType: "reservation_modified",
        idempotencyKey: "event-101",
        externalReservationId: "res-456",
        externalRoomId: "room-b",
        checkIn: "2026-02-30",
        checkOut: "2026-03-01",
      }),
    ).toThrow("ISO check-in");
  });

  it("allows cancellation events to release a known external reservation without dates", () => {
    expect(
      channelSyncInternals.normalizeInboundEvent({
        provider: "manager",
        eventType: "reservation_cancelled",
        idempotencyKey: "event-102",
        externalReservationId: "res-457",
        externalRoomId: "room-c",
      }),
    ).toMatchObject({
      eventType: "reservation_cancelled",
      checkIn: null,
      checkOut: null,
    });
  });

  it("does not re-emit inbound channel inventory as an outbound availability event", async () => {
    await expect(
      queueOutboundAvailabilityUpdate({
        roomId: 1,
        checkIn: "2026-10-01",
        checkOut: "2026-10-04",
        eventVersion: "provider-v1",
        origin: "channel",
        originEventKey: "event-100",
      }),
    ).resolves.toEqual({ queued: false, reason: "inbound_origin" });
  });
});
