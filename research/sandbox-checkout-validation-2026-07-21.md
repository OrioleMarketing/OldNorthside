# Sandbox Checkout Validation — 2026-07-21

## Scope

A clearly labeled, owner-authorized sandbox reservation was created for a two-night future stay, submitted through Stripe Checkout using Stripe's standard test card, and then cleaned up.

## Verified outcomes

| Check | Result |
|---|---|
| Direct booking availability and room selection | Passed |
| Stripe Checkout session creation | Passed |
| Sandbox deposit payment | Passed; no real charge was created |
| Stripe webhook processing | Passed; the reservation moved to `confirmed` and retained the required Stripe deposit checkout-session and payment-intent identifiers |
| Balance reminder scheduling | Passed; a balance reminder was scheduled after deposit confirmation |
| Test cleanup | Passed; the reservation was changed to `cancelled`, its scheduled balance reminder was cancelled, and the payment audit identifier was retained |
| Confirmation email delivery | Blocked externally; the booking-confirmation event failed with no provider message identifier because the configured Resend account has not verified `oldnorthsidebedandbreakfast.com` |

## Remaining dependencies

1. Verify `oldnorthsidebedandbreakfast.com` in the configured Resend account before using `reservations@oldnorthsidebedandbreakfast.com` for guest communications.
2. Provide the final downloadable Visitor Guide URL or file to replace the current guide-request action.
3. Select and authorize a channel-management provider before enabling Airbnb, Booking.com, or Expedia synchronization.

