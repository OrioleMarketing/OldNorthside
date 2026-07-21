import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { CalendarDays, Check, CircleAlert, Loader2, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Link } from "wouter";

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
  const [calendarMonth, setCalendarMonth] = useState(today);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [hasPet, setHasPet] = useState(false);
  const [dogCount, setDogCount] = useState("1");
  const [dogsUnder25Lbs, setDogsUnder25Lbs] = useState(false);
  const [petPolicyAcknowledged, setPetPolicyAcknowledged] = useState(false);
  const [savePaymentMethodForBalance, setSavePaymentMethodForBalance] = useState(false);

  const checkIn = stay?.from ? toDateKey(stay.from) : "";
  const checkOut = stay?.to ? toDateKey(stay.to) : "";
  const queryInput = useMemo(
    () => ({ checkIn: checkIn || toDateKey(today), checkOut: checkOut || toDateKey(tomorrow) }),
    [checkIn, checkOut, today, tomorrow],
  );
  const canCheckAvailability = Boolean(checkIn && checkOut && checkOut > checkIn);
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

  const availableRooms = canCheckAvailability ? (availabilityQuery.data ?? []) : [];
  const selected = availableRooms.find(item => item.room.id === selectedRoomId) ?? null;

  useEffect(() => {
    if (selectedRoomId && !availableRooms.some(item => item.room.id === selectedRoomId)) {
      setSelectedRoomId(null);
    }
  }, [availableRooms, selectedRoomId]);

  function resetBooking() {
    setStay(undefined);
    setCalendarMonth(today);
    setSelectedRoomId(null);
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setGuestCount("1");
    setHasPet(false);
    setDogCount("1");
    setDogsUnder25Lbs(false);
    setPetPolicyAcknowledged(false);
    setSavePaymentMethodForBalance(false);
    toast.message("Your booking selection has been cleared. Start with your stay dates.");
  }

  function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !checkIn || !checkOut) {
      toast.error("Select dates and an available room before continuing.");
      return;
    }
    if (hasPet && !dogsUnder25Lbs) {
      toast.error("Each dog must weigh under 25 pounds to stay at the inn.");
      return;
    }
    if (hasPet && !petPolicyAcknowledged) {
      toast.error("Please review and acknowledge the Pet Policy before continuing.");
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
      hasPet,
      dogCount: hasPet ? Number(dogCount) : 0,
      dogsUnder25Lbs: hasPet && dogsUnder25Lbs,
      petPolicyAcknowledged: hasPet && petPolicyAcknowledged,
      savePaymentMethodForBalance,
    });
  }

  const depositNights = settings?.depositNights ?? 1;
  const paymentCollectionMode = settings?.paymentCollectionMode ?? "first_night_deposit";
  const reminderDays = settings?.balanceReminderDays ?? 7;
  const availabilityStatus = !canCheckAvailability
    ? "Select a check-in and a later check-out date to view live availability."
    : availabilityQuery.isLoading
      ? "Checking each room for your stay."
      : availabilityQuery.isError
        ? `Availability could not be loaded: ${availabilityQuery.error.message}`
        : availableRooms.length
          ? `${availableRooms.length} room${availableRooms.length === 1 ? " is" : "s are"} available for your selected stay.`
          : "No rooms are available for those dates. Try another stay or contact the inn for help.";

  return (
    <section className={compact ? "booking-panel booking-panel--compact" : "booking-panel"} aria-labelledby="availability-heading">
      <div className="booking-panel__intro">
        <div>
          <p className="eyebrow eyebrow--gold">Book direct</p>
          <h2 id="availability-heading" className="font-display text-3xl text-stone-950 sm:text-4xl">
            Find your room
          </h2>
        </div>
        <div className="booking-panel__actions">
          <p className="booking-panel__description">
            Choose your dates first. We will show only rooms that are available for your entire stay.
          </p>
          <Button type="button" variant="ghost" className="booking-reset" onClick={resetBooking} aria-label="Start over and clear your booking selections">
            <RotateCcw aria-hidden="true" size={15} /> Start over
          </Button>
        </div>
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
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            numberOfMonths={1}
            className="booking-calendar"
          />
          <div className="date-pills" aria-live="polite">
            <span><CalendarDays size={15} /> {dateLabel(stay?.from)}</span>
            <span><Check size={15} /> {dateLabel(stay?.to)}</span>
          </div>
        </div>

        <div className="booking-step booking-step--rooms" aria-busy={canCheckAvailability && availabilityQuery.isLoading}>
          <p className="sr-only" role="status">{availabilityStatus}</p>
          <div className="booking-step__number">02</div>
          <p className="booking-step__label">Available rooms</p>
          {!canCheckAvailability ? (
            <div className="booking-empty-state"><CalendarDays size={20} /><span>Select a check-in and a later check-out date to view live availability.</span></div>
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
                    aria-label={`${room.name}, ${money.format(quote.subtotalCents / 100)} for ${quote.nights} night${quote.nights === 1 ? "" : "s"}. ${isSelected ? "Selected" : "Select this room"}.`}
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
        <form className="booking-checkout" onSubmit={submitReservation} aria-busy={checkout.isPending}>
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

          <fieldset className="booking-pet-disclosure">
            <legend>Will a dog stay with you?</legend>
            <p>Dog stays are limited to a maximum of two dogs, with each dog under 25 pounds.</p>
            <div className="booking-pet-disclosure__choices">
              <label><input type="radio" name="has-pet" checked={!hasPet} onChange={() => { setHasPet(false); setDogsUnder25Lbs(false); setPetPolicyAcknowledged(false); }} /> No, we will not bring a dog</label>
              <label><input type="radio" name="has-pet" checked={hasPet} onChange={() => setHasPet(true)} /> Yes, we will bring a dog</label>
            </div>
            {hasPet ? <div className="booking-pet-disclosure__details">
              <label><span>Number of dogs</span><select value={dogCount} onChange={event => setDogCount(event.target.value)}><option value="1">1 dog</option><option value="2">2 dogs</option></select></label>
              <label className="booking-pet-confirmation"><input type="checkbox" checked={dogsUnder25Lbs} onChange={event => setDogsUnder25Lbs(event.target.checked)} required /><span>Each dog traveling with us is under 25 pounds.</span></label>
              <label className="booking-pet-confirmation booking-pet-confirmation--policy"><input type="checkbox" checked={petPolicyAcknowledged} onChange={event => setPetPolicyAcknowledged(event.target.checked)} required /><span>I have reviewed the <Link href="/pet-policy">Pet Policy</Link>. Our dog(s) will be housebroken, will not disturb other guests, will be covered if allowed on a bed, and will never be left at the inn unattended. I understand that a cleaning or repair fee may be assessed for carpet or furniture damage.</span></label>
            </div> : null}
          </fieldset>

          {paymentCollectionMode === "first_night_deposit" && selected.quote.balanceDueCents > 0 ? <label className="booking-pet-confirmation booking-payment-consent"><input type="checkbox" checked={savePaymentMethodForBalance} onChange={event => setSavePaymentMethodForBalance(event.target.checked)} /><span><strong>Optional: save this payment method for your remaining balance.</strong> By selecting this box, you authorize Old Northside Bed and Breakfast to securely store the payment method used for today’s deposit and charge the remaining <strong>{money.format(selected.quote.balanceDueCents / 100)}</strong> before your arrival. We will send a payment reminder first. You may decline and pay through a secure link instead.</span></label> : null}

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
            <p id="secure-payment-notice"><LockKeyhole size={15} /> Payment is securely processed by Stripe. Old Northside does not store card details.</p>
            <Button type="submit" className="inn-button inn-button--primary" disabled={checkout.isPending} aria-describedby="secure-payment-notice">
              {checkout.isPending ? <><Loader2 className="animate-spin" /> Preparing secure checkout…</> : <><LockKeyhole /> {paymentCollectionMode === "full_stay" ? "Continue to secure payment" : "Continue to secure deposit"}</>}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
