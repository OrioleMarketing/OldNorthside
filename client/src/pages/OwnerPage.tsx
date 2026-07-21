import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardNavigationItem } from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { addDays, format, startOfToday } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, LockKeyhole, Mail, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ownerNavigation: DashboardNavigationItem[] = [
  { icon: CalendarDays, label: "Reservations", path: "/owner" },
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

  const range = useMemo(() => ({ checkIn: isoDate(anchorDate), checkOut: isoDate(addDays(anchorDate, 14)) }), [anchorDate]);
  const rooms = trpc.booking.rooms.useQuery(undefined, { enabled: isAdmin });
  const reservations = trpc.owner.reservations.useQuery(range, { enabled: isAdmin });
  const blocks = trpc.owner.blocks.useQuery(range, { enabled: isAdmin });
  const settings = trpc.owner.settings.useQuery(undefined, { enabled: isAdmin });
  const channelSyncReadiness = trpc.owner.channelSyncReadiness.useQuery(undefined, { enabled: isAdmin });
  const reminderSchedule = trpc.owner.reminderSchedule.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();
  const createBlock = trpc.owner.createBlock.useMutation({
    onSuccess: async () => {
      toast.success("Dates have been blocked on the inn calendar.");
      await utils.owner.blocks.invalidate();
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
  }, [blockRoomId, rooms.data]);

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
      <div><p className="eyebrow eyebrow--gold">Old Northside operations</p><h1 className="font-display">Reservation calendar</h1><p>See the next fourteen nights by room, protect inventory with owner blocks, and keep booking rules in one place.</p></div>
      <div className="owner-dashboard__controls"><button type="button" onClick={() => setAnchorDate(current => addDays(current, -14))} aria-label="Show prior fourteen days"><ChevronLeft size={18} /></button><span>{format(anchorDate, "MMM d")}–{format(addDays(anchorDate, 13), "MMM d, yyyy")}</span><button type="button" onClick={() => setAnchorDate(current => addDays(current, 14))} aria-label="Show next fourteen days"><ChevronRight size={18} /></button></div>
    </header>

    <section className="owner-calendar-card" aria-label="Fourteen-day room availability calendar">
      <div className="owner-calendar-grid owner-calendar-grid--header"><div className="owner-calendar-room-label">Room</div>{dates.map(day => <div key={isoDate(day)} className="owner-calendar-day"><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong></div>)}</div>
      {rooms.isLoading ? <p className="owner-calendar-loading">Loading the inn calendar…</p> : rooms.data?.map(room => <div className="owner-calendar-grid owner-calendar-grid--row" key={room.id}>
        <div className="owner-calendar-room-label"><strong>{room.name}</strong><small>${Math.round(room.weekdayRateCents / 100)} weekday</small></div>
        {dates.map(day => {
          const date = isoDate(day);
          const reservation = reservations.data?.find(item => item.reservation.roomId === room.id && dayFallsWithin(date, item.reservation.checkIn, item.reservation.checkOut));
          const block = blocks.data?.find(item => item.block.roomId === room.id && dayFallsWithin(date, item.block.checkIn, item.block.checkOut));
          const label = reservation ? (reservation.reservation.status === "confirmed" ? "Booked" : "Deposit hold") : block ? "Owner block" : "Available";
          const state = reservation ? (reservation.reservation.status === "confirmed" ? "booked" : "hold") : block ? "blocked" : "available";
          return <div className={`owner-calendar-cell owner-calendar-cell--${state}`} key={date} title={`${room.name}, ${format(day, "MMM d")}: ${label}`} aria-label={`${room.name}, ${format(day, "MMMM d")}: ${label}`}>{state === "available" ? "" : state === "booked" ? "●" : state === "hold" ? "◐" : "—"}</div>;
        })}
      </div>)}
      <div className="owner-calendar-legend"><span><i className="legend-dot legend-dot--available"/> Available</span><span><i className="legend-dot legend-dot--booked"/> Confirmed booking</span><span><i className="legend-dot legend-dot--hold"/> Deposit hold</span><span><i className="legend-dot legend-dot--blocked"/> Owner block</span></div>
    </section>

    <div className="owner-dashboard__lower-grid">
      <section className="owner-panel">
        <div className="owner-panel__heading"><span className="owner-panel__icon"><CalendarDays size={18}/></span><div><p className="eyebrow">Inventory protection</p><h2 className="font-display">Block room dates</h2></div></div>
        <form className="owner-form" onSubmit={event => { event.preventDefault(); if (!blockRoomId) return; createBlock.mutate({ roomId: blockRoomId, checkIn: blockCheckIn, checkOut: blockCheckOut, reason: blockReason }); }}>
          <label>Room<select value={blockRoomId ? String(blockRoomId) : "unselected"} onChange={event => setBlockRoomId(event.target.value === "unselected" ? null : Number(event.target.value))}><option value="unselected" disabled>Select a room</option>{rooms.data?.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <div className="owner-form__dates"><label>Check-in<input type="date" value={blockCheckIn} onChange={event => setBlockCheckIn(event.target.value)} required /></label><label>Check-out<input type="date" value={blockCheckOut} min={blockCheckIn} onChange={event => setBlockCheckOut(event.target.value)} required /></label></div>
          <label>Reason<input value={blockReason} onChange={event => setBlockReason(event.target.value)} maxLength={240} required /></label>
          <button className="owner-button" type="submit" disabled={createBlock.isPending || !blockRoomId}>{createBlock.isPending ? "Saving hold…" : "Block dates"}</button>
        </form>
      </section>

      <section className="owner-panel">
        <div className="owner-panel__heading"><span className="owner-panel__icon"><CircleDollarSign size={18}/></span><div><p className="eyebrow">Booking policy</p><h2 className="font-display">Payment & connection</h2></div></div>
        <form className="owner-form" onSubmit={event => { event.preventDefault(); updateSettings.mutate({ depositNights: Number(depositNights), paymentCollectionMode, balanceReminderDays: Number(reminderDays), channelProvider: channelProvider.trim() || null }); }}>
          <label>Payment due at booking<select value={paymentCollectionMode} onChange={event => setPaymentCollectionMode(event.target.value as "first_night_deposit" | "full_stay")}><option value="first_night_deposit">First night’s deposit</option><option value="full_stay">Full stay amount</option></select></label>
          <div className="owner-form__dates">{paymentCollectionMode === "first_night_deposit" ? <label>Deposit nights<input type="number" min="1" max="30" value={depositNights} onChange={event => setDepositNights(event.target.value)} required /></label> : <div className="owner-form__static-field"><span>Full stay collected</span><strong>Taxes included today</strong></div>}<label>Balance reminder<input type="number" min="1" max="30" value={reminderDays} onChange={event => setReminderDays(event.target.value)} required disabled={paymentCollectionMode === "full_stay"} /></label></div>
          <label>Channel-management provider<input value={channelProvider} onChange={event => setChannelProvider(event.target.value)} placeholder="To be connected" maxLength={96} /></label>
          <p className="owner-form__note"><Settings2 size={14}/> {paymentCollectionMode === "full_stay" ? "Guests will pay the full stay total, including applicable taxes, at booking." : "Guests pay the first night and its applicable taxes at booking; the remaining balance is requested before arrival."} Tax settings remain 7% state tax + 3% Marion County Innkeeper’s Tax for stays shorter than 30 nights.</p>
          <button className="owner-button" type="submit" disabled={updateSettings.isPending}>{updateSettings.isPending ? "Saving settings…" : "Save booking settings"}</button>
          <div className="owner-reminder-control">
            <div><p className="eyebrow"><Settings2 size={14}/> Channel synchronization</p><strong>{channelSyncReadiness.data?.ready ? "Mapped and ready for the authorized connector" : "Provider connection required"}</strong><span>{channelSyncReadiness.data?.provider ? `${channelSyncReadiness.data.mappedRooms} mapped room${channelSyncReadiness.data.mappedRooms === 1 ? "" : "s"}. Inventory will not be sent until an authorized connector verifies the connection.` : "Save the prospective channel-management provider here; listings and room mappings are connected in the provider activation step."}</span></div>
          </div>
          <div className="owner-reminder-control">
            <div><p className="eyebrow"><Mail size={14}/> Balance reminder delivery</p><strong>{reminderSchedule.data?.taskUid ? "Automated schedule active" : "Schedule not yet active"}</strong><span>Checks hourly for due seven-day balance reminders. Activate after publishing the site.</span></div>
            {reminderSchedule.data?.taskUid ? <button className="owner-button owner-button--quiet" type="button" onClick={() => pauseReminderSchedule.mutate()} disabled={pauseReminderSchedule.isPending}>{pauseReminderSchedule.isPending ? "Pausing…" : "Pause reminders"}</button> : <button className="owner-button owner-button--quiet" type="button" onClick={() => enableReminderSchedule.mutate()} disabled={enableReminderSchedule.isPending}>{enableReminderSchedule.isPending ? "Activating…" : "Activate reminders"}</button>}
          </div>
        </form>
      </section>
    </div>

    <section className="owner-panel owner-panel--reservations">
      <div className="owner-panel__heading"><span className="owner-panel__icon"><CircleDollarSign size={18}/></span><div><p className="eyebrow">Upcoming activity</p><h2 className="font-display">Reservations in view</h2></div></div>
      <div className="owner-reservations-list">{reservations.isLoading ? <p>Loading reservations…</p> : reservations.data?.length ? reservations.data.map(({ reservation, room }) => <article key={reservation.id}><div><strong>{room.name}</strong><span>{reservation.guestName} · {reservation.checkIn}–{reservation.checkOut}</span></div><div className="owner-reservation-charges"><span className={`reservation-status reservation-status--${reservation.status}`}>{reservation.status.replace("_", " ")}</span><span>Stay ${ (reservation.totalCents / 100).toFixed(2) }</span><span>State tax ${ (reservation.stateTaxCents / 100).toFixed(2) }</span><span>County tax ${ (reservation.countyTaxCents / 100).toFixed(2) }</span><strong>${(reservation.balanceDueCents / 100).toFixed(2)} due</strong>{reservation.status === "confirmed" && reservation.balanceDueCents > 0 && !reservation.balancePaidAt ? <button className="owner-resend-button" type="button" onClick={() => resendBalanceReminder.mutate({ reservationId: reservation.id })} disabled={resendBalanceReminder.isPending}>{resendBalanceReminder.isPending ? "Sending…" : "Send balance reminder"}</button> : null}</div></article>) : <p className="owner-empty">No reservations overlap this fourteen-day view.</p>}</div>
    </section>
  </div>;
}

export default function OwnerPage() {
  return <DashboardLayout navigationItems={ownerNavigation} navigationTitle="Old Northside"><OwnerCalendar /></DashboardLayout>;
}
