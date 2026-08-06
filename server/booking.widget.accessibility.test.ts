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
    expect(bookingWidgetSource).toContain("Adult guest {index + 1} full name");
    expect(bookingWidgetSource).toContain("<Input required value={adult.name}");
    expect(bookingWidgetSource).toContain("has stayed with us before.");
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

  it("waits for a valid overnight date range before loading availability", () => {
    expect(bookingWidgetSource).toContain("Boolean(checkIn && checkOut && checkOut > checkIn)");
    expect(bookingWidgetSource).toContain("availability.useQuery(queryInput, { enabled: canCheckAvailability })");
    expect(bookingWidgetSource).toContain("const availableRooms = canCheckAvailability ? (availabilityQuery.data ?? []) : []");
    expect(bookingWidgetSource).toContain("Select a check-in and a later check-out date to view live availability.");
  });

  it("communicates checkout progress and the secure-payment notice", () => {
    expect(bookingWidgetSource).toContain("aria-busy={checkout.isPending}");
    expect(bookingWidgetSource).toContain('id="secure-payment-notice"');
    expect(bookingWidgetSource).toContain('aria-describedby="secure-payment-notice"');
    expect(bookingWidgetSource).toContain("Preparing secure checkout");
  });

  it("defaults children to zero and lets guests choose a deposit or the full stay", () => {
    expect(bookingWidgetSource).toContain('const [childCount, setChildCount] = useState("0")');
    expect(bookingWidgetSource).toContain("Children (under age 18)");
    expect(bookingWidgetSource).toContain("Adult guests");
    expect(bookingWidgetSource).toContain("Reservations must be made at least one day and no more than 160 days in advance");
    expect(bookingWidgetSource).toContain("Payment today");
    expect(bookingWidgetSource).toContain("Pay the first-night deposit");
    expect(bookingWidgetSource).toContain("Pay the full stay today");
    expect(bookingWidgetSource).toContain("paymentSelection");
  });
});
