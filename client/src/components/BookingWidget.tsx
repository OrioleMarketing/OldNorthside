import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { CalendarDays, Check, CircleAlert, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

type BookingWidgetProps = {
  compact?: boolean;
  onBooked?: () => void;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateLabel(date?: Date) {
  return date ? format(date, "EEE, MMM d") : "Choose a date";
}

export default function BookingWidget({ compact = false, onBooked }: BookingWidgetProps) {
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const tomorrow = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return date;
  }, [today]);
  const [stay, setStay] = useState<DateRange | undefined>();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCount, setGuestCount] = useState("1");

  const checkIn = stay?.from ? toDateKey(stay.from) : "";
  const checkOut = stay?.to ? toDateKey(stay.to) : "";
  const queryInput = useMemo(
    () => ({ checkIn: checkIn || toDateKey(today), checkOut: checkOut || toDateKey(tomorrow) }),
    [checkIn, checkOut, today, tomorrow],
  );
  const canCheckAvailability = Boolean(checkIn && checkOut);
  const { data: settings } = trpc.booking.settings.useQuery();
  const availabilityQuery = trpc.booking.availability.useQuery(queryInput, { enabled: canCheckAvailability });
  const checkout = trpc.booking.createDepositCheckout.useMutation({
    onSuccess: result => {
      toast.success(`Your ${result.bookingReference} hold is ready for secure payment.`);
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      onBooked?.();
    },
    onError: error => toast.error(error.message),
  });

  const availableRooms = availabilityQuery.data ?? [];
  const selected = availableRooms.find(item => item.room.id === selectedRoomId) ?? null;

  useEffect(() => {
    if (selectedRoomId && !availableRooms.some(item => item.room.id === selectedRoomId)) {
      setSelectedRoomId(null);
    }
  }, [availableRooms, selectedRoomId]);

  function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !checkIn || !checkOut) {
      toast.error("Select dates and an available room before continuing.");
      return;
    }
    checkout.mutate({
      roomId: selected.room.id,
      checkIn,
      checkOut,
      guestName,
      guestEmail,
      guestPhone,
      guestCount: Number(guestCount),
    });
  }

  const depositNights = settings?.depositNights ?? 1;
  const paymentCollectionMode = settings?.paymentCollectionMode ?? "first_night_deposit";
  const reminderDays = settings?.balanceReminderDays ?? 7;

  return (
    <section className={compact ? "booking-panel booking-panel--compact" : "booking-panel"} aria-labelledby="availability-heading">
      <div className="booking-panel__intro">
        <div>
          <p className="eyebrow eyebrow--gold">Book direct</p>
          <h2 id="availability-heading" className="font-display text-3xl text-stone-950 sm:text-4xl">
            Find your room
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-stone-600">
          Choose your dates first. We will show only rooms that are available for your entire stay.
        </p>
      </div>

      <div className="booking-step-grid">
        <div className="booking-step">
          <div className="booking-step__number">01</div>
          <p className="booking-step__label">Stay dates</p>
          <Calendar
            mode="range"
            selected={stay}
            onSelect={setStay}
            disabled={{ before: today }}
            numberOfMonths={compact ? 1 : 2}
            defaultMonth={today}
            className="booking-calendar"
          />
          <div className="date-pills" aria-live="polite">
            <span><CalendarDays size={15} /> {dateLabel(stay?.from)}</span>
            <span><Check size={15} /> {dateLabel(stay?.to)}</span>
          </div>
        </div>

        <div className="booking-step booking-step--rooms">
          <div className="booking-step__number">02</div>
          <p className="booking-step__label">Available rooms</p>
          {!canCheckAvailability ? (
            <div className="booking-empty-state"><CalendarDays size={20} /><span>Select a check-in and check-out date to view live availability.</span></div>
          ) : availabilityQuery.isLoading ? (
            <div className="booking-empty-state"><Loader2 className="animate-spin" size={20} /><span>Checking each room for your stay…</span></div>
          ) : availabilityQuery.isError ? (
            <div className="booking-empty-state booking-empty-state--error"><CircleAlert size={20} /><span>{availabilityQuery.error.message}</span></div>
          ) : availableRooms.length ? (
            <div className="available-room-list">
              {availableRooms.map(({ room, quote }) => {
                const isSelected = selectedRoomId === room.id;
                return (
                  <button
                    type="button"
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`available-room ${isSelected ? "available-room--selected" : ""}`}
                    aria-pressed={isSelected}
                  >
                    <span className="available-room__image" style={{ backgroundImage: room.imageUrl ? `url(${room.imageUrl})` : undefined }} />
                    <span className="available-room__body">
                      <span className="available-room__name">{room.name}</span>
                      <span className="available-room__details">{room.bed} · Private {room.bath.toLowerCase()}</span>
                    </span>
                    <span className="available-room__price">{money.format(quote.subtotalCents / 100)}<small>stay</small></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="booking-empty-state"><Sparkles size={20} /><span>No rooms are available for those dates. Try another stay or contact the inn for help.</span></div>
          )}
        </div>
      </div>

      {selected ? (
        <form className="booking-checkout" onSubmit={submitReservation}>
          <div className="booking-checkout__heading">
            <div>
              <div className="booking-step__number">03</div>
              <p className="booking-step__label">Reserve {selected.room.name}</p>
            </div>
            <div className="booking-total">
              <span>{paymentCollectionMode === "full_stay" ? "Full stay due today" : "Deposit due today"}</span>
              <strong>{money.format(selected.quote.depositDueCents / 100)}</strong>
            </div>
          </div>

          <div className="guest-fields">
            <label><span>Full name</span><Input required value={guestName} onChange={event => setGuestName(event.target.value)} placeholder="Your full name" /></label>
            <label><span>Email address</span><Input required type="email" value={guestEmail} onChange={event => setGuestEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label><span>Mobile number</span><Input required type="tel" value={guestPhone} onChange={event => setGuestPhone(event.target.value)} placeholder="(317) 555-0123" /></label>
            <label><span>Guests</span><select value={guestCount} onChange={event => setGuestCount(event.target.value)}><option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option></select></label>
          </div>

          <div className="quote-card" aria-live="polite">
            <div><span>{selected.quote.nights} night{selected.quote.nights === 1 ? "" : "s"} · room subtotal</span><strong>{money.format(selected.quote.subtotalCents / 100)}</strong></div>
            {selected.quote.isShortTermTaxable ? <>
              <div><span>Indiana state tax (7%)</span><strong>{money.format(selected.quote.stateTaxCents / 100)}</strong></div>
              <div><span>Marion County Innkeeper’s Tax (3%)</span><strong>{money.format(selected.quote.countyTaxCents / 100)}</strong></div>
            </> : <div><span>Long-stay lodging tax treatment</span><strong>Taxes not applied</strong></div>}
            <div className="quote-card__total"><span>Total stay</span><strong>{money.format(selected.quote.totalCents / 100)}</strong></div>
            <p>
              {paymentCollectionMode === "full_stay"
                ? <>The full stay amount of {money.format(selected.quote.depositDueCents / 100)}, including applicable taxes, is due today. There is no remaining balance.</>
                : <>Today’s {depositNights === 1 ? "first-night" : `${depositNights}-night`} deposit is {money.format(selected.quote.depositDueCents / 100)}. The remaining {money.format(selected.quote.balanceDueCents / 100)} will be requested {reminderDays} days before arrival.</>}
            </p>
          </div>

          <div className="booking-checkout__actions">
            <p><LockKeyhole size={15} /> Payment is securely processed by Stripe. Old Northside does not store card details.</p>
            <Button type="submit" className="inn-button inn-button--primary" disabled={checkout.isPending}>
              {checkout.isPending ? <><Loader2 className="animate-spin" /> Preparing secure checkout…</> : <><LockKeyhole /> {paymentCollectionMode === "full_stay" ? "Continue to secure payment" : "Continue to secure deposit"}</>}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
