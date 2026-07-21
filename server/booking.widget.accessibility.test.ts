import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const bookingWidgetPath = fileURLToPath(new URL("../client/src/components/BookingWidget.tsx", import.meta.url));
const bookingWidgetSource = readFileSync(bookingWidgetPath, "utf8");

describe("booking widget accessibility affordances", () => {
  it("announces changing availability and exposes loading state", () => {
    expect(bookingWidgetSource).toContain('className="sr-only" role="status"');
    expect(bookingWidgetSource).toContain("aria-busy={canCheckAvailability && availabilityQuery.isLoading}");
    expect(bookingWidgetSource).toContain("const availabilityStatus");
  });

  it("keeps available rooms and required guest details accessible by keyboard and assistive technology", () => {
    expect(bookingWidgetSource).toContain('type="button"');
    expect(bookingWidgetSource).toContain("aria-pressed={isSelected}");
    expect(bookingWidgetSource).toContain("aria-label={`${room.name}");
    expect(bookingWidgetSource).toContain("<Input required value={guestName}");
    expect(bookingWidgetSource).toContain('<Input required type="email"');
    expect(bookingWidgetSource).toContain('<Input required type="tel"');
  });

  it("provides an accessible Start over control that resets booking inputs", () => {
    expect(bookingWidgetSource).toContain("function resetBooking()");
    expect(bookingWidgetSource).toContain("setStay(undefined)");
    expect(bookingWidgetSource).toContain("setCalendarMonth(today)");
    expect(bookingWidgetSource).toContain("setSelectedRoomId(null)");
    expect(bookingWidgetSource).toContain('aria-label="Start over and clear your booking selections"');
    expect(bookingWidgetSource).toContain("Start over");
  });

  it("communicates checkout progress and the secure-payment notice", () => {
    expect(bookingWidgetSource).toContain("aria-busy={checkout.isPending}");
    expect(bookingWidgetSource).toContain('id="secure-payment-notice"');
    expect(bookingWidgetSource).toContain('aria-describedby="secure-payment-notice"');
    expect(bookingWidgetSource).toContain("Preparing secure checkout");
  });
});
