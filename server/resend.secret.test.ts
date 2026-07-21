import { describe, expect, it } from "vitest";

describe("Resend configuration", () => {
  it("authenticates against the Resend domains endpoint without sending an email", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey, "RESEND_API_KEY must be configured for transactional email").toBeTruthy();

    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    expect(response.status, `Resend credential validation failed with status ${response.status}`).toBeLessThan(400);
  }, 20_000);
});
