import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateRequest, type AuthUser } from "../auth";
import { getWebsiteAdminFromRequest } from "../websiteAdminAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AuthUser | null = null;

  try {
    // Innkeeper sessions retain precedence for the owner dashboard; member sessions
    // are evaluated only when no valid innkeeper cookie is present.
    user = await getWebsiteAdminFromRequest(opts.req);
    if (!user) user = await authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
