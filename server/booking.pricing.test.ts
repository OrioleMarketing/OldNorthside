import { describe, expect, it } from "vitest";
import { calculateQuote, getNights } from "./booking";

const room = {
  weekdayRateCents: 10_000,
  weekendRateCents: 15_000,
};

describe("booking pricing", () => {
  it("collects the first night plus 7% state and 3% county tax for a short-term stay", () => {
    const quote = calculateQuote(room, "2026-07-17", "2026-07-19", {
      depositNights: 1,
      stateTaxRateBasisPoints: 700,
      countyTaxRateBasisPoints: 300,
      shortTermTaxThresholdNights: 30,
    });

    expect(quote.nights).toBe(2);
    expect(quote.subtotalCents).toBe(30_000);
    expect(quote.stateTaxCents).toBe(2_100);
    expect(quote.countyTaxCents).toBe(900);
    expect(quote.totalCents).toBe(33_000);
    expect(quote.depositDueCents).toBe(16_500);
    expect(quote.balanceDueCents).toBe(16_500);
    expect(quote.isShortTermTaxable).toBe(true);
  });

  it("collects the entire stay total when the owner selects full-stay payment", () => {
    const quote = calculateQuote(room, "2026-07-17", "2026-07-19", {
      paymentCollectionMode: "full_stay",
      depositNights: 1,
      stateTaxRateBasisPoints: 700,
      countyTaxRateBasisPoints: 300,
      shortTermTaxThresholdNights: 30,
    });

    expect(quote.totalCents).toBe(33_000);
    expect(quote.firstNightDepositDueCents).toBe(16_500);
    expect(quote.depositDueCents).toBe(33_000);
    expect(quote.balanceDueCents).toBe(0);
  });

  it("does not apply the supplied short-term lodging taxes to a 30-night stay", () => {
    const quote = calculateQuote(room, "2026-06-01", "2026-07-01", {
      depositNights: 1,
      stateTaxRateBasisPoints: 700,
      countyTaxRateBasisPoints: 300,
      shortTermTaxThresholdNights: 30,
    });

    expect(quote.nights).toBe(30);
    expect(quote.isShortTermTaxable).toBe(false);
    expect(quote.stateTaxCents).toBe(0);
    expect(quote.countyTaxCents).toBe(0);
    expect(quote.totalCents).toBe(quote.subtotalCents);
    expect(quote.depositDueCents).toBe(10_000);
  });

  it("rejects same-day and reverse-date stays", () => {
    expect(() => getNights("2026-07-20", "2026-07-20")).toThrow("at least one night");
    expect(() => getNights("2026-07-21", "2026-07-20")).toThrow("at least one night");
  });
});
