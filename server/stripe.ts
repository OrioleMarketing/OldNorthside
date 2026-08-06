import Stripe from "stripe";
import { recordStripePayment, saveBalanceCheckoutSession, saveDepositCheckoutSession } from "./booking";

let stripeClient: Stripe | null = null;

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured for this project.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export type CheckoutReservation = {
  id: number;
  bookingReference: string;
  guestEmail: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  depositDueCents: number;
  balanceDueCents: number;
  stripeCustomerId?: string | null;
  stripePaymentMethodId?: string | null;
  paymentMethodConsentAt?: Date | null;
};

function stripeResourceId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

export async function createReservationCheckoutSession(input: {
  reservation: CheckoutReservation;
  roomName: string;
  origin: string;
  paymentKind: "deposit" | "balance";
  savePaymentMethodForBalance?: boolean;
}) {
  const stripe = getStripeClient();
  const amountCents = input.paymentKind === "deposit" ? input.reservation.depositDueCents : input.reservation.balanceDueCents;
  if (amountCents < 50) {
    throw new Error("The payment amount must be at least $0.50.");
  }

  const savePaymentMethodForBalance = input.paymentKind === "deposit" && Boolean(input.savePaymentMethodForBalance);
  const label = input.paymentKind === "deposit"
    ? input.reservation.balanceDueCents === 0
      ? "Full stay payment"
      : "First-night deposit"
    : "Remaining stay balance";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.reservation.guestEmail,
    customer_creation: savePaymentMethodForBalance ? "always" : undefined,
    client_reference_id: String(input.reservation.id),
    allow_promotion_codes: true,
    phone_number_collection: { enabled: true },
    metadata: {
      reservation_id: String(input.reservation.id),
      booking_reference: input.reservation.bookingReference,
      payment_kind: input.paymentKind,
      customer_email: input.reservation.guestEmail,
      customer_name: input.reservation.guestName,
      save_payment_method_for_balance: String(savePaymentMethodForBalance),
    },
    payment_intent_data: {
      setup_future_usage: savePaymentMethodForBalance ? "off_session" : undefined,
      metadata: {
        reservation_id: String(input.reservation.id),
        booking_reference: input.reservation.bookingReference,
        payment_kind: input.paymentKind,
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `${label} — ${input.roomName}`,
            description: `${input.reservation.checkIn} to ${input.reservation.checkOut} · Old Northside Bed and Breakfast`,
          },
        },
      },
    ],
    success_url: `${input.origin}/booking/confirmation?reference=${encodeURIComponent(input.reservation.bookingReference)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/booking?payment=cancelled`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  if (input.paymentKind === "deposit") {
    await saveDepositCheckoutSession(input.reservation.id, session.id);
  } else {
    await saveBalanceCheckoutSession(input.reservation.id, session.id);
  }
  return { id: session.id, url: session.url };
}

export async function chargeSavedBalanceOffSession(input: {
  reservation: CheckoutReservation;
  roomName: string;
}) {
  const { reservation } = input;
  if (reservation.balanceDueCents < 50) {
    throw new Error("There is no chargeable remaining balance for this reservation.");
  }
  if (!reservation.stripeCustomerId || !reservation.stripePaymentMethodId || !reservation.paymentMethodConsentAt) {
    throw new Error("The guest has not authorized a saved payment method for an off-session balance charge. Send a secure payment link instead.");
  }

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: reservation.balanceDueCents,
    currency: "usd",
    customer: reservation.stripeCustomerId,
    payment_method: reservation.stripePaymentMethodId,
    confirm: true,
    off_session: true,
    description: `Remaining stay balance — ${input.roomName}`,
    metadata: {
      reservation_id: String(reservation.id),
      booking_reference: reservation.bookingReference,
      payment_kind: "balance",
      charge_origin: "owner_authorized_off_session",
    },
  }, {
    idempotencyKey: `old-northside-scheduled-balance-${reservation.id}`,
  });

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Stripe did not complete the off-session balance charge. Send a secure payment link instead.");
  }
  return { paymentIntentId: paymentIntent.id };
}

export function constructStripeEvent(rawBody: Buffer, signature: string) {
  const stripe = getStripeClient();
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook signing secret is not configured.");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

export async function processStripeEvent(event: Stripe.Event) {
  // Stripe's verification events are handled in the route before reaching this function.
  if (event.type !== "checkout.session.completed") return { handled: false as const };
  const stripe = getStripeClient();
  const session = event.data.object as Stripe.Checkout.Session;
  const reservationId = Number(session.metadata?.reservation_id);
  const paymentKind = session.metadata?.payment_kind;
  if (!Number.isInteger(reservationId) || (paymentKind !== "deposit" && paymentKind !== "balance")) {
    return { handled: false as const, ignored: "missing_booking_metadata" as const };
  }

  const paymentIntentId = stripeResourceId(session.payment_intent);
  const savePaymentMethodForBalance = paymentKind === "deposit" && session.metadata?.save_payment_method_for_balance === "true";
  let stripeCustomerId: string | undefined;
  let stripePaymentMethodId: string | undefined;
  if (savePaymentMethodForBalance && paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    stripeCustomerId = stripeResourceId(session.customer) ?? stripeResourceId(paymentIntent.customer);
    stripePaymentMethodId = stripeResourceId(paymentIntent.payment_method);
  }

  await recordStripePayment({
    reservationId,
    paymentKind,
    paymentIntentId,
    stripeCustomerId,
    stripePaymentMethodId,
    savePaymentMethodForBalance: Boolean(savePaymentMethodForBalance && stripeCustomerId && stripePaymentMethodId),
  });
  return { handled: true as const, reservationId, paymentKind };
}
