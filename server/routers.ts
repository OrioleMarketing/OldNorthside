import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import {
  appendReservationAuditEvent,
  cancelOwnerBlock,
  cancelReservationForOwner,
  createOwnerBlock,
  createOwnerReservation,
  createReservationHold,
  getActiveRooms,
  getAvailableRooms,
  getBalanceReminderScheduleTaskUid,
  getOwnerReservationById,
  getPublicSettings,
  getReservationByReference,
  listOwnerBlocks,
  listOwnerReservations,
  recordStripePayment,
  setBalanceReminderScheduleTaskUid,
  updateBookingSettings,
} from "./booking";
import { getSessionCookieOptions } from "./_core/cookies";
import { authenticateWebsiteAdmin, clearLoginAttempts, clearWebsiteAdminSession, ensureLoginAllowed, recordFailedLogin, setWebsiteAdminSession } from "./websiteAdminAuth";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { chargeSavedBalanceOffSession, createReservationCheckoutSession } from "./stripe";
import { resendBalanceReminderForOwner, sendBookingConfirmation, sendOwnerPaymentLink } from "./email";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { getChannelSyncReadiness, listChannelSyncEvents } from "./channelSync";

const stayInput = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD check-in date."),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD check-out date."),
});

const reservationInput = stayInput.extend({
  roomId: z.number().int().positive(),
  guestName: z.string().trim().min(2).max(180),
  guestEmail: z.string().trim().email().max(320),
  guestPhone: z.string().trim().min(7).max(50),
  guestCount: z.number().int().min(1).max(4),
  childCount: z.number().int().min(0).max(4).default(0),
  hasPet: z.boolean().default(false),
  dogCount: z.number().int().min(0).max(2).default(0),
  dogsUnder25Lbs: z.boolean().default(false),
  petPolicyAcknowledged: z.boolean().default(false),
});

function requestOrigin(req: { protocol?: string; get?: (name: string) => string | undefined; headers: Record<string, unknown> }) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0] : req.protocol ?? "https";
  const host = req.get?.("host") ?? (typeof req.headers.host === "string" ? req.headers.host : undefined);
  if (!host) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The booking origin could not be determined." });
  return `${protocol}://${host}`;
}

function getSessionToken(req: { headers: { cookie?: string | string[] | undefined } }) {
  const rawCookie = typeof req.headers.cookie === "string" ? req.headers.cookie : "";
  return parseCookie(rawCookie)[COOKIE_NAME] ?? "";
}

function bookingError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  const message = error instanceof Error ? error.message : "We could not complete that booking step.";
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    innkeeperLogin: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        try {
          ensureLoginAllowed(ctx.req, input.email);
        } catch (error) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error instanceof Error ? error.message : "Please wait before trying again." });
        }
        const user = await authenticateWebsiteAdmin(input.email, input.password);
        if (!user) {
          recordFailedLogin(ctx.req, input.email);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }
        clearLoginAttempts(ctx.req, input.email);
        setWebsiteAdminSession(ctx.res, ctx.req, user);
        return user;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      clearWebsiteAdminSession(ctx.res, ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  booking: router({
    rooms: publicProcedure.query(() => getActiveRooms()),
    settings: publicProcedure.query(() => getPublicSettings()),
    availability: publicProcedure.input(stayInput).query(async ({ input }) => {
      try {
        return await getAvailableRooms(input.checkIn, input.checkOut);
      } catch (error) {
        return bookingError(error);
      }
    }),
    createDepositCheckout: publicProcedure
      .input(reservationInput.extend({ paymentSelection: z.enum(["deposit", "full_stay"]).default("deposit"), savePaymentMethodForBalance: z.boolean().default(false) }))
      .mutation(async ({ input, ctx }) => {
        try {
          const created = await createReservationHold(input);
          const checkout = await createReservationCheckoutSession({
            reservation: created.reservation,
            roomName: created.room.name,
            origin: requestOrigin(ctx.req),
            paymentKind: "deposit",
            savePaymentMethodForBalance: input.savePaymentMethodForBalance,
          });
          return {
            bookingReference: created.reservation.bookingReference,
            quote: created.quote,
            checkoutUrl: checkout.url,
            holdExpiresAt: created.reservation.holdExpiresAt,
          };
        } catch (error) {
          return bookingError(error);
        }
      }),
    lookup: publicProcedure
      .input(z.object({ bookingReference: z.string().trim().min(8).max(32), guestEmail: z.string().trim().email() }))
      .query(async ({ input }) => {
        const result = await getReservationByReference(input.bookingReference.toUpperCase(), input.guestEmail);
        if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "We could not find that reservation." });
        return result;
      }),
    createBalanceCheckout: publicProcedure
      .input(z.object({ bookingReference: z.string().trim().min(8).max(32), guestEmail: z.string().trim().email() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await getReservationByReference(input.bookingReference.toUpperCase(), input.guestEmail);
          if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "We could not find that reservation." });
          const { reservation, room } = result;
          if (reservation.status !== "confirmed") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This reservation is not ready for a balance payment." });
          }
          if (reservation.balancePaidAt || reservation.balanceDueCents <= 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "There is no remaining balance due for this reservation." });
          }
          const checkout = await createReservationCheckoutSession({
            reservation,
            roomName: room.name,
            origin: requestOrigin(ctx.req),
            paymentKind: "balance",
          });
          return { bookingReference: reservation.bookingReference, checkoutUrl: checkout.url };
        } catch (error) {
          return bookingError(error);
        }
      }),
  }),

  owner: router({
    reservations: adminProcedure
      .input(stayInput.partial())
      .query(({ input }) => listOwnerReservations({ start: input.checkIn, end: input.checkOut })),
    blocks: adminProcedure
      .input(stayInput.partial())
      .query(({ input }) => listOwnerBlocks({ start: input.checkIn, end: input.checkOut })),
    createBlock: adminProcedure
      .input(stayInput.extend({ roomId: z.number().int().positive(), reason: z.string().trim().min(2).max(240) }))
      .mutation(async ({ input, ctx }) => {
        try {
          await createOwnerBlock({ ...input, createdByUserId: ctx.user.id });
          return { success: true } as const;
        } catch (error) {
          return bookingError(error);
        }
      }),
    cancelBlock: adminProcedure
      .input(z.object({ reservationBlockId: z.number().int().positive(), reason: z.string().trim().min(2).max(240) }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await cancelOwnerBlock({ ...input, actorUserId: ctx.user.id });
        } catch (error) {
          return bookingError(error);
        }
      }),
    createPhoneReservation: adminProcedure
      .input(reservationInput.extend({ markDepositCollected: z.boolean().default(false), sendDepositPaymentLink: z.boolean().default(true) }))
      .mutation(async ({ input, ctx }) => {
        try {
          const created = await createOwnerReservation(input);
          let paymentLinkSent = false;
          if (!input.markDepositCollected && input.sendDepositPaymentLink) {
            const checkout = await createReservationCheckoutSession({
              reservation: created.reservation,
              roomName: created.room.name,
              origin: requestOrigin(ctx.req),
              paymentKind: "deposit",
            });
            await sendOwnerPaymentLink({ reservationId: created.reservation.id, checkoutUrl: checkout.url, paymentKind: "deposit" });
            await appendReservationAuditEvent({
              reservationId: created.reservation.id,
              action: "payment_link_created",
              actorUserId: ctx.user.id,
              detail: "Deposit payment link emailed after owner-created reservation.",
            });
            paymentLinkSent = true;
          }
          if (input.markDepositCollected) {
            try {
              await sendBookingConfirmation(created.reservation.id);
            } catch (error) {
              console.error("[Booking confirmation email]", error);
            }
          }
          return {
            bookingReference: created.reservation.bookingReference,
            reservationId: created.reservation.id,
            paymentLinkSent,
            status: created.reservation.status,
          };
        } catch (error) {
          return bookingError(error);
        }
      }),
    cancelReservation: adminProcedure
      .input(z.object({ reservationId: z.number().int().positive(), reason: z.string().trim().min(2).max(240) }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await cancelReservationForOwner({ ...input, actorUserId: ctx.user.id });
        } catch (error) {
          return bookingError(error);
        }
      }),
    sendPaymentLink: adminProcedure
      .input(z.object({ reservationId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await getOwnerReservationById(input.reservationId);
          if (!result) throw new Error("Reservation not found.");
          const { reservation, room } = result;
          const paymentKind = reservation.status === "pending_deposit"
            ? "deposit"
            : reservation.status === "confirmed" && reservation.balanceDueCents > 0 && !reservation.balancePaidAt
              ? "balance"
              : null;
          if (!paymentKind) throw new Error("This reservation does not have an eligible payment amount to request.");
          const checkout = await createReservationCheckoutSession({
            reservation,
            roomName: room.name,
            origin: requestOrigin(ctx.req),
            paymentKind,
          });
          await sendOwnerPaymentLink({ reservationId: reservation.id, checkoutUrl: checkout.url, paymentKind });
          await appendReservationAuditEvent({
            reservationId: reservation.id,
            action: "payment_link_created",
            actorUserId: ctx.user.id,
            detail: `${paymentKind === "deposit" ? "Deposit" : "Balance"} payment link emailed by owner.`,
          });
          return { sent: true as const, paymentKind };
        } catch (error) {
          return bookingError(error);
        }
      }),
    chargeSavedBalance: adminProcedure
      .input(z.object({ reservationId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const result = await getOwnerReservationById(input.reservationId);
        if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Reservation not found." });
        const { reservation, room } = result;
        if (reservation.status !== "confirmed" || reservation.balancePaidAt || reservation.balanceDueCents <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This reservation does not have an unpaid balance eligible for collection." });
        }
        try {
          await appendReservationAuditEvent({
            reservationId: reservation.id,
            action: "off_session_charge_attempted",
            actorUserId: ctx.user.id,
            detail: "Owner initiated an authorized saved-card balance charge.",
          });
          const charge = await chargeSavedBalanceOffSession({ reservation, roomName: room.name });
          await recordStripePayment({ reservationId: reservation.id, paymentKind: "balance", paymentIntentId: charge.paymentIntentId });
          await appendReservationAuditEvent({
            reservationId: reservation.id,
            action: "off_session_charge_succeeded",
            actorUserId: ctx.user.id,
            stripePaymentIntentId: charge.paymentIntentId,
            detail: "Authorized saved-card balance charge completed.",
          });
          return { charged: true as const, paymentIntentId: charge.paymentIntentId };
        } catch (error) {
          await appendReservationAuditEvent({
            reservationId: reservation.id,
            action: "off_session_charge_failed",
            actorUserId: ctx.user.id,
            detail: error instanceof Error ? error.message : "Off-session balance charge did not complete.",
          });
          return bookingError(error);
        }
      }),
    settings: adminProcedure.query(() => getPublicSettings()),
    channelSyncReadiness: adminProcedure.query(() => getChannelSyncReadiness()),
    channelSyncEvents: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(({ input }) => listChannelSyncEvents(input?.limit)),
    reminderSchedule: adminProcedure.query(async () => ({ taskUid: await getBalanceReminderScheduleTaskUid() })),
    enableReminderSchedule: adminProcedure.mutation(async ({ ctx }) => {
      const sessionToken = getSessionToken(ctx.req);
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in again to activate scheduled reminders." });
      const existingTaskUid = await getBalanceReminderScheduleTaskUid();
      const jobPatch = {
        cron: "0 0 * * * *",
        path: "/api/scheduled/balance-reminders",
        method: "POST" as const,
        payload: {},
        description: "Hourly delivery check for due Old Northside balance-payment reminders.",
      };
      if (existingTaskUid) {
        const updated = await updateHeartbeatJob(existingTaskUid, { ...jobPatch, enable: true }, sessionToken);
        return { taskUid: existingTaskUid, action: "resumed" as const, nextExecutionAt: updated.nextExecutionAt ?? null };
      }
      const created = await createHeartbeatJob({ name: "old-northside-balance-reminders", ...jobPatch }, sessionToken);
      await setBalanceReminderScheduleTaskUid(created.taskUid);
      return { taskUid: created.taskUid, action: "created" as const, nextExecutionAt: created.nextExecutionAt ?? null };
    }),
    pauseReminderSchedule: adminProcedure.mutation(async ({ ctx }) => {
      const sessionToken = getSessionToken(ctx.req);
      const taskUid = await getBalanceReminderScheduleTaskUid();
      if (!taskUid) return { paused: false, taskUid: null } as const;
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in again to pause scheduled reminders." });
      await updateHeartbeatJob(taskUid, { enable: false }, sessionToken);
      return { paused: true, taskUid };
    }),
    resendBalanceReminder: adminProcedure
      .input(z.object({ reservationId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          return { result: await resendBalanceReminderForOwner(input.reservationId) };
        } catch (error) {
          return bookingError(error);
        }
      }),
    updateSettings: adminProcedure
      .input(
        z.object({
          depositNights: z.number().int().min(1).max(30).optional(),
          paymentCollectionMode: z.enum(["first_night_deposit", "full_stay"]).optional(),
          balanceReminderDays: z.number().int().min(1).max(30).optional(),
          stateTaxRateBasisPoints: z.number().int().min(0).max(10_000).optional(),
          countyTaxRateBasisPoints: z.number().int().min(0).max(10_000).optional(),
          shortTermTaxThresholdNights: z.number().int().min(1).max(365).optional(),
          channelProvider: z.string().trim().max(96).nullable().optional(),
          // A connection can only become "connected" through a future authorized provider adapter.
          channelConnectionStatus: z.enum(["not_connected", "pending", "error"]).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await updateBookingSettings(input);
        } catch (error) {
          return bookingError(error);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
