import { describe, expect, it } from "vitest";
import { formatCurrency, formatLocalDate, renderEmailLayout } from "./email";

describe("transactional email presentation", () => {
  it("formats booking amounts in USD", () => {
    expect(formatCurrency(12345)).toBe("$123.45");
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("renders stay dates in the inn's local timezone", () => {
    expect(formatLocalDate("2026-10-02")).toBe("October 2, 2026");
  });

  it("renders the Old Northside branded email frame", () => {
    const html = renderEmailLayout({
      preheader: "Booking reference ON-1234",
      title: "Your stay is confirmed.",
      body: "<p>We look forward to welcoming you.</p>",
    });

    expect(html).toContain("Old Northside");
    expect(html).toContain("Booking reference ON-1234");
    expect(html).toContain("Your stay is confirmed.");
    expect(html).toContain("1340 North Alabama Street");
  });
});
