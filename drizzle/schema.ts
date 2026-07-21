import {
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Manus OAuth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Individual guest rooms at Old Northside Bed & Breakfast. */
export const rooms = mysqlTable(
  "rooms",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 96 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    summary: text("summary").notNull(),
    bed: varchar("bed", { length: 120 }).notNull(),
    bath: varchar("bath", { length: 180 }).notNull(),
    hasFireplace: int("hasFireplace").notNull().default(0),
    weekdayRateCents: int("weekdayRateCents").notNull(),
    weekendRateCents: int("weekendRateCents").notNull(),
    imageUrl: varchar("imageUrl", { length: 500 }),
    sortOrder: int("sortOrder").notNull().default(0),
    isActive: int("isActive").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("rooms_slug_unique").on(table.slug), index("rooms_active_order_idx").on(table.isActive, table.sortOrder)],
);

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

/** Single-row owner controls for booking, payment, tax, and integration settings. */
export const bookingSettings = mysqlTable("booking_settings", {
  id: int("id").autoincrement().primaryKey(),
  depositNights: int("depositNights").notNull().default(1),
  paymentCollectionMode: mysqlEnum("paymentCollectionMode", ["first_night_deposit", "full_stay"])
    .notNull()
    .default("first_night_deposit"),
  balanceReminderDays: int("balanceReminderDays").notNull().default(7),
  stateTaxRateBasisPoints: int("stateTaxRateBasisPoints").notNull().default(700),
  countyTaxRateBasisPoints: int("countyTaxRateBasisPoints").notNull().default(300),
  shortTermTaxThresholdNights: int("shortTermTaxThresholdNights").notNull().default(30),
  channelProvider: varchar("channelProvider", { length: 96 }),
  channelConnectionStatus: mysqlEnum("channelConnectionStatus", ["not_connected", "pending", "connected", "error"])
    .notNull()
    .default("not_connected"),
  balanceReminderScheduleTaskUid: varchar("balanceReminderScheduleTaskUid", { length: 65 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BookingSettings = typeof bookingSettings.$inferSelect;

/**
 * Reservation totals are retained as the contractual quote snapshot, not a duplicate of Stripe data.
 * Stripe resource IDs are stored only to reconcile provider events with the booking record.
 */
export const reservations = mysqlTable(
  "reservations",
  {
    id: int("id").autoincrement().primaryKey(),
    bookingReference: varchar("bookingReference", { length: 32 }).notNull(),
    roomId: int("roomId").notNull(),
    guestName: varchar("guestName", { length: 180 }).notNull(),
    guestEmail: varchar("guestEmail", { length: 320 }).notNull(),
    guestPhone: varchar("guestPhone", { length: 50 }).notNull(),
    guestCount: int("guestCount").notNull().default(1),
    hasPet: int("hasPet").notNull().default(0),
    dogCount: int("dogCount").notNull().default(0),
    dogsUnder25Lbs: int("dogsUnder25Lbs").notNull().default(0),
    petPolicyAcknowledged: int("petPolicyAcknowledged").notNull().default(0),
    checkIn: date("checkIn", { mode: "string" }).notNull(),
    checkOut: date("checkOut", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["hold", "pending_deposit", "confirmed", "cancelled", "expired", "blocked"])
      .notNull()
      .default("hold"),
    source: mysqlEnum("source", ["direct", "channel", "owner"])
      .notNull()
      .default("direct"),
    nightlyRateCents: int("nightlyRateCents").notNull(),
    subtotalCents: int("subtotalCents").notNull(),
    stateTaxCents: int("stateTaxCents").notNull().default(0),
    countyTaxCents: int("countyTaxCents").notNull().default(0),
    totalCents: int("totalCents").notNull(),
    depositDueCents: int("depositDueCents").notNull(),
    balanceDueCents: int("balanceDueCents").notNull(),
    stripeDepositCheckoutSessionId: varchar("stripeDepositCheckoutSessionId", { length: 255 }),
    stripeDepositPaymentIntentId: varchar("stripeDepositPaymentIntentId", { length: 255 }),
    stripeBalanceCheckoutSessionId: varchar("stripeBalanceCheckoutSessionId", { length: 255 }),
    stripeBalancePaymentIntentId: varchar("stripeBalancePaymentIntentId", { length: 255 }),
    depositPaidAt: timestamp("depositPaidAt"),
    balancePaidAt: timestamp("balancePaidAt"),
    balanceReminderAt: timestamp("balanceReminderAt"),
    balanceReminderSentAt: timestamp("balanceReminderSentAt"),
    balanceReminderTaskUid: varchar("balanceReminderTaskUid", { length: 65 }),
    holdExpiresAt: timestamp("holdExpiresAt"),
    channelReservationId: varchar("channelReservationId", { length: 160 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("reservations_reference_unique").on(table.bookingReference),
    index("reservations_room_dates_idx").on(table.roomId, table.checkIn, table.checkOut),
    index("reservations_status_dates_idx").on(table.status, table.checkIn),
    index("reservations_balance_task_idx").on(table.balanceReminderTaskUid),
  ],
);

export type Reservation = typeof reservations.$inferSelect;

/** Owner-created dates that must not be shown as bookable. */
export const reservationBlocks = mysqlTable(
  "reservation_blocks",
  {
    id: int("id").autoincrement().primaryKey(),
    roomId: int("roomId").notNull(),
    checkIn: date("checkIn", { mode: "string" }).notNull(),
    checkOut: date("checkOut", { mode: "string" }).notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    createdByUserId: int("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("reservation_blocks_room_dates_idx").on(table.roomId, table.checkIn, table.checkOut)],
);

export type ReservationBlock = typeof reservationBlocks.$inferSelect;

/** Mapping metadata for a future authorized channel-manager connection. */
export const channelMappings = mysqlTable(
  "channel_mappings",
  {
    id: int("id").autoincrement().primaryKey(),
    roomId: int("roomId").notNull(),
    provider: varchar("provider", { length: 96 }).notNull(),
    externalRoomId: varchar("externalRoomId", { length: 160 }).notNull(),
    externalRatePlanId: varchar("externalRatePlanId", { length: 160 }),
    isEnabled: int("isEnabled").notNull().default(1),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("channel_mapping_unique").on(table.provider, table.roomId, table.externalRoomId)],
);

/**
 * Minimal channel-owned inventory blocks. These protect direct-booking availability without
 * duplicating channel guest, rate, or payment data.
 */
export const channelInventoryBlocks = mysqlTable(
  "channel_inventory_blocks",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 96 }).notNull(),
    externalReservationId: varchar("externalReservationId", { length: 160 }).notNull(),
    roomId: int("roomId").notNull(),
    checkIn: date("checkIn", { mode: "string" }).notNull(),
    checkOut: date("checkOut", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["active", "cancelled", "conflict"]).notNull().default("active"),
    originEventKey: varchar("originEventKey", { length: 255 }).notNull(),
    lastEventVersion: varchar("lastEventVersion", { length: 160 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("channel_inventory_block_unique").on(table.provider, table.externalReservationId),
    index("channel_inventory_block_room_dates_idx").on(table.roomId, table.checkIn, table.checkOut),
  ],
);

/** Idempotent audit events for inbound and outbound channel updates; no raw guest data is stored here. */
export const channelSyncEvents = mysqlTable(
  "channel_sync_events",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 96 }).notNull(),
    direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
    eventType: varchar("eventType", { length: 120 }).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
    reservationId: int("reservationId"),
    externalReservationId: varchar("externalReservationId", { length: 160 }),
    status: mysqlEnum("status", ["received", "processing", "processed", "retrying", "failed", "ignored"])
      .notNull()
      .default("received"),
    processingToken: varchar("processingToken", { length: 64 }),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
  },
  table => [
    uniqueIndex("channel_sync_event_key_unique").on(table.idempotencyKey),
    index("channel_sync_event_reservation_idx").on(table.reservationId, table.createdAt),
  ],
);

/** Delivery log used to prevent duplicate balance-payment reminders. */
export const bookingEmailEvents = mysqlTable(
  "booking_email_events",
  {
    id: int("id").autoincrement().primaryKey(),
    reservationId: int("reservationId").notNull(),
    kind: mysqlEnum("kind", ["booking_confirmation", "balance_reminder", "balance_receipt"])
      .notNull(),
    status: mysqlEnum("status", ["scheduled", "sending", "sent", "failed", "cancelled"])
      .notNull()
      .default("scheduled"),
    scheduledFor: timestamp("scheduledFor"),
    sentAt: timestamp("sentAt"),
    failedAt: timestamp("failedAt"),
    providerMessageId: varchar("providerMessageId", { length: 255 }),
    manualResendCount: int("manualResendCount").notNull().default(0),
    lastManualResendAt: timestamp("lastManualResendAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("booking_email_event_unique").on(table.reservationId, table.kind),
    index("booking_email_event_status_idx").on(table.status, table.scheduledFor),
  ],
);

export type BookingEmailEvent = typeof bookingEmailEvents.$inferSelect;
