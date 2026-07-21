import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { clearWebsiteAdminSession, hashWebsiteAdminPassword, setWebsiteAdminSession, verifyWebsiteAdminPassword, WEBSITE_ADMIN_SESSION_COOKIE } from "./websiteAdminAuth";

type CookieCall = { name: string; value?: string; options: Record<string, unknown> };

function requestStub() {
  return { protocol: "https", headers: {} } as never;
}

function responseStub(calls: CookieCall[]) {
  return {
    cookie: (name: string, value: string, options: Record<string, unknown>) => calls.push({ name, value, options }),
    clearCookie: (name: string, options: Record<string, unknown>) => calls.push({ name, options }),
  } as never;
}

const websiteAdminUser: User = {
  id: -7,
  openId: "website-admin:7",
  name: "Test Innkeeper",
  email: "innkeeper@example.com",
  loginMethod: "website-password",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("websiteAdminAuth", () => {
  it("hashes passwords with a salted scrypt encoding and rejects the wrong secret", async () => {
    const encoded = await hashWebsiteAdminPassword("A secure test password 2026!");
    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$/);
    const [, , , , salt, digest] = encoded.split("$");
    expect(Buffer.from(salt ?? "", "base64url")).toHaveLength(16);
    expect(Buffer.from(digest ?? "", "base64url")).toHaveLength(64);
    expect(await verifyWebsiteAdminPassword("A secure test password 2026!", encoded)).toBe(true);
    expect(await verifyWebsiteAdminPassword("wrong password", encoded)).toBe(false);
    expect(await verifyWebsiteAdminPassword("A secure test password 2026!", `${encoded}!`)).toBe(false);
    expect(await verifyWebsiteAdminPassword("A secure test password 2026!", "scrypt$not-a-number$8$1$salt$hash")).toBe(false);
  });

  it("issues and clears an httpOnly bounded website-admin session cookie", () => {
    const calls: CookieCall[] = [];
    const request = requestStub();
    const response = responseStub(calls);
    setWebsiteAdminSession(response, request, websiteAdminUser);
    clearWebsiteAdminSession(response, request);

    expect(calls[0]).toMatchObject({ name: WEBSITE_ADMIN_SESSION_COOKIE, options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } });
    expect(calls[0]?.value).toContain(".");
    expect(calls[1]).toMatchObject({ name: WEBSITE_ADMIN_SESSION_COOKIE, options: { maxAge: -1, httpOnly: true, secure: true, sameSite: "lax", path: "/" } });
  });
});
