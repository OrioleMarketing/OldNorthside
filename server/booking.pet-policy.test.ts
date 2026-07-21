import { describe, expect, it } from "vitest";
import { getValidatedPetDetails, type BookingInput } from "./booking";

function makeBookingInput(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    roomId: 1,
    checkIn: "2026-08-10",
    checkOut: "2026-08-12",
    guestName: "Test Guest",
    guestEmail: "guest@example.com",
    guestPhone: "317-555-0100",
    guestCount: 2,
    ...overrides,
  };
}

describe("Pet Policy reservation validation", () => {
  it("stores no pet details when a guest is not bringing a dog", () => {
    expect(getValidatedPetDetails(makeBookingInput())).toEqual({
      hasPet: 0,
      dogCount: 0,
      dogsUnder25Lbs: 0,
      petPolicyAcknowledged: 0,
    });
  });

  it("accepts one or two eligible dogs only after policy acknowledgment", () => {
    expect(getValidatedPetDetails(makeBookingInput({
      hasPet: true,
      dogCount: 2,
      dogsUnder25Lbs: true,
      petPolicyAcknowledged: true,
    }))).toEqual({
      hasPet: 1,
      dogCount: 2,
      dogsUnder25Lbs: 1,
      petPolicyAcknowledged: 1,
    });
  });

  it("rejects more than two dogs, dogs not confirmed under 25 pounds, and missing acknowledgment", () => {
    expect(() => getValidatedPetDetails(makeBookingInput({
      hasPet: true,
      dogCount: 3,
      dogsUnder25Lbs: true,
      petPolicyAcknowledged: true,
    }))).toThrow("A maximum of two dogs may stay with you.");

    expect(() => getValidatedPetDetails(makeBookingInput({
      hasPet: true,
      dogCount: 1,
      dogsUnder25Lbs: false,
      petPolicyAcknowledged: true,
    }))).toThrow("Each dog must weigh under 25 pounds to stay at the inn.");

    expect(() => getValidatedPetDetails(makeBookingInput({
      hasPet: true,
      dogCount: 1,
      dogsUnder25Lbs: true,
      petPolicyAcknowledged: false,
    }))).toThrow("Please review and acknowledge the Pet Policy before continuing.");
  });
});
