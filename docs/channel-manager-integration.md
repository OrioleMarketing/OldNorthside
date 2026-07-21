# Authorized Channel-Manager Integration

The Old Northside booking application is prepared for a certified channel-management connection. It does **not** claim an active connection to Airbnb, Booking.com, Expedia Group, Hotels.com, or any other travel channel until an authorized provider is selected, property mappings are completed, and its credentials are configured.

## Integration Boundary

The booking system owns the direct-booking website, reservation calendar, taxes, payments, and local inventory. The future channel manager is responsible for translating each supported OTA’s proprietary API or webhook format into the canonical inventory event described below. This keeps the inn’s booking workflow independent of a particular vendor while avoiding direct, unsupported OTA connections.

| Responsibility | Booking application | Authorized channel manager |
| --- | --- | --- |
| Direct website bookings | Creates and confirms reservations | Receives outbound availability updates once an adapter is enabled |
| OTA bookings | Receives a minimal canonical availability event | Converts provider-specific reservation events into the canonical envelope |
| Inventory mapping | Stores room-to-external-room mappings | Supplies verified OTA property, room, and rate-plan IDs |
| Guest and card data | Does not accept it on this endpoint | Keeps provider-specific payload handling outside this application |
| Duplicate handling | Uses idempotency keys, atomic claims, and terminal audit states | Sends a stable unique event ID for every delivery |

## Inbound Endpoint

Once a provider is approved and configured, it sends canonical inventory events to:

```text
POST https://<production-domain>/api/channel-sync/inbound
Header: x-channel-sync-secret: <configured secret>
Content-Type: application/json
```

The endpoint remains disabled and returns `503` until `CHANNEL_SYNC_WEBHOOK_SECRET` is configured. Use a unique high-entropy secret and store it in the channel manager’s secure webhook configuration. The endpoint compares the secret in constant time and never records raw webhook bodies.

## Canonical Inventory Event

```json
{
  "provider": "authorized-channel-manager",
  "eventType": "reservation_created",
  "idempotencyKey": "stable-provider-event-id",
  "externalReservationId": "provider-reservation-id",
  "externalRoomId": "provider-room-id",
  "checkIn": "2026-10-01",
  "checkOut": "2026-10-04",
  "eventVersion": "provider-version-or-updated-at"
}
```

Supported `eventType` values are `reservation_created`, `reservation_modified`, and `reservation_cancelled`. Created and modified events require ISO `YYYY-MM-DD` arrival and departure dates. Cancellation events identify the existing external reservation and release its local inventory block.

The application stores only provider identifiers, room/date availability, event versions, and safe audit metadata. It does not store guest identity, card information, raw payloads, rate details, or other channel data that is unnecessary for protecting availability.

## Safe Processing Behavior

A unique idempotency key is persisted before processing. Only one worker can atomically claim an event. Repeat deliveries return an accepted duplicate response rather than creating another inventory block. A successful inbound event creates or updates a local channel-owned inventory block, while cancellation releases that block. The direct booking calendar treats active and conflict-state channel blocks as unavailable.

If an inbound OTA reservation overlaps a local confirmed reservation, owner block, or another channel reservation, the incoming block is retained with a `conflict` state. That prevents any additional direct reservation for those dates and creates an audit event for prompt owner review. The system does not silently cancel an existing booking.

Inbound changes are intentionally not re-emitted as outbound updates. Outbound availability events include origin and version metadata so a future adapter can suppress loops as well.

## Activation Checklist

1. Select an authorized channel-management provider that supports the inn’s target channels.
2. Complete account approval, property onboarding, and room/rate-plan mapping in the provider.
3. Configure the application’s channel provider and room mappings in the innkeeper settings.
4. Add `CHANNEL_SYNC_WEBHOOK_SECRET` securely to the application and the provider webhook configuration.
5. Replace the provider-neutral boundary with the provider’s verified webhook-signature validation if the provider supplies one.
6. Run non-production create, modify, cancellation, duplicate-delivery, and conflict scenarios before marking the connection as live.
7. Activate outbound delivery through the provider adapter only after inbound inventory tests are successful.

> The remaining operational work is provider-specific. Do not mark the connection as live or direct OTA traffic to this endpoint until the selected channel manager validates its mapping, authentication, and test events.
