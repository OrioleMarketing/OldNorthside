import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashWebsiteAdminInvitationToken, websiteAdminIdForUser } from "./websiteAdminAccess";

describe("website administrator invitation safeguards", () => {
  it("hashes setup tokens deterministically without retaining the token itself", () => {
    const token = "one-time-invitation-token";
    const digest = hashWebsiteAdminInvitationToken(token);

    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(hashWebsiteAdminInvitationToken(token));
    expect(digest).not.toContain(token);
    expect(digest).not.toBe(hashWebsiteAdminInvitationToken("different-token"));
  });

  it("maps only a valid website-admin identity to a revocation-safe administrator id", () => {
    expect(websiteAdminIdForUser("website-admin:12")).toBe(12);
    expect(websiteAdminIdForUser("website-admin:0")).toBeNull();
    expect(websiteAdminIdForUser("website-admin:-3")).toBeNull();
    expect(websiteAdminIdForUser("manus-user:12")).toBeNull();
  });

  it("exposes an authenticated management link and a one-time setup page", () => {
    const ownerPage = readFileSync(resolve(process.cwd(), "client/src/pages/OwnerPage.tsx"), "utf8");
    const accessPage = readFileSync(resolve(process.cwd(), "client/src/pages/InnkeeperAccessPage.tsx"), "utf8");
    const invitePage = readFileSync(resolve(process.cwd(), "client/src/pages/InnkeeperInvitePage.tsx"), "utf8");

    expect(ownerPage).toContain('label: "Innkeeper access", path: "/owner/access"');
    expect(accessPage).toContain("Create secure invitation");
    expect(accessPage).toContain("Revoke access");
    expect(accessPage).toContain("expires 72 hours");
    expect(invitePage).toContain("Create innkeeper account");
    expect(invitePage).toContain("This invitation is invalid, expired, revoked, or has already been used.");
  });
});
