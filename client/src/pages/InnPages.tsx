import BookingWidget from "@/components/BookingWidget";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Bath, BedDouble, CalendarCheck2, CheckCircle2, Clock3, Coffee, Flame, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const ROOM_IMAGES: Record<string, string> = {
  "the-bridal-room": "/manus-storage/library-suite_b24b3222.jpg",
  "the-tiffany-room": "/manus-storage/tiffany-room_0dbdd78d.jpg",
  "the-literary-room": "/manus-storage/literary-room_69da343c.jpg",
  "the-dewenter-room": "/manus-storage/dewenter-room_a9fea36d.jpg",
  "the-hollywood-room": "/manus-storage/hollywood-room_74a677e5.jpg",
  "the-rose-garden-room": "/manus-storage/rose-garden-room_b1faa21a.jpg",
  "the-library-wedding-suite": "/manus-storage/library-suite_b24b3222.jpg",
};

function PageHero({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <section className="page-hero"><div className="container"><p className="eyebrow eyebrow--gold">{eyebrow}</p><h1 className="font-display">{title}</h1><p>{copy}</p></div></section>;
}

export function RoomsPage() {
  const roomsQuery = trpc.booking.rooms.useQuery();
  const rooms = roomsQuery.data ?? [];
  return <main>
    <PageHero eyebrow="Seven private-bath accommodations" title="Distinct rooms. One unforgettable house." copy="Each room has its own character, period details, and private bath. Select dates to see live availability before reserving." />
    <section className="section section--paper"><div className="container rooms-list">
      {roomsQuery.isLoading ? <p className="room-loading">Gathering the rooms…</p> : rooms.map((room, index) => <article className={`room-feature ${index % 2 ? "room-feature--reverse" : ""}`} key={room.id}>
        <img src={ROOM_IMAGES[room.slug] ?? room.imageUrl ?? "/manus-storage/exterior_3b0e8c31.jpg"} alt={room.name} />
        <div className="room-feature__copy"><p className="eyebrow eyebrow--gold">From ${Math.round(room.weekdayRateCents / 100)} weekday · ${Math.round(room.weekendRateCents / 100)} weekend</p><h2 className="font-display">{room.name}</h2><p>{room.summary}</p><div className="room-feature__details"><span><BedDouble size={17} /> {room.bed}</span><span><Bath size={17} /> Private {room.bath.toLowerCase()}</span>{room.hasFireplace ? <span><Flame size={17} /> Fireplace</span> : null}</div><Link href="/booking" className="inn-button inn-button--dark">Check this room’s dates <ArrowRight size={17} /></Link></div>
      </article>)}
    </div></section>
  </main>;
}

export function BookingPage() {
  const settings = trpc.booking.settings.useQuery();
  const isFullStay = settings.data?.paymentCollectionMode === "full_stay";
  const paymentCopy = isFullStay
    ? "Choose dates, select an available room, and complete the full stay payment through secure checkout. We show the stay total and taxes before you pay."
    : "Choose dates, select an available room, and complete the first-night deposit through secure checkout. We show the stay total and taxes before you pay.";
  const paymentPlanCopy = isFullStay
    ? "The full stay, including applicable taxes, is collected through secure checkout."
    : "A first-night deposit secures your stay; the balance is requested seven days before arrival.";
  return <main><PageHero eyebrow="Direct booking" title="Your room, confirmed in three clear steps." copy={paymentCopy} /><section className="section section--paper"><div className="container"><BookingWidget /></div></section><section className="section policy-strip"><div className="container policy-strip__grid"><div><ShieldCheck size={23}/><p><strong>Secure payment</strong><br/>Card details are processed by Stripe, not stored by the inn.</p></div><div><CalendarCheck2 size={23}/><p><strong>Live availability</strong><br/>Rooms shown are available for the entire selected stay.</p></div><div><Clock3 size={23}/><p><strong>Simple payment plan</strong><br/>{paymentPlanCopy}</p></div></div></section></main>;
}

export function BalancePaymentPage() {
  const initialReference = useMemo(() => new URLSearchParams(window.location.search).get("reference")?.toUpperCase() ?? "", []);
  const [bookingReference, setBookingReference] = useState(initialReference);
  const [guestEmail, setGuestEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const lookupInput = useMemo(() => ({ bookingReference: bookingReference.trim().toUpperCase(), guestEmail: guestEmail.trim().toLowerCase() }), [bookingReference, guestEmail]);
  const canLookup = lookupInput.bookingReference.length >= 8 && /^\S+@\S+\.\S+$/.test(lookupInput.guestEmail);
  const lookup = trpc.booking.lookup.useQuery(lookupInput, { enabled: submitted && canLookup, retry: false });
  const checkout = trpc.booking.createBalanceCheckout.useMutation({
    onSuccess: result => {
      toast.success("Secure payment opens in a new tab.");
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
    },
    onError: error => toast.error(error.message),
  });
  const reservation = lookup.data?.reservation;
  const room = lookup.data?.room;

  return <main>
    <PageHero eyebrow="Existing reservation" title="Settle your remaining balance." copy="For your security, enter the booking reference and email address used for the reservation. We will then show the remaining balance before secure checkout." />
    <section className="section section--paper"><div className="container balance-payment">
      <form className="balance-payment__form" onSubmit={event => { event.preventDefault(); setSubmitted(true); }}>
        <p className="eyebrow eyebrow--gold">Find a reservation</p>
        <h2 className="font-display">A secure balance payment.</h2>
        <label>Booking reference<input value={bookingReference} onChange={event => { setBookingReference(event.target.value.toUpperCase()); setSubmitted(false); }} placeholder="ONB-XXXXXXXX" autoCapitalize="characters" required /></label>
        <label>Email address<input value={guestEmail} onChange={event => { setGuestEmail(event.target.value); setSubmitted(false); }} placeholder="you@example.com" type="email" required /></label>
        <button className="inn-button inn-button--dark" disabled={!canLookup || lookup.isFetching} type="submit">{lookup.isFetching ? <><Loader2 size={16} className="animate-spin"/> Looking up stay</> : <>Find reservation <ArrowRight size={16}/></>}</button>
        {submitted && lookup.isError ? <p className="form-message form-message--error">{lookup.error.message}</p> : null}
      </form>
      <aside className="balance-payment__summary">
        {reservation && room ? <>
          <p className="eyebrow eyebrow--gold">{room.name}</p><h2 className="font-display">Your balance summary</h2>
          <dl><div><dt>Stay</dt><dd>{reservation.checkIn} to {reservation.checkOut}</dd></div><div><dt>Booking</dt><dd>{reservation.bookingReference}</dd></div><div><dt>Stay total</dt><dd>${(reservation.totalCents / 100).toFixed(2)}</dd></div><div><dt>Deposit received</dt><dd>− ${(reservation.depositDueCents / 100).toFixed(2)}</dd></div><div className="balance-payment__due"><dt>Remaining balance</dt><dd>${(reservation.balanceDueCents / 100).toFixed(2)}</dd></div></dl>
          {reservation.balancePaidAt ? <p className="form-message">This reservation balance has already been paid.</p> : <button className="inn-button inn-button--gold" disabled={checkout.isPending} onClick={() => checkout.mutate(lookupInput)} type="button">{checkout.isPending ? <><Loader2 size={16} className="animate-spin"/> Opening checkout</> : <>Pay remaining balance <ArrowRight size={16}/></>}</button>}
        </> : <div className="balance-payment__empty"><ShieldCheck size={24}/><p>Your reservation details will appear here after verification.</p></div>}
      </aside>
    </div></section>
  </main>;
}

export function AboutPage() {
  return <main><PageHero eyebrow="The Dewenter-Greenen House" title="A Victorian home with a living Indianapolis story." copy="Old Northside Bed & Breakfast sits in the heart of one of the city’s most distinctive historic neighborhoods." /><section className="section section--paper"><div className="container editorial-grid"><div><p className="eyebrow eyebrow--gold">Since 1885</p><h2 className="font-display">An old house with a generous welcome.</h2><p>Built for industrialist Herman Dewenter in 1885, the house is an enduring part of Indianapolis’s Old Northside. The home later became a small, personal inn—one where original architecture, art, and hospitality all share the same address.</p><p>Today, seven private-bath rooms make room for a measured, more thoughtful kind of stay. The innkeeper’s local perspective, breakfast on your schedule, and small comforts help make arrival easy.</p><Link className="inn-button inn-button--dark" href="/booking">Plan a stay <ArrowRight size={17}/></Link></div><img src="/manus-storage/exterior_3b0e8c31.jpg" alt="Old Northside Bed & Breakfast historic red-brick exterior" /></div></section><section className="section section--ink"><div className="container mini-facts"><div><MapPin/><span><strong>Old Northside</strong>Indianapolis, Indiana</span></div><div><Coffee/><span><strong>Breakfast</strong>Served at your chosen time</span></div><div><CheckCircle2/><span><strong>Seven rooms</strong>Each with a private bath</span></div></div></section></main>;
}

export function PoliciesPage({ kind }: { kind: "privacy" | "terms" }) {
  const isPrivacy = kind === "privacy";
  return <main><PageHero eyebrow={isPrivacy ? "Privacy policy" : "Terms & conditions"} title={isPrivacy ? "Your information, handled thoughtfully." : "A clear agreement for a comfortable stay."} copy={isPrivacy ? "This policy explains how Old Northside Bed & Breakfast uses information connected with reservations, payments, and guest service." : "Please review these terms before booking. They set out reservation, payment, arrival, and house expectations."} />
    <section className="section section--paper"><article className="container policy-content">{isPrivacy ? <>
      <p className="policy-date">Effective July 20, 2026</p><h2 className="font-display">Privacy at Old Northside</h2><p>Old Northside Bed & Breakfast collects the information needed to respond to inquiries, create and manage reservations, process payments, communicate about stays, and improve the guest experience. This may include your name, email address, telephone number, reservation details, and limited technical usage data.</p><h3>Payments and service providers</h3><p>Payment card information is processed through our payment provider. Old Northside Bed & Breakfast does not store full card numbers, CVV codes, or card-expiration details. We may share necessary information with trusted reservation, payment, technology, and communications providers solely to operate the inn and provide services you request.</p><h3>Reservation communications</h3><p>We may send transactional emails about reservations, deposits, payment balances, cancellations, upcoming stays, and guest services. These communications are part of operating your reservation.</p><h3>Retention, security, and requests</h3><p>We retain information for as long as reasonably needed for reservations, legal obligations, record keeping, and guest service. We use reasonable safeguards, but no online system can promise absolute security. For privacy questions or requests, contact the inn directly.</p>
    </> : <>
      <p className="policy-date">Effective July 20, 2026</p><h2 className="font-display">Booking and house terms</h2><p>Guests must be 18 or older to make a reservation. A reservation is confirmed after availability is verified and the required payment shown at checkout has been successfully processed. Rates, taxes, and the total payment due are shown before checkout.</p><h3>Payment, balance, and tax</h3><p>Depending on the active booking policy, either a first-night deposit—including applicable tax—or the full stay amount is collected at booking. When a balance remains, it is requested seven days before arrival. For stays of fewer than 30 consecutive nights, the quoted total includes 7% Indiana state tax and 3% Marion County Innkeeper’s Tax. Any cancellation, refund, no-show, or third-party booking rules shown during checkout are part of the applicable reservation.</p><h3>Arrival and house expectations</h3><p>Check-in, check-out, occupancy, children, pets and service animals, smoking/vaping, alcohol, and guest conduct are governed by the reservation terms and house rules communicated by the inn. The property is smoke-free; a smokers’ patio is available. Guests are responsible for following the rules provided for their stay.</p><h3>Questions</h3><p>For clarification about an existing reservation or any house policy, please contact Old Northside Bed & Breakfast before arrival.</p>
    </>}</article></section></main>;
}

export function ConfirmationPage() {
  return <main><section className="confirmation"><div className="confirmation__card"><div className="confirmation__seal"><CheckCircle2 size={42}/></div><p className="eyebrow eyebrow--gold">Reservation received</p><h1 className="font-display">Thank you for choosing Old Northside.</h1><p>Your payment is being securely confirmed. You will receive a reservation email at the address you provided as soon as it is complete. Please keep your booking reference for your records.</p><div className="confirmation__actions"><Link href="/rooms" className="inn-button inn-button--dark">Explore the rooms</Link><Link href="/" className="text-link">Return home <ArrowRight size={16}/></Link></div></div></section></main>;
}
