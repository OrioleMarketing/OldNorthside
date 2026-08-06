import { describe, expect, it } from "vitest";
import { assertBookingAdvanceWindow, calculateQuote, getNights, latestBookableCheckIn } from "./booking";

const room = {
  weekdayRateCents: 10_000,
  weekendRateCents: 15_000,
};

describe("booking pricing", () => {
  it("collects the first Friday night plus 7% state and 10% county tax for a short-term stay", () => {
    const quote = calculateQuote(room, "2026-07-17", "2026-07-19", {
      depositNights: 1,
      stateTaxRateBasisPoints: 700,
      countyTaxRateBasisPoints: 1000,
      shortTermTaxThresholdNights: 30,
    });

    expect(quote.nights).toBe(2);
    expect(quote.subtotalCents).toBe(30_000);
    expect(quote.stateTaxCents).toBe(2_100);
    expect(quote.countyTaxCents).toBe(3_000);
    expect(quote.totalCents).toBe(35_100);
    expect(quote.depositDueCents).toBe(17_550);
    expect(quote.balanceDueCents).toBe(17_550);
    expect(quote.isShortTermTaxable).toBe(true);
  });

  it("collects the entire stay total when the owner selects full-stay payment", () => {
    const quote = calculateQuote(room, "2026-07-17", "2026-07-19", {
      paymentCollectionMode: "full_stay",
      depositNights: 1,
      stateTaxRateBasisPoints: 700,
      countyTaxRateBasisPoints: 1000,
      shortTermTaxThresholdNights: 30,
    });

    expect(quote.totalCents).toBe(35_100);
    expect(quote.firstNightDepositDueCents).toBe(17_550);
    expect(quote.depositDueCents).toBe(35_100);
    expect(quote.balanceDueCents).toBe(0);
  });

  it("uses premium rates on Friday and Saturday, not Sunday", () => {
    const quote = calculateQuote(room, "2026-07-17", "2026-07-20", {
      depositNights: 1,
      stateTaxRateBasisPoints: 700,
      countyTaxRateBasisPoints: 1000,
    });

    expect(quote.nightlyBreakdown.map(night => night.rateCents)).toEqual([15_000, 15_000, 10_000]);
    expect(quote.subtotalCents).toBe(40_000);
  });

  it("rejects same-day, reverse-date, and longer-than-28-night stays", () => {
    expect(() => getNights("2026-07-20", "2026-07-20")).toThrow("at least one night");
    expect(() => getNights("2026-07-21", "2026-07-20")).toThrow("at least one night");
    expect(() => getNights("2026-07-01", "2026-07-30")).toThrow("maximum of 28 nights");
  });

  it("allows check-in through 160 days out and rejects later check-in dates", () => {
    const now = new Date("2026-01-01T15:00:00.000Z");
    const latest = latestBookableCheckIn(now);
    const dayAfterLatest = new Date(`${latest}T00:00:00.000Z`);
    dayAfterLatest.setUTCDate(dayAfterLatest.getUTCDate() + 1);

    expect(() => assertBookingAdvanceWindow(latest, now)).not.toThrow();
    expect(() => assertBookingAdvanceWindow(dayAfterLatest.toISOString().slice(0, 10), now)).toThrow("up to 160 days in advance");
  });
});
