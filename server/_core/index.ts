import "dotenv/config";
import { timingSafeEqual } from "crypto";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { constructStripeEvent, processStripeEvent } from "../stripe";
import { sendBookingConfirmation, sendDueBalanceReminders } from "../email";
import { hasBalanceReminderScheduleTaskUid } from "../booking";
import { applyInboundChannelInventoryEvent } from "../channelSync";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Stripe requires the untouched request body for signature verification. This route must be registered before JSON parsing.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      return res.status(400).json({ error: "Missing Stripe signature." });
    }

    try {
      const event = constructStripeEvent(req.body, signature);
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }
      const paymentResult = await processStripeEvent(event);
      if (paymentResult.handled && paymentResult.paymentKind === "deposit") {
        try {
          await sendBookingConfirmation(paymentResult.reservationId);
        } catch (emailError) {
          console.error("[Booking confirmation email]", emailError);
        }
      }
      return res.json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook verification failed.";
      console.error("[Stripe webhook]", message);
      return res.status(400).json({ error: message });
    }
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.post("/api/channel-sync/inbound", async (req, res) => {
    const configuredSecret = process.env.CHANNEL_SYNC_WEBHOOK_SECRET;
    if (!configuredSecret) {
      return res.status(503).json({ error: "Channel synchronization is not configured." });
    }
    const suppliedSecret = req.header("x-channel-sync-secret");
    if (
      !suppliedSecret ||
      suppliedSecret.length !== configuredSecret.length ||
      !timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(configuredSecret))
    ) {
      return res.status(401).json({ error: "Unauthorized channel synchronization request." });
    }

    try {
      const body = req.body as Record<string, unknown>;
      // Deliberately project only the canonical non-PII inventory envelope; raw provider payloads are discarded.
      const result = await applyInboundChannelInventoryEvent({
        provider: typeof body.provider === "string" ? body.provider : "",
        eventType: typeof body.eventType === "string" ? body.eventType as "reservation_created" | "reservation_modified" | "reservation_cancelled" : "" as never,
        idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : "",
        externalReservationId: typeof body.externalReservationId === "string" ? body.externalReservationId : "",
        externalRoomId: typeof body.externalRoomId === "string" ? body.externalRoomId : "",
        checkIn: typeof body.checkIn === "string" ? body.checkIn : undefined,
        checkOut: typeof body.checkOut === "string" ? body.checkOut : undefined,
        eventVersion: typeof body.eventVersion === "string" ? body.eventVersion : undefined,
      });
      return res.status(202).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid channel inventory event.";
      console.error("[Channel sync inbound]", message);
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/scheduled/balance-reminders", async (req, res) => {
    try {
      const caller = await sdk.authenticateRequest(req);
      if (!caller.isCron || !caller.taskUid) {
        return res.status(403).json({ error: "This scheduled callback is not authorized." });
      }
      const isCurrentTask = await hasBalanceReminderScheduleTaskUid(caller.taskUid);
      if (!isCurrentTask) {
        return res.json({ ok: true, skipped: "orphaned reminder schedule" });
      }
      const result = await sendDueBalanceReminders();
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process balance reminders.";
      console.error("[Balance reminder scheduler]", message);
      return res.status(401).json({ error: "Unauthorized scheduled callback." });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
