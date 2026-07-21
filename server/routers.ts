import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import {
  createOwnerBlock,
  createReservationHold,
  getActiveRooms,
  getAvailableRooms,
  getBalanceReminderScheduleTaskUid,
  setBalanceReminderScheduleTaskUid,
  getPublicSettings,
  getReservationByReference,
  listOwnerBlocks,
  listOwnerReservations,
  updateBookingSettings,
} from "./booking";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { createReservationCheckoutSession } from "./stripe";
import { resendBalanceReminderForOwner } from "./email";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";

const stayInput = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD check-in date."),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD check-out date."),
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
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
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
      .input(
        stayInput.extend({
          roomId: z.number().int().positive(),
          guestName: z.string().trim().min(2).max(180),
          guestEmail: z.string().trim().email().max(320),
          guestPhone: z.string().trim().min(7).max(50),
          guestCount: z.number().int().min(1).max(4),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const created = await createReservationHold(input);
          const checkout = await createReservationCheckoutSession({
            reservation: created.reservation,
            roomName: created.room.name,
            origin: requestOrigin(ctx.req),
            paymentKind: "deposit",
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
    settings: adminProcedure.query(() => getPublicSettings()),
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
      return { paused: true, taskUid } as const;
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
          channelConnectionStatus: z.enum(["not_connected", "pending", "connected", "error"]).optional(),
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
