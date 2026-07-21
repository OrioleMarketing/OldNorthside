# Transactional Email Operations

## Current Booking Email Delivery

The application sends reservation confirmations and pre-arrival balance-payment reminders through **Resend**. The configured sender is `reservations@oldnorthsidebedandbreakfast.com`. The server uses the `RESEND_API_KEY` and `RESEND_FROM_EMAIL` project secrets only; neither value is exposed to website visitors or stored in source control.

A successful deposit payment triggers a reservation confirmation. For reservations with an unpaid balance, the system schedules a reminder for the configured number of days before check-in, currently **seven days**. Delivery records are claimed atomically before sending so concurrent schedule runs do not send duplicate messages. Failed events are eligible for a controlled retry.

## Production Sender Checklist

Before accepting live reservations, verify the following in Resend:

- Confirm that `oldnorthsidebedandbreakfast.com` or the verified `reservations@oldnorthsidebedandbreakfast.com` sender remains active.
- Publish and validate the DNS records required by the email provider, including SPF and DKIM records.
- Set a DMARC policy appropriate to the inn’s domain-management policy.
- Send a test reservation confirmation and a balance-payment reminder to a monitored inbox, then confirm that the balance-payment link points to the published site.
- Monitor delivery status and failures in the Resend dashboard after launch.

## Future GoHighLevel Migration

The booking system keeps reminder eligibility, booking data, and delivery records in its own database. This permits a later delivery-provider change without changing reservation, payment, availability, or tax logic.

When the inn is ready to use GoHighLevel, use an authenticated sending subdomain such as `reservations.oldnorthsidebedandbreakfast.com` or `mail.oldnorthsidebedandbreakfast.com`. Connect GoHighLevel’s API or workflow trigger only from server-side code, replace the Resend dispatch adapter, and retain the existing idempotency rules so a guest does not receive duplicate confirmation or balance-reminder emails.

## Secrets

Do not paste API keys into application files, browser code, email templates, or public project documentation. Update provider credentials only through the project’s protected secrets configuration.

## Sandbox Test Sender Procedure

Use Resend’s sandbox sender only for controlled pre-launch testing. Temporarily set the protected `RESEND_FROM_EMAIL` value to the Resend sandbox sender approved for the account (for example, `onboarding@resend.dev` where supported), send a test confirmation and balance-reminder email to a monitored test inbox, and then restore `reservations@oldnorthsidebedandbreakfast.com` before accepting guest reservations. Do not use the sandbox sender for guest-facing production messages. Keep the test recipient and test booking separate from real guest data, and verify that the payment link resolves to the correct published domain.
