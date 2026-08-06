import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  createPaymentIntent: vi.fn(),
  saveDepositCheckoutSession: vi.fn(),
  saveBalanceCheckoutSession: vi.fn(),
  recordStripePayment: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = { sessions: { create: mocks.createCheckoutSession } };
    paymentIntents = { create: mocks.createPaymentIntent, retrieve: vi.fn() };
    webhooks = { constructEvent: vi.fn() };
  },
}));

vi.mock("./booking", () => ({
  saveDepositCheckoutSession: mocks.saveDepositCheckoutSession,
  saveBalanceCheckoutSession: mocks.saveBalanceCheckoutSession,
  recordStripePayment: mocks.recordStripePayment,
}));

import { chargeSavedBalanceOffSession, createReservationCheckoutSession } from "./stripe";

const reservation = {
  id: 41,
  bookingReference: "ON-TEST41",
  guestEmail: "guest@example.test",
  guestName: "Payment Workflow Guest",
  guestPhone: "317-555-0100",
  checkIn: "2032-08-14",
  checkOut: "2032-08-16",
  depositDueCents: 17_250,
  balanceDueCents: 34_500,
  stripeCustomerId: "cus_owner_test",
  stripePaymentMethodId: "pm_owner_test",
  paymentMethodConsentAt: new Date("2032-01-10T12:00:00.000Z"),
};

describe("owner payment-link and saved-card charge helpers", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_mocked_owner_workflow";
    mocks.createCheckoutSession.mockReset();
    mocks.createPaymentIntent.mockReset();
    mocks.saveDepositCheckoutSession.mockReset();
    mocks.saveBalanceCheckoutSession.mockReset();
    mocks.recordStripePayment.mockReset();
  });

  it("creates a hosted deposit checkout link and records its session for owner delivery", async () => {
    mocks.createCheckoutSession.mockResolvedValue({ id: "cs_owner_deposit", url: "https://checkout.stripe.test/cs_owner_deposit" });

    const result = await createReservationCheckoutSession({
      reservation,
      roomName: "The Bridal Room",
      origin: "https://oldnorthside.example.test",
      paymentKind: "deposit",
    });

    expect(result).toEqual({ id: "cs_owner_deposit", url: "https://checkout.stripe.test/cs_owner_deposit" });
    expect(mocks.saveDepositCheckoutSession).toHaveBeenCalledWith(41, "cs_owner_deposit");
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      customer_email: "guest@example.test",
      client_reference_id: "41",
      metadata: expect.objectContaining({ reservation_id: "41", payment_kind: "deposit" }),
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 17_250 }) })],
    }));
  });

  it("rejects owner payment-link creation when Stripe does not provide a hosted checkout URL", async () => {
    mocks.createCheckoutSession.mockResolvedValue({ id: "cs_missing_url", url: null });

    await expect(createReservationCheckoutSession({
      reservation,
      roomName: "The Bridal Room",
      origin: "https://oldnorthside.example.test",
      paymentKind: "balance",
    })).rejects.toThrow("Stripe did not return a checkout URL.");
    expect(mocks.saveBalanceCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses an owner-initiated off-session balance charge without recorded guest consent", async () => {
    await expect(chargeSavedBalanceOffSession({
      reservation: { ...reservation, paymentMethodConsentAt: null },
      roomName: "The Bridal Room",
    })).rejects.toThrow("has not authorized a saved payment method");
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled();
  });

  it("creates a confirmed off-session balance charge only when a saved method and consent exist", async () => {
    mocks.createPaymentIntent.mockResolvedValue({ id: "pi_owner_balance", status: "succeeded" });

    const result = await chargeSavedBalanceOffSession({ reservation, roomName: "The Bridal Room" });

    expect(result).toEqual({ paymentIntentId: "pi_owner_balance" });
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
      amount: 34_500,
      customer: "cus_owner_test",
      payment_method: "pm_owner_test",
      confirm: true,
      off_session: true,
      metadata: expect.objectContaining({ charge_origin: "owner_authorized_off_session", payment_kind: "balance" }),
    }), { idempotencyKey: "old-northside-scheduled-balance-41" });
  });

  it("returns a safe payment-link fallback error if Stripe cannot complete the off-session charge", async () => {
    mocks.createPaymentIntent.mockResolvedValue({ id: "pi_requires_action", status: "requires_action" });

    await expect(chargeSavedBalanceOffSession({ reservation, roomName: "The Bridal Room" })).rejects.toThrow("Send a secure payment link instead.");
  });
});
