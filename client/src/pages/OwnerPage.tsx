import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardNavigationItem } from "@/components/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { addDays, format, startOfToday } from "date-fns";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, LockKeyhole, Mail, Phone, Settings2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ownerNavigation: DashboardNavigationItem[] = [
  { icon: CalendarDays, label: "Reservations", path: "/owner" },
  { icon: ShieldCheck, label: "Innkeeper access", path: "/owner/access" },
];

function isoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function dayFallsWithin(day: string, checkIn: string, checkOut: string) {
  return day >= checkIn && day < checkOut;
}

function OwnerCalendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [anchorDate, setAnchorDate] = useState(() => startOfToday());
  const [blockRoomId, setBlockRoomId] = useState<number | null>(null);
  const [blockCheckIn, setBlockCheckIn] = useState(() => isoDate(startOfToday()));
  const [blockCheckOut, setBlockCheckOut] = useState(() => isoDate(addDays(startOfToday(), 1)));
  const [blockReason, setBlockReason] = useState("Owner hold");
  const [depositNights, setDepositNights] = useState("1");
  const [paymentCollectionMode, setPaymentCollectionMode] = useState<"first_night_deposit" | "full_stay">("first_night_deposit");
  const [reminderDays, setReminderDays] = useState("7");
  const [channelProvider, setChannelProvider] = useState("");
  const [phoneRoomId, setPhoneRoomId] = useState<number | null>(null);
  const [phoneCheckIn, setPhoneCheckIn] = useState(() => isoDate(startOfToday()));
  const [phoneCheckOut, setPhoneCheckOut] = useState(() => isoDate(addDays(startOfToday(), 1)));
  const [phoneGuestName, setPhoneGuestName] = useState("");
  const [phoneGuestEmail, setPhoneGuestEmail] = useState("");
  const [phoneGuestPhone, setPhoneGuestPhone] = useState("");
  const [phoneGuestCount, setPhoneGuestCount] = useState("1");
  const [phoneDepositCollected, setPhoneDepositCollected] = useState(false);
  const [sendDepositPaymentLink, setSendDepositPaymentLink] = useState(true);
  const [pendingCancellation, setPendingCancellation] = useState<{ id: number; reference: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [pendingBlockCancellation, setPendingBlockCancellation] = useState<{ id: number; roomName: string; dates: string } | null>(null);
  const [blockCancellationReason, setBlockCancellationReason] = useState("");
  const [pendingCharge, setPendingCharge] = useState<{ id: number; reference: string; amountCents: number } | null>(null);

  const range = useMemo(() => ({ checkIn: isoDate(anchorDate), checkOut: isoDate(addDays(anchorDate, 14)) }), [anchorDate]);
  const activeBlockQuery = useMemo(() => ({}), []);
  const rooms = trpc.booking.rooms.useQuery(undefined, { enabled: isAdmin });
  const reservations = trpc.owner.reservations.useQuery(range, { enabled: isAdmin });
  const blocks = trpc.owner.blocks.useQuery(activeBlockQuery, { enabled: isAdmin });
  const settings = trpc.owner.settings.useQuery(undefined, { enabled: isAdmin });
  const channelSyncReadiness = trpc.owner.channelSyncReadiness.useQuery(undefined, { enabled: isAdmin });
  const reminderSchedule = trpc.owner.reminderSchedule.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();

  async function invalidateOperationalData() {
    await Promise.all([
      utils.owner.reservations.invalidate(),
      utils.owner.blocks.invalidate(),
      utils.booking.availability.invalidate(),
    ]);
  }

  const createBlock = trpc.owner.createBlock.useMutation({
    onSuccess: async () => {
      toast.success("Dates have been blocked on the inn calendar.");
      await invalidateOperationalData();
    },
    onError: error => toast.error(error.message),
  });
  const createPhoneReservation = trpc.owner.createPhoneReservation.useMutation({
    onSuccess: async result => {
      toast.success(result.paymentLinkSent ? "Reservation added and a secure deposit link was emailed." : "Reservation added to the inn calendar.");
      setPhoneGuestName("");
      setPhoneGuestEmail("");
      setPhoneGuestPhone("");
      setPhoneGuestCount("1");
      setPhoneDepositCollected(false);
      setSendDepositPaymentLink(true);
      await invalidateOperationalData();
    },
    onError: error => toast.error(error.message),
  });
  const cancelBlock = trpc.owner.cancelBlock.useMutation({
    onSuccess: async () => {
      toast.success("Room block removed and inventory released.");
      setPendingBlockCancellation(null);
      setBlockCancellationReason("");
      await invalidateOperationalData();
    },
    onError: error => toast.error(error.message),
  });
  const cancelReservation = trpc.owner.cancelReservation.useMutation({
    onSuccess: async () => {
      toast.success("Reservation cancelled and inventory released. Existing payments were not refunded automatically.");
      setPendingCancellation(null);
      setCancellationReason("");
      await invalidateOperationalData();
    },
    onError: error => toast.error(error.message),
  });
  const sendPaymentLink = trpc.owner.sendPaymentLink.useMutation({
    onSuccess: result => toast.success(`Secure ${result.paymentKind} payment link sent to the guest.`),
    onError: error => toast.error(error.message),
  });
  const chargeSavedBalance = trpc.owner.chargeSavedBalance.useMutation({
    onSuccess: async () => {
      toast.success("Authorized saved-card balance charge completed.");
      setPendingCharge(null);
      await invalidateOperationalData();
    },
    onError: error => toast.error(error.message),
  });
  const updateSettings = trpc.owner.updateSettings.useMutation({
    onSuccess: async () => {
      toast.success("Booking settings have been saved.");
      await utils.owner.settings.invalidate();
      await utils.booking.settings.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const enableReminderSchedule = trpc.owner.enableReminderSchedule.useMutation({
    onSuccess: async result => {
      toast.success(result.action === "created" ? "Balance-reminder schedule is active." : "Balance-reminder schedule has resumed.");
      await utils.owner.reminderSchedule.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const pauseReminderSchedule = trpc.owner.pauseReminderSchedule.useMutation({
    onSuccess: async result => {
      toast.success(result.paused ? "Balance-reminder schedule is paused." : "No active balance-reminder schedule was found.");
      await utils.owner.reminderSchedule.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const resendBalanceReminder = trpc.owner.resendBalanceReminder.useMutation({
    onSuccess: result => toast.success(result.result === "sent" ? "Balance reminder sent to the guest." : "A balance reminder is already being delivered."),
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!blockRoomId && rooms.data?.[0]) setBlockRoomId(rooms.data[0].id);
    if (!phoneRoomId && rooms.data?.[0]) setPhoneRoomId(rooms.data[0].id);
  }, [blockRoomId, phoneRoomId, rooms.data]);

  useEffect(() => {
    if (!settings.data) return;
    setDepositNights(String(settings.data.depositNights));
    setPaymentCollectionMode(settings.data.paymentCollectionMode);
    setReminderDays(String(settings.data.balanceReminderDays));
    setChannelProvider(settings.data.channelProvider ?? "");
  }, [settings.data]);

  const dates = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(anchorDate, index)), [anchorDate]);

  if (!isAdmin) {
    return <div className="owner-access"><LockKeyhole size={28} /><h1 className="font-display">Innkeeper access only</h1><p>Sign in with the Old Northside owner account to manage reservations, holds, policies, and payments.</p></div>;
  }

  return <div className="owner-dashboard">
    <header className="owner-dashboard__header">
      <div><p className="eyebrow eyebrow--gold">Old Northside operations</p><h1 className="font-display">Reservation calendar</h1><p>See the next fourteen nights by room, add phone reservations, protect inventory with owner blocks, and keep booking rules in one place.</p></div>
      <div className="owner-dashboard__controls"><button type="button" onClick={() => setAnchorDate(current => addDays(current, -14))} aria-label="Show prior fourteen days"><ChevronLeft size={18} /></button><span>{format(anchorDate, "MMM d")}–{format(addDays(anchorDate, 13), "MMM d, yyyy")}</span><button type="button" onClick={() => setAnchorDate(current => addDays(current, 14))} aria-label="Show next fourteen days"><ChevronRight size={18} /></button></div>
    </header>

    <section className="owner-calendar-card" aria-label="Fourteen-day room availability calendar">
      <div className="owner-calendar-grid owner-calendar-grid--header"><div className="owner-calendar-room-label">Room</div>{dates.map(day => <div key={isoDate(day)} className="owner-calendar-day"><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong></div>)}</div>
      {rooms.isLoading ? <p className="owner-calendar-loading">Loading the inn calendar…</p> : rooms.data?.map(room => <div className="owner-calendar-grid owner-calendar-grid--row" key={room.id}>
        <div className="owner-calendar-room-label"><strong>{room.name}</strong><small>${Math.round(room.weekdayRateCents / 100)} weekday</small></div>
        {dates.map(day => {
          const date = isoDate(day);
          const reservation = reservations.data?.find(item => item.reservation.status !== "cancelled" && item.reservation.status !== "expired" && item.reservation.roomId === room.id && dayFallsWithin(date, item.reservation.checkIn, item.reservation.checkOut));
          const block = blocks.data?.find(item => item.block.roomId === room.id && dayFallsWithin(date, item.block.checkIn, item.block.checkOut));
          const label = reservation ? (reservation.reservation.status === "confirmed" ? "Booked" : "Deposit hold") : block ? "Owner block" : "Available";
          const state = reservation ? (reservation.reservation.status === "confirmed" ? "booked" : "hold") : block ? "blocked" : "available";
          return <div className={`owner-calendar-cell owner-calendar-cell--${state}`} key={date} title={`${room.name}, ${format(day, "MMM d")}: ${label}`} aria-label={`${room.name}, ${format(day, "MMMM d")}: ${label}`}>{state === "available" ? "" : state === "booked" ? "●" : state === "hold" ? "◐" : "—"}</div>;
        })}
      </div>)}
      <div className="owner-calendar-legend"><span><i className="legend-dot legend-dot--available" /> Available</span><span><i className="legend-dot legend-dot--booked" /> Confirmed booking</span><span><i className="legend-dot legend-dot--hold" /> Deposit hold</span><span><i className="legend-dot legend-dot--blocked" /> Owner block</span></div>
    </section>

    <div className="owner-dashboard__lower-grid">
      <section className="owner-panel">
        <div className="owner-panel__heading"><span className="owner-panel__icon"><CalendarPlus size={18} /></span><div><p className="eyebrow">Phone & walk-in bookings</p><h2 className="font-display">Add a reservation</h2></div></div>
        <form className="owner-form" onSubmit={event => {
          event.preventDefault();
          if (!phoneRoomId) return;
          createPhoneReservation.mutate({
            roomId: phoneRoomId,
            checkIn: phoneCheckIn,
            checkOut: phoneCheckOut,
            guestName: phoneGuestName,
            guestEmail: phoneGuestEmail,
            guestPhone: phoneGuestPhone,
            guestCount: Number(phoneGuestCount),
            markDepositCollected: phoneDepositCollected,
            sendDepositPaymentLink: !phoneDepositCollected && sendDepositPaymentLink,
          });
        }}>
          <label>Room<select value={phoneRoomId ? String(phoneRoomId) : "unselected"} onChange={event => setPhoneRoomId(event.target.value === "unselected" ? null : Number(event.target.value))}><option value="unselected" disabled>Select a room</option>{rooms.data?.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <div className="owner-form__dates"><label>Check-in<input type="date" value={phoneCheckIn} onChange={event => setPhoneCheckIn(event.target.value)} required /></label><label>Check-out<input type="date" value={phoneCheckOut} min={phoneCheckIn} onChange={event => setPhoneCheckOut(event.target.value)} required /></label></div>
          <label>Guest name<input value={phoneGuestName} onChange={event => setPhoneGuestName(event.target.value)} maxLength={180} required /></label>
          <label>Guest email<input type="email" value={phoneGuestEmail} onChange={event => setPhoneGuestEmail(event.target.value)} maxLength={320} required /></label>
          <div className="owner-form__dates"><label>Phone<input type="tel" value={phoneGuestPhone} onChange={event => setPhoneGuestPhone(event.target.value)} minLength={7} maxLength={50} required /></label><label>Guests<select value={phoneGuestCount} onChange={event => setPhoneGuestCount(event.target.value)}><option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option></select></label></div>
          <label className="owner-checkbox"><input type="checkbox" checked={phoneDepositCollected} onChange={event => setPhoneDepositCollected(event.target.checked)} /><span>Deposit was collected offline. I will not use this to imply a card charge occurred through this site.</span></label>
          {!phoneDepositCollected ? <label className="owner-checkbox"><input type="checkbox" checked={sendDepositPaymentLink} onChange={event => setSendDepositPaymentLink(event.target.checked)} /><span>Email the guest a secure Stripe deposit link now.</span></label> : null}
          <button className="owner-button" type="submit" disabled={createPhoneReservation.isPending || !phoneRoomId}>{createPhoneReservation.isPending ? "Adding reservation…" : "Add reservation"}</button>
        </form>
      </section>

      <section className="owner-panel">
        <div className="owner-panel__heading"><span className="owner-panel__icon"><CalendarDays size={18} /></span><div><p className="eyebrow">Inventory protection</p><h2 className="font-display">Block room dates</h2></div></div>
        <form className="owner-form" onSubmit={event => { event.preventDefault(); if (!blockRoomId) return; createBlock.mutate({ roomId: blockRoomId, checkIn: blockCheckIn, checkOut: blockCheckOut, reason: blockReason }); }}>
          <label>Room<select value={blockRoomId ? String(blockRoomId) : "unselected"} onChange={event => setBlockRoomId(event.target.value === "unselected" ? null : Number(event.target.value))}><option value="unselected" disabled>Select a room</option>{rooms.data?.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <div className="owner-form__dates"><label>Check-in<input type="date" value={blockCheckIn} onChange={event => setBlockCheckIn(event.target.value)} required /></label><label>Check-out<input type="date" value={blockCheckOut} min={blockCheckIn} onChange={event => setBlockCheckOut(event.target.value)} required /></label></div>
          <label>Reason<input value={blockReason} onChange={event => setBlockReason(event.target.value)} maxLength={240} required /></label>
          <button className="owner-button" type="submit" disabled={createBlock.isPending || !blockRoomId}>{createBlock.isPending ? "Saving hold…" : "Block dates"}</button>
        </form>
        <div className="owner-active-blocks" aria-live="polite">
          <h3>Active room blocks</h3>
          {blocks.isLoading ? <p>Loading active room blocks…</p> : blocks.data?.length ? <div className="owner-active-blocks__list">{blocks.data.map(({ block, room }) => <article key={block.id} className="owner-active-block"><div><strong>{room.name}</strong><span>{block.checkIn}–{block.checkOut}</span><small>{block.reason}</small></div><button className="owner-cancel-button" type="button" onClick={() => { setPendingBlockCancellation({ id: block.id, roomName: room.name, dates: `${block.checkIn}–${block.checkOut}` }); setBlockCancellationReason(""); }} disabled={cancelBlock.isPending}><XCircle size={14} /> Unblock room</button></article>)}</div> : <p className="owner-empty">No active owner blocks are currently in place.</p>}
        </div>
      </section>

      <section className="owner-panel">
        <div className="owner-panel__heading"><span className="owner-panel__icon"><CircleDollarSign size={18} /></span><div><p className="eyebrow">Booking policy</p><h2 className="font-display">Payment & connection</h2></div></div>
        <form className="owner-form" onSubmit={event => { event.preventDefault(); updateSettings.mutate({ depositNights: Number(depositNights), paymentCollectionMode, balanceReminderDays: Number(reminderDays), channelProvider: channelProvider.trim() || null }); }}>
          <label>Payment due at booking<select value={paymentCollectionMode} onChange={event => setPaymentCollectionMode(event.target.value as "first_night_deposit" | "full_stay")}><option value="first_night_deposit">First night’s deposit</option><option value="full_stay">Full stay amount</option></select></label>
          <div className="owner-form__dates">{paymentCollectionMode === "first_night_deposit" ? <label>Deposit nights<input type="number" min="1" max="30" value={depositNights} onChange={event => setDepositNights(event.target.value)} required /></label> : <div className="owner-form__static-field"><span>Full stay collected</span><strong>Taxes included today</strong></div>}<label>Balance reminder<input type="number" min="1" max="30" value={reminderDays} onChange={event => setReminderDays(event.target.value)} required disabled={paymentCollectionMode === "full_stay"} /></label></div>
          <label>Channel-management provider<input value={channelProvider} onChange={event => setChannelProvider(event.target.value)} placeholder="To be connected" maxLength={96} /></label>
          <p className="owner-form__note"><Settings2 size={14} /> {paymentCollectionMode === "full_stay" ? "Guests will pay the full stay total, including applicable taxes, at booking." : "Guests pay the first night and its applicable taxes at booking; the remaining balance is requested before arrival."} Tax settings remain 7% state tax + 3% Marion County Innkeeper’s Tax for stays shorter than 30 nights.</p>
          <button className="owner-button" type="submit" disabled={updateSettings.isPending}>{updateSettings.isPending ? "Saving settings…" : "Save booking settings"}</button>
          <div className="owner-reminder-control">
            <div><p className="eyebrow"><Settings2 size={14} /> Channel synchronization</p><strong>{channelSyncReadiness.data?.ready ? "Mapped and ready for the authorized connector" : "Provider connection required"}</strong><span>{channelSyncReadiness.data?.provider ? `${channelSyncReadiness.data.mappedRooms} mapped room${channelSyncReadiness.data.mappedRooms === 1 ? "" : "s"}. Inventory will not be sent until an authorized connector verifies the connection.` : "Save the prospective channel-management provider here; listings and room mappings are connected in the provider activation step."}</span></div>
          </div>
          <div className="owner-reminder-control">
            <div><p className="eyebrow"><Mail size={14} /> Balance reminder delivery</p><strong>{reminderSchedule.data?.taskUid ? "Automated schedule active" : "Schedule not yet active"}</strong><span>Checks hourly for due seven-day balance reminders. Activate after publishing the site.</span></div>
            {reminderSchedule.data?.taskUid ? <button className="owner-button owner-button--quiet" type="button" onClick={() => pauseReminderSchedule.mutate()} disabled={pauseReminderSchedule.isPending}>{pauseReminderSchedule.isPending ? "Pausing…" : "Pause reminders"}</button> : <button className="owner-button owner-button--quiet" type="button" onClick={() => enableReminderSchedule.mutate()} disabled={enableReminderSchedule.isPending}>{enableReminderSchedule.isPending ? "Activating…" : "Activate reminders"}</button>}
          </div>
        </form>
      </section>
    </div>

    <section className="owner-panel owner-panel--reservations">
      <div className="owner-panel__heading"><span className="owner-panel__icon"><CircleDollarSign size={18} /></span><div><p className="eyebrow">Upcoming activity</p><h2 className="font-display">Reservations in view</h2></div></div>
      <div className="owner-reservations-list">{reservations.isLoading ? <p>Loading reservations…</p> : reservations.data?.length ? reservations.data.map(({ reservation, room }) => {
        const active = reservation.status !== "cancelled" && reservation.status !== "expired";
        const hasUnpaidBalance = reservation.status === "confirmed" && reservation.balanceDueCents > 0 && !reservation.balancePaidAt;
        const canChargeSavedCard = hasUnpaidBalance && Boolean(reservation.stripeCustomerId && reservation.stripePaymentMethodId && reservation.paymentMethodConsentAt);
        return <article key={reservation.id} className={active ? undefined : "owner-reservation--inactive"}>
          <div><strong>{room.name}</strong><span>{reservation.guestName} · {reservation.checkIn}–{reservation.checkOut}</span><small>{reservation.source === "owner" ? <><Phone size={12} /> Owner-added reservation</> : "Website reservation"}</small></div>
          <div className="owner-reservation-charges"><span className={`reservation-status reservation-status--${reservation.status}`}>{reservation.status.replace("_", " ")}</span><span>Stay ${(reservation.totalCents / 100).toFixed(2)}</span><span>State tax ${(reservation.stateTaxCents / 100).toFixed(2)}</span><span>County tax ${(reservation.countyTaxCents / 100).toFixed(2)}</span><strong>{reservation.balancePaidAt ? "Balance paid" : `$${(reservation.balanceDueCents / 100).toFixed(2)} due`}</strong>
            {active && reservation.status === "confirmed" && hasUnpaidBalance ? <button className="owner-resend-button" type="button" onClick={() => resendBalanceReminder.mutate({ reservationId: reservation.id })} disabled={resendBalanceReminder.isPending}>Send balance reminder</button> : null}
            {active && (reservation.status === "pending_deposit" || hasUnpaidBalance) ? <button className="owner-resend-button" type="button" onClick={() => sendPaymentLink.mutate({ reservationId: reservation.id })} disabled={sendPaymentLink.isPending}><Mail size={14} /> Send secure payment link</button> : null}
            {active && canChargeSavedCard ? <button className="owner-resend-button" type="button" onClick={() => setPendingCharge({ id: reservation.id, reference: reservation.bookingReference, amountCents: reservation.balanceDueCents })} disabled={chargeSavedBalance.isPending}><CreditCard size={14} /> Charge authorized card</button> : null}
            {active ? <button className="owner-cancel-button" type="button" onClick={() => { setPendingCancellation({ id: reservation.id, reference: reservation.bookingReference }); setCancellationReason(""); }} disabled={cancelReservation.isPending}><XCircle size={14} /> Cancel reservation</button> : null}
          </div>
        </article>;
      }) : <p className="owner-empty">No reservations overlap this fourteen-day view.</p>}</div>
    </section>

    <AlertDialog open={Boolean(pendingCancellation)} onOpenChange={open => { if (!open) { setPendingCancellation(null); setCancellationReason(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Cancel reservation {pendingCancellation?.reference}?</AlertDialogTitle><AlertDialogDescription>This immediately releases the room inventory and cancels unsent payment reminders. It does not automatically refund a payment already collected.</AlertDialogDescription></AlertDialogHeader>
        <label className="owner-dialog-label">Cancellation reason<textarea value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} maxLength={240} placeholder="Reason shown in the staff audit trail" /></label>
        <AlertDialogFooter><AlertDialogCancel>Keep reservation</AlertDialogCancel><AlertDialogAction className="bg-red-800 hover:bg-red-900" disabled={!pendingCancellation || cancellationReason.trim().length < 2 || cancelReservation.isPending} onClick={() => pendingCancellation && cancelReservation.mutate({ reservationId: pendingCancellation.id, reason: cancellationReason.trim() })}>{cancelReservation.isPending ? "Cancelling…" : "Cancel reservation"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={Boolean(pendingBlockCancellation)} onOpenChange={open => { if (!open) { setPendingBlockCancellation(null); setBlockCancellationReason(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Unblock {pendingBlockCancellation?.roomName}?</AlertDialogTitle><AlertDialogDescription>This will immediately make {pendingBlockCancellation?.dates} available for new reservations, unless another reservation or channel block applies.</AlertDialogDescription></AlertDialogHeader>
        <label className="owner-dialog-label">Reason for unblocking<textarea value={blockCancellationReason} onChange={event => setBlockCancellationReason(event.target.value)} maxLength={240} placeholder="Reason shown in the staff audit trail" /></label>
        <AlertDialogFooter><AlertDialogCancel>Keep room blocked</AlertDialogCancel><AlertDialogAction className="bg-red-800 hover:bg-red-900" disabled={!pendingBlockCancellation || blockCancellationReason.trim().length < 2 || cancelBlock.isPending} onClick={() => pendingBlockCancellation && cancelBlock.mutate({ reservationBlockId: pendingBlockCancellation.id, reason: blockCancellationReason.trim() })}>{cancelBlock.isPending ? "Unblocking…" : "Unblock room"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={Boolean(pendingCharge)} onOpenChange={open => { if (!open) setPendingCharge(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Charge the authorized saved card?</AlertDialogTitle><AlertDialogDescription>This will attempt a one-time off-session charge of {pendingCharge ? `$${(pendingCharge.amountCents / 100).toFixed(2)}` : "the remaining balance"} for reservation {pendingCharge?.reference}. Continue only because the guest explicitly opted in at deposit checkout. If it cannot be completed, use the secure payment-link button instead.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Use payment link instead</AlertDialogCancel><AlertDialogAction disabled={!pendingCharge || chargeSavedBalance.isPending} onClick={() => pendingCharge && chargeSavedBalance.mutate({ reservationId: pendingCharge.id })}>{chargeSavedBalance.isPending ? "Charging…" : "Charge authorized card"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

export default function OwnerPage() {
  return <DashboardLayout navigationItems={ownerNavigation} navigationTitle="Old Northside"><OwnerCalendar /></DashboardLayout>;
}
