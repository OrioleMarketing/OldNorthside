import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { WEBSITE_ADMIN_SESSION_COOKIE } from "./websiteAdminAuth";

const suppliedPassword = process.env.INITIAL_ADMIN_PASSWORD;
const configuredDescribe = suppliedPassword ? describe : describe.skip;

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

configuredDescribe("configured initial innkeeper credential", () => {
  it("authenticates through the local tRPC sign-in endpoint and issues a website-admin session", async () => {
    const cookies: CookieCall[] = [];
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
        ip: "127.0.0.1",
      } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
      } as TrpcContext["res"],
    };

    const user = await appRouter.createCaller(ctx).auth.innkeeperLogin({
      email: "Bruce@OrioleMarketing.com",
      password: suppliedPassword!,
    });

    expect(user).toMatchObject({
      email: "bruce@oriolemarketing.com",
      loginMethod: "website-password",
      role: "admin",
    });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: WEBSITE_ADMIN_SESSION_COOKIE,
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    });
    expect(cookies[0]?.value).not.toContain(suppliedPassword!);
  });
});
