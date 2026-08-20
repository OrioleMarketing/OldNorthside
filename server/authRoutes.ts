import type { Express } from "express";
import { consumeMagicLink, setSessionCookie } from "./auth";

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/magic-link/verify", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    try {
      const user = await consumeMagicLink(token);
      if (!user) {
        res.redirect(302, "/login?error=invalid_or_expired");
        return;
      }
      await setSessionCookie(req, res, user.id);
      res.redirect(302, "/?auth=magic-link");
    } catch (error) {
      console.error("[Auth] Magic-link verification failed:", error);
      res.redirect(302, "/login?error=verification_failed");
    }
  });
}
