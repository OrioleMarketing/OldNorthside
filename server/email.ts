import { and, eq, lte, or, sql } from "drizzle-orm";
import { Resend } from "resend";
import { bookingEmailEvents, reservations, rooms } from "../drizzle/schema";
import { getDb } from "./db";

type EmailKind = "booking_confirmation" | "balance_reminder";
export type DeliveryResult = "sent" | "skipped";

type ReservationEmailContext = {
  reservation: typeof reservations.$inferSelect;
  room: typeof rooms.$inferSelect;
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Transactional email is not configured.");
  return new Resend(apiKey);
}

function getFromAddress() {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("A verified transactional sender address is required.");
  return from;
}

export function formatLocalDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00Z`));
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function renderEmailLayout(input: { preheader: string; title: string; body: string }) {
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#f3ecdf;color:#2a211b;font-family:Arial,sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${input.preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3ecdf;padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffaf0;border:1px solid #decba5;">
      <tr><td style="padding:25px 32px 20px;background:#251d18;color:#fff5e5;">
        <div style="font-family:Georgia,serif;font-size:25px;line-height:1.05;font-weight:bold;letter-spacing:-.4px;">Old Northside</div>
        <div style="margin-top:5px;color:#d5b273;font-size:10px;font-weight:bold;letter-spacing:1.7px;text-transform:uppercase;">Bed and Breakfast · Indianapolis</div>
      </td></tr>
      <tr><td style="padding:34px 32px 26px;">
        <h1 style="margin:0 0 15px;color:#28201a;font-family:Georgia,serif;font-size:30px;line-height:1.16;font-weight:normal;">${input.title}</h1>
        <div style="color:#584a40;font-size:15px;line-height:1.7;">${input.body}</div>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#eee0c6;border-top:1px solid #decba5;color:#5e4d3e;font-size:12px;line-height:1.55;">
        Old Northside Bed and Breakfast · 1340 North Alabama Street · Indianapolis, IN 46202<br/>Questions? Call (317) 635-9123.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function bookingCharges(context: ReservationEmailContext) {
  const { reservation } = context;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 8px;border:1px solid #e1d2ba;border-collapse:collapse;">
    <tr><td colspan="2" style="padding:12px 14px;background:#f5ecdc;color:#372b22;font-weight:bold;">Stay charges</td></tr>
    <tr><td style="padding:9px 14px;border-top:1px solid #e1d2ba;">Room subtotal</td><td align="right" style="padding:9px 14px;border-top:1px solid #e1d2ba;">${formatCurrency(reservation.subtotalCents)}</td></tr>
    <tr><td style="padding:9px 14px;">Indiana state tax</td><td align="right" style="padding:9px 14px;">${formatCurrency(reservation.stateTaxCents)}</td></tr>
    <tr><td style="padding:9px 14px;">Marion County Innkeeper’s Tax</td><td align="right" style="padding:9px 14px;">${formatCurrency(reservation.countyTaxCents)}</td></tr>
    <tr><td style="padding:11px 14px;border-top:1px solid #cdb58d;font-weight:bold;">Stay total</td><td align="right" style="padding:11px 14px;border-top:1px solid #cdb58d;font-weight:bold;">${formatCurrency(reservation.totalCents)}</td></tr>
  </table>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

async function loadReservationEmailContext(reservationId: number): Promise<ReservationEmailContext | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while preparing transactional email.");
  const result = await db
    .select({ reservation: reservations, room: rooms })
    .from(reservations)
    .innerJoin(rooms, eq(reservations.roomId, rooms.id))
    .where(eq(reservations.id, reservationId))
    .limit(1);
  return result[0];
}

async function getOrCreateEmailEvent(reservationId: number, kind: EmailKind) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while preparing transactional email.");
  const existing = await db
    .select()
    .from(bookingEmailEvents)
    .where(and(eq(bookingEmailEvents.reservationId, reservationId), eq(bookingEmailEvents.kind, kind)))
    .limit(1);
  if (existing[0]) return existing[0];

  await db.insert(bookingEmailEvents).values({ reservationId, kind, status: "scheduled", scheduledFor: new Date() });
  const created = await db
    .select()
    .from(bookingEmailEvents)
    .where(and(eq(bookingEmailEvents.reservationId, reservationId), eq(bookingEmailEvents.kind, kind)))
    .limit(1);
  if (!created[0]) throw new Error("Could not create the transactional email delivery record.");
  return created[0];
}

async function recordDelivery(eventId: number, reservationId: number, kind: EmailKind, providerMessageId: string | null | undefined) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while recording email delivery.");
  const now = new Date();
  await db.update(bookingEmailEvents).set({ status: "sent", sentAt: now, failedAt: null, providerMessageId: providerMessageId ?? null }).where(eq(bookingEmailEvents.id, eventId));
  if (kind === "balance_reminder") {
    await db.update(reservations).set({ balanceReminderSentAt: now }).where(eq(reservations.id, reservationId));
  }
}

async function recordDeliveryFailure(eventId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookingEmailEvents).set({ status: "failed", failedAt: new Date() }).where(eq(bookingEmailEvents.id, eventId));
}

async function claimEmailEvent(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while claiming transactional email delivery.");
  const [result] = await db
    .update(bookingEmailEvents)
    .set({ status: "sending", failedAt: null })
    .where(
      and(
        eq(bookingEmailEvents.id, eventId),
        or(eq(bookingEmailEvents.status, "scheduled"), eq(bookingEmailEvents.status, "failed")),
      ),
    );
  return result.affectedRows === 1;
}

async function sendEmail(input: { eventId: number; reservationId: number; kind: EmailKind; to: string; subject: string; html: string }): Promise<DeliveryResult> {
  const claimed = await claimEmailEvent(input.eventId);
  if (!claimed) return "skipped";
  try {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: getFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      headers: { "Idempotency-Key": `old-northside-email-${input.eventId}` },
    });
    if (result.error) {
      const reason = [result.error.name, result.error.message].filter(Boolean).join(": ");
      throw new Error(`The transactional email provider rejected the message${reason ? ` (${reason})` : ""}.`);
    }
    await recordDelivery(input.eventId, input.reservationId, input.kind, result.data?.id);
    return "sent";
  } catch (error) {
    await recordDeliveryFailure(input.eventId);
    throw error;
  }
}

export async function sendBookingConfirmation(reservationId: number): Promise<DeliveryResult> {
  const context = await loadReservationEmailContext(reservationId);
  if (!context || context.reservation.status !== "confirmed") return "skipped";
  const event = await getOrCreateEmailEvent(reservationId, "booking_confirmation");
  if (event.status === "sent" || event.status === "sending") return "skipped";

  const reservation = context.reservation;
  const paymentMessage = reservation.balanceDueCents > 0
    ? `We received your first-night deposit of <strong>${formatCurrency(reservation.depositDueCents)}</strong>. The remaining balance is <strong>${formatCurrency(reservation.balanceDueCents)}</strong>. If a balance remains, we will send a secure payment reminder before arrival.`
    : `We received your full stay payment of <strong>${formatCurrency(reservation.depositDueCents)}</strong>, including all applicable taxes. There is no remaining balance.`;
  const body = `<p>Dear ${escapeHtml(reservation.guestName)},</p>
    <p>Your reservation at Old Northside Bed and Breakfast is confirmed. We look forward to welcoming you.</p>
    <div style="padding:14px 16px;background:#f4ead8;border-left:3px solid #a7782a;"><strong>Booking reference:</strong> ${escapeHtml(reservation.bookingReference)}<br/><strong>${escapeHtml(context.room.name)}</strong><br/>${formatLocalDate(reservation.checkIn)} to ${formatLocalDate(reservation.checkOut)}</div>
    ${bookingCharges(context)}
    <p style="margin-top:18px;">${paymentMessage}</p>`;
  return sendEmail({
    eventId: event.id,
    reservationId,
    kind: "booking_confirmation",
    to: reservation.guestEmail,
    subject: `Your Old Northside Bed and Breakfast reservation is confirmed — ${reservation.bookingReference}`,
    html: renderEmailLayout({ preheader: `Reservation confirmed — ${reservation.bookingReference}`, title: "Your stay is confirmed.", body }),
  });
}

function balancePaymentUrl(reference: string) {
  const origin = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "");
  return origin ? `${origin}/booking/balance?reference=${encodeURIComponent(reference)}` : undefined;
}

export async function sendBalanceReminder(reservationId: number): Promise<DeliveryResult> {
  const context = await loadReservationEmailContext(reservationId);
  if (!context || context.reservation.status !== "confirmed" || context.reservation.balancePaidAt || context.reservation.balanceDueCents <= 0) return "skipped";
  const event = await getOrCreateEmailEvent(reservationId, "balance_reminder");
  if (event.status === "sent" || event.status === "sending") return "skipped";

  const reservation = context.reservation;
  const paymentUrl = balancePaymentUrl(reservation.bookingReference);
  const payAction = paymentUrl
    ? `<p style="margin:24px 0 0;"><a href="${paymentUrl}" style="display:inline-block;padding:12px 17px;background:#2f493f;color:#fff9ed;text-decoration:none;font-weight:bold;">Review and pay your balance</a></p>`
    : `<p>Please contact the inn at (317) 635-9123 to arrange your remaining balance payment.</p>`;
  const body = `<p>Dear ${escapeHtml(reservation.guestName)},</p>
    <p>Your stay in the ${escapeHtml(context.room.name)} begins on ${formatLocalDate(reservation.checkIn)}. Your remaining balance is ready for payment.</p>
    <div style="padding:14px 16px;background:#f4ead8;border-left:3px solid #a7782a;"><strong>Booking reference:</strong> ${escapeHtml(reservation.bookingReference)}<br/><strong>Balance due:</strong> ${formatCurrency(reservation.balanceDueCents)}</div>
    ${bookingCharges(context)}
    ${payAction}`;
  return sendEmail({
    eventId: event.id,
    reservationId,
    kind: "balance_reminder",
    to: reservation.guestEmail,
    subject: `Balance payment reminder — ${reservation.bookingReference}`,
    html: renderEmailLayout({ preheader: `Your remaining balance is ${formatCurrency(reservation.balanceDueCents)}`, title: "Your stay is almost here.", body }),
  });
}

export async function resendBalanceReminderForOwner(reservationId: number): Promise<DeliveryResult> {
  const context = await loadReservationEmailContext(reservationId);
  if (!context || context.reservation.status !== "confirmed" || context.reservation.balancePaidAt || context.reservation.balanceDueCents <= 0) {
    throw new Error("A balance reminder can only be sent for a confirmed reservation with an unpaid balance.");
  }

  const existing = await getOrCreateEmailEvent(reservationId, "balance_reminder");
  if (existing.status === "sending") return "skipped";

  const db = await getDb();
  if (!db) throw new Error("Database unavailable while recording the manual reminder resend.");
  await db
    .update(bookingEmailEvents)
    .set({
      status: "scheduled",
      scheduledFor: new Date(),
      sentAt: null,
      failedAt: null,
      manualResendCount: sql`${bookingEmailEvents.manualResendCount} + 1`,
      lastManualResendAt: new Date(),
    })
    .where(eq(bookingEmailEvents.id, existing.id));

  return sendBalanceReminder(reservationId);
}

export async function sendDueBalanceReminders(limit = 25) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while finding scheduled balance reminders.");
  const retryAfter = new Date(Date.now() - 15 * 60 * 1000);
  const due = await db
    .select({ reservationId: bookingEmailEvents.reservationId })
    .from(bookingEmailEvents)
    .where(
      and(
        eq(bookingEmailEvents.kind, "balance_reminder"),
        or(
          and(eq(bookingEmailEvents.status, "scheduled"), lte(bookingEmailEvents.scheduledFor, new Date())),
          and(eq(bookingEmailEvents.status, "failed"), lte(bookingEmailEvents.failedAt, retryAfter)),
        ),
      ),
    )
    .limit(limit);

  let sent = 0;
  let skipped = 0;
  for (const event of due) {
    const result = await sendBalanceReminder(event.reservationId);
    if (result === "sent") sent += 1;
    else skipped += 1;
  }
  return { sent, skipped, considered: due.length };
}
