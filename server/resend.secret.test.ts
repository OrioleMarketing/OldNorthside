import { describe, expect, it } from "vitest";

type ResendDomainsResponse = {
  data?: Array<{ name?: string; status?: string }>;
};

describe("Resend configuration", () => {
  it("authenticates against Resend and recognizes the configured sender domain without sending email", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    expect(apiKey, "RESEND_API_KEY must be configured for transactional email").toBeTruthy();
    expect(fromEmail, "RESEND_FROM_EMAIL must be configured for transactional email").toMatch(/^[^@\s]+@([^@\s]+)$/);

    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    expect(response.status, `Resend credential validation failed with status ${response.status}`).toBeLessThan(400);

    const payload = (await response.json()) as ResendDomainsResponse;
    const senderDomain = fromEmail!.slice(fromEmail!.lastIndexOf("@") + 1).toLowerCase();
    expect(senderDomain, "RESEND_FROM_EMAIL must use the verified Old Northside Bed and Breakfast domain").toBe("oldnorthsidebedandbreakfast.com");
    const matchingDomain = payload.data?.find(domain => domain.name?.toLowerCase() === senderDomain);
    expect(matchingDomain, `The configured sender domain ${senderDomain} is not available in this Resend account`).toBeTruthy();
    expect(matchingDomain?.status, `The configured sender domain ${senderDomain} is not verified in Resend`).toBe("verified");
  }, 20_000);
});
