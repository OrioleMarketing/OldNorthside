import BookingWidget from "@/components/BookingWidget";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Bath, BedDouble, CalendarCheck2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Coffee, Flame, Landmark, Loader2, MapPin, ShieldCheck, TreePine, Trophy, UtensilsCrossed } from "lucide-react";
import { Link } from "wouter";

type RoomDetail = {
  description: string;
  gallery: string[];
};

const ROOM_DETAILS: Record<string, RoomDetail> = {
  "bridal-room": {
    description: "A romantic, tranquil retreat with pastel details, a canopy queen bed, and a custom-made fireplace. The private bath pairs a double Jacuzzi with a glass shower, creating an especially restful setting for a special occasion or an unhurried stay.",
    gallery: ["/manus-storage/bridal-room-1_13ca6d81.jpg", "/manus-storage/bridal-room-2_978d9fbd.jpg", "/manus-storage/bridal-room-3_30fd04ab.jpg", "/manus-storage/bridal-room-4_c8967cc9.jpg", "/manus-storage/bridal-room-5_a5d7cc97.jpg"],
  },
  "tiffany-room": {
    description: "The inn’s largest and only main-floor guest room combines a king bed with stained glass, Art Deco artwork, and a fireplace. A generous closet, double Jacuzzi, and separate glass shower make this an easy, spacious choice for a longer Indianapolis stay.",
    gallery: ["/manus-storage/tiffany-room-1_b1f1fa89.jpg", "/manus-storage/tiffany-room-2_0f96cf43.jpg", "/manus-storage/tiffany-room-3_3ac334c3.jpg", "/manus-storage/tiffany-room-4_66df2b2d.jpg", "/manus-storage/tiffany-room-5_56971093.jpg"],
  },
  "literary-room": {
    description: "Indiana literary history sets the tone in this king room, where books by local authors share space with board games, puzzles, and soft evening light. A restored antique slate fireplace, large Jacuzzi, and separate glass shower add comfort to its thoughtful, bookish character.",
    gallery: ["/manus-storage/literary-room-1_187fc98d.jpg", "/manus-storage/literary-room-2_d971efc1.jpg", "/manus-storage/literary-room-3_3d49db7e.jpg", "/manus-storage/literary-room-4_f438f0af.jpg", "/manus-storage/literary-room-5_65b7a56c.jpg"],
  },
  "dewenter-room": {
    description: "Named for Herman Dewenter, the original owner of the house, this queen room keeps the home’s history close through preserved woodwork, a distinctive brick wall, and century-old photographs of the Dewenter family and residence. A private bath and fireplace complete its warm historic setting.",
    gallery: ["/manus-storage/dewenter-room-1_7072f519.jpg", "/manus-storage/dewenter-room-2_6d25986a.jpg", "/manus-storage/dewenter-room-3_9ba999d3.jpg", "/manus-storage/dewenter-room-4_831e397a.jpg"],
  },
  "hollywood-room": {
    description: "Classic-film portraiture, a queen canopy bed staged behind lace, and an arts library give this room a theatrical personality. The private bath continues the theme with film memorabilia, sheet music, dressing-table lights, a Jacuzzi, and a separate glass shower.",
    gallery: ["/manus-storage/hollywood-room-1_1cf10f56.jpg", "/manus-storage/hollywood-room-2_9cf7603b.jpg", "/manus-storage/hollywood-room-3_b429278d.jpg", "/manus-storage/hollywood-room-4_17c99292.jpg", "/manus-storage/hollywood-room-5_703ae921.jpg"],
  },
  "rose-garden-room": {
    description: "A spacious, secluded third-floor escape with a king bed, skylight, and private bath with a tub and shower. The Rose Garden Room is a quieter perch in the house for guests who want a little more separation at the end of the day.",
    gallery: ["/manus-storage/rose-garden-1_b8433d99.jpg", "/manus-storage/rose-garden-2_3d9dcbaf.jpg", "/manus-storage/rose-garden-3_2e325336.jpg", "/manus-storage/rose-garden-4_fa14b67f.jpg", "/manus-storage/rose-garden-5_70728195.jpg", "/manus-storage/rose-garden-6_f2dbb84b.jpg"],
  },
  "library-wedding-suite": {
    description: "A distinctive suite with hand-faux-painted walls, genuine antiques, a curated library, and a working gas fireplace. A separate bedroom and private bath with gold sinks, a glass shower, and double Jacuzzi create an especially generous setting for celebrating or settling in.",
    gallery: ["/manus-storage/wedding-suite-1_181e4bed.jpg", "/manus-storage/wedding-suite-2_969b8d1c.jpg", "/manus-storage/wedding-suite-3_7c649483.jpg", "/manus-storage/wedding-suite-4_084c9e00.jpg", "/manus-storage/wedding-suite-5_21f50c26.jpg", "/manus-storage/wedding-suite-6_e7dcc656.jpg"],
  },
};

function RoomGallery({ roomName, images }: { roomName: string; images: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const imageCount = images.length;
  const activeImage = images[activeIndex] ?? images[0];
  const selectImage = (nextIndex: number) => setActiveIndex((nextIndex + imageCount) % imageCount);

  return <div className="room-gallery" aria-label={`${roomName} photo gallery`} aria-roledescription="carousel" onKeyDown={event => {
    if (event.key === "ArrowLeft") { event.preventDefault(); selectImage(activeIndex - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); selectImage(activeIndex + 1); }
  }} tabIndex={0}>
    <div className="room-gallery__stage">
      <img src={activeImage} alt={`${roomName}, photo ${activeIndex + 1} of ${imageCount}`} />
      <span className="room-gallery__count" aria-live="polite">{activeIndex + 1} / {imageCount}</span>
      <button className="room-gallery__control room-gallery__control--previous" type="button" aria-label={`Show previous ${roomName} photo`} onClick={() => selectImage(activeIndex - 1)}><ChevronLeft size={22} /></button>
      <button className="room-gallery__control room-gallery__control--next" type="button" aria-label={`Show next ${roomName} photo`} onClick={() => selectImage(activeIndex + 1)}><ChevronRight size={22} /></button>
    </div>
    <div className="room-gallery__thumbnails" role="tablist" aria-label={`${roomName} photo selection`}>
      {images.map((image, index) => <button className={`room-gallery__thumbnail ${index === activeIndex ? "is-active" : ""}`} type="button" key={image} role="tab" aria-selected={index === activeIndex} aria-label={`Show photo ${index + 1} of ${roomName}`} onClick={() => selectImage(index)}><img src={image} alt="" /></button>)}
    </div>
    <p className="room-gallery__hint">Use the arrows, thumbnails, or left and right arrow keys to view all {imageCount} photos.</p>
  </div>;
}

function PageHero({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <section className="page-hero"><div className="container"><p className="eyebrow eyebrow--gold">{eyebrow}</p><h1 className="font-display">{title}</h1><p>{copy}</p></div></section>;
}

export function RoomsPage() {
  const roomsQuery = trpc.booking.rooms.useQuery();
  const rooms = roomsQuery.data ?? [];
  return <main>
    <PageHero eyebrow="Seven private-bath accommodations" title="Distinct rooms. One unforgettable house." copy="Each room has its own character, period details, and private bath. Select dates to see live availability before reserving." />
    <section className="section section--paper"><div className="container rooms-list">
      {roomsQuery.isLoading ? <p className="room-loading">Gathering the rooms…</p> : rooms.map((room, index) => {
        const detail = ROOM_DETAILS[room.slug];
        const gallery = detail?.gallery ?? [room.imageUrl ?? "/manus-storage/exterior_3b0e8c31.jpg"];
        return <article className={`room-feature ${index % 2 ? "room-feature--reverse" : ""}`} key={room.id}>
          <RoomGallery roomName={room.name} images={gallery} />
          <div className="room-feature__copy"><p className="eyebrow eyebrow--gold">From ${Math.round(room.weekdayRateCents / 100)} Sunday–Thursday · ${Math.round(room.weekendRateCents / 100)} Friday & Saturday</p><h2 className="font-display">{room.name}</h2><p>{detail?.description ?? room.summary}</p><div className="room-feature__details"><span><BedDouble size={17} /> {room.bed}</span><span><Bath size={17} /> Private {room.bath.toLowerCase()}</span>{room.hasFireplace ? <span><Flame size={17} /> Fireplace</span> : null}</div><Link href="/booking" className="inn-button inn-button--dark">Check this room’s dates <ArrowRight size={17} /></Link></div>
        </article>;
      })}
    </div></section>
  </main>;
}

export function BookingPage() {
  const settings = trpc.booking.settings.useQuery();
  const depositNights = settings.data?.depositNights ?? 1;
  const paymentCopy = "Choose dates, select an available room, and decide whether to pay the deposit or the full stay through secure checkout. We show the stay total and taxes before you pay.";
  const paymentPlanCopy = `Pay a ${depositNights === 1 ? "first-night" : `${depositNights}-night`} deposit, including applicable tax, to secure your stay, or pay the full stay total today. Any remaining balance is due six days before arrival.`;
  return <main><PageHero eyebrow="Direct booking" title="Your room, confirmed in three clear steps." copy={paymentCopy} /><section className="section section--paper"><div className="container"><BookingWidget /><p className="booking-additional-adult-note"><strong>Special-event notice:</strong> Some special events may have minimum-night requirements and alternate booking windows. Any applicable requirement will be shown when you check availability for your dates.</p></div></section><section className="section policy-strip"><div className="container policy-strip__grid"><div><ShieldCheck size={23}/><p><strong>Secure payment</strong><br/>Card details are processed by Stripe, not stored by the inn.</p></div><div><CalendarCheck2 size={23}/><p><strong>Live availability</strong><br/>Rooms shown are available for the entire selected stay.</p></div><div><Clock3 size={23}/><p><strong>Simple payment plan</strong><br/>{paymentPlanCopy}</p></div></div></section></main>;
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
  return <main>
    <PageHero eyebrow="The Dewenter-Greenen House" title="A Romanesque Revival home with a living Indianapolis story." copy="Old Northside Bed and Breakfast sits in the heart of one of the city’s most distinctive historic neighborhoods." />
    <section className="section section--paper"><div className="container editorial-grid"><div><p className="eyebrow eyebrow--gold">Since 1885</p><h2 className="font-display">An old house with a generous welcome.</h2><p>Built in 1885 for Herman C. Dewenter, the Dewenter-Greenen House is a rare surviving example of domestic late Romanesque Revival architecture in Indianapolis. Its brickwork, round wall arch, corbie-step gable, and classically inspired terra-cotta details make the house as memorable from the street as it is from within.</p><p>Today, seven private-bath rooms make room for a measured, more thoughtful kind of stay. The innkeeper’s local perspective, breakfast on your schedule, and small comforts help make arrival easy.</p><Link className="inn-button inn-button--dark" href="/booking">Plan a stay <ArrowRight size={17}/></Link></div><img src="/manus-storage/exterior_3b0e8c31.jpg" alt="Old Northside Bed and Breakfast historic red-brick exterior" /></div></section>
    <section className="section section--paper"><article className="container policy-content"><p className="eyebrow eyebrow--gold">Architecture and ownership</p><h2 className="font-display">Designed to make a lasting impression.</h2><p>The house’s defining wall arch is framed by rusticated brick infill at both the spandrel between the first- and second-floor windows and the arch tympanum. A corbie-step gable and terra-cotta trim around the doors add further texture and distinction. The original wooden side porch has been lost, but the home’s unusual masonry and architectural character remain.</p><h3>From Dewenter to Greenen</h3><p>Herman C. Dewenter, a German-born Indianapolis industrialist, was a co-founder of Kruse &amp; Dewenter Co., furnace manufacturers, and served as the firm’s vice president and treasurer. He remained at 1340 North Alabama Street until his death in 1916. His son-in-law, Charles P. Greenen, later occupied the home and led Kruse &amp; Dewenter as its president until his death in 1929.</p></article></section>
    <section className="section section--ink"><div className="container mini-facts"><div><MapPin/><span><strong>Old Northside</strong>Indianapolis, Indiana</span></div><div><Coffee/><span><strong>Breakfast</strong>Served at your chosen time</span></div><div><CheckCircle2/><span><strong>Seven rooms</strong>Each with a private bath</span></div></div></section>
    <section className="section section--paper"><article className="container policy-content"><p className="eyebrow eyebrow--gold">The neighborhood story</p><h2 className="font-display">A historic district restored by its community.</h2><p>In the late nineteenth century, Old Northside became a favored residential neighborhood for many of Indianapolis’s prominent families. Its story includes the nearby Benjamin Harrison Home, the Morris-Butler House, the former home of author Meredith Nicholson, and the early campus of North Western Christian University—later Butler University.</p><p>As development moved north in the early twentieth century, parts of the neighborhood fell into disrepair. Residents began a sustained preservation effort in the late 1960s, and Old Northside received historic designation in 1978 after adopting a preservation plan. Today, the neighborhood’s history is supported by the Indianapolis Historic Preservation Commission and a continuing community commitment to its architectural character.</p><h3>Places to pause nearby</h3><p>Guests can enjoy nearby Great Oak Commons, Shawn Grove Park, and the Frank and Judy O’Bannon Soccer Park, or visit the President Benjamin Harrison Home, the Morris-Butler House, and the Indiana Landmarks Center. Together, these places make Old Northside a neighborhood to explore as well as a place to stay.</p><p className="policy-date">Historical background adapted from the Old Northside Historic Area Preservation Plan (1979), supplied by the inn.</p></article></section>
  </main>;
}

const VISITOR_GUIDE_HIGHLIGHTS = [
  { icon: UtensilsCrossed, title: "Dine your way through the city", body: "Start with popular local eateries and downtown dining, then return to the calm of Old Northside after an evening out." },
  { icon: TreePine, title: "Make room for green space", body: "Pair historic streets with parks and green spaces for an easy, restorative way to explore Indianapolis." },
  { icon: CalendarDays, title: "Follow the city’s calendar", body: "Festivals, cultural events, entertainment, breweries, and distilleries give every season its own rhythm." },
  { icon: Trophy, title: "Find a memorable game night", body: "Cheer at Lucas Oil Stadium, Gainbridge Fieldhouse, or an Indianapolis Indians game at Victory Field." },
];

export function VisitorGuidePage() {
  return <main>
    <PageHero eyebrow="Indianapolis Visitor Guide" title="Make the most of your Indianapolis stay." copy="Set on the edge of downtown in Historic Old Northside, Old Northside Bed and Breakfast is a welcoming home base for dining, culture, city events, and memorable discoveries." />
    <section className="section section--paper"><div className="container visitor-guide">
      <header className="visitor-guide__intro"><p className="eyebrow eyebrow--gold">Circle City, close at hand</p><h2 className="font-display">A historic neighborhood, with the city within easy reach.</h2><p>Begin in the tree-lined character of Old Northside, then move easily toward the dining, shopping, attractions, and entertainment that make Indianapolis such a vibrant destination. At the end of the day, return to a more personal kind of stay.</p></header>
      <div className="visitor-guide__cards">{VISITOR_GUIDE_HIGHLIGHTS.map(({ icon: Icon, title, body }) => <article className="visitor-guide__card" key={title}><Icon aria-hidden="true" size={24}/><h3>{title}</h3><p>{body}</p></article>)}</div>
    </div></section>
    <section className="section visitor-guide__landmarks"><div className="container visitor-guide__landmarks-grid"><div><p className="eyebrow eyebrow--light">A few nearby favorites</p><h2 className="font-display">Let curiosity set the itinerary.</h2><p>Explore the rich history of the President Benjamin Harrison Home, take in the energy of Monument Circle, or plan an outing around the Indiana Convention Center. The Indianapolis Zoo and downtown restaurants offer more reasons to make a day of it.</p></div><div className="visitor-guide__landmark-list" aria-label="Visitor Guide landmarks"><div><Landmark aria-hidden="true" size={20}/><span><strong>Indianapolis landmarks</strong>President Benjamin Harrison Home · Monument Circle · Indiana Convention Center</span></div><div><Trophy aria-hidden="true" size={20}/><span><strong>Sports and live events</strong>Lucas Oil Stadium · Gainbridge Fieldhouse · Victory Field</span></div><div><MapPin aria-hidden="true" size={20}/><span><strong>Start and finish well</strong>Free off-street parking at the inn, then a cozy evening back in Old Northside.</span></div></div></div></section>
    <section className="section section--gold cta-section"><div className="container cta-section__inner"><div><p className="eyebrow">Your home base</p><h2 className="font-display">Plan the stay around the discoveries.</h2><p className="cta-section__copy">Reserve directly with Old Northside Bed and Breakfast, then let Indianapolis unfold at your own pace.</p></div><Link href="/booking" className="inn-button inn-button--dark">Check availability <ArrowRight size={18}/></Link></div></section>
  </main>;
}

const FAQ_ITEMS = [
  { question: "What time is check-in and check-out?", answer: "Check-in is available from 3 PM, and we kindly ask guests to check out by 11 AM. Early check-in or late check-out may be arranged upon request, subject to availability." },
  { question: "Are pets allowed at the Bed & Breakfast?", answer: "While we love animals, we are unable to accommodate pets to ensure the comfort of all our guests." },
  { question: "Is breakfast included in the room rate?", answer: "Yes, a full breakfast is included with your stay. You can enjoy a delicious meal at a time that suits you best, with no additional charges." },
  { question: "What amenities are available in the rooms?", answer: "Each room is equipped with cable TV, free WiFi, and access to hundreds of movies. We also offer a 24/7 snack bar with complimentary soft drinks and bottled water." },
  { question: "Do you offer parking facilities?", answer: "We provide complimentary private parking for all our guests, ensuring your vehicle is safe and secure during your stay." },
  { question: "How can I make a reservation?", answer: "Reservations can be made directly through our website or by calling us. We recommend booking in advance to secure your preferred dates." },
];

export function FAQPage() {
  return <main>
    <PageHero eyebrow="Plan with confidence" title="Common Questions About Your Stay" copy="Explore answers to some of the most frequently asked questions about staying at the Old Northside Bed and Breakfast, ensuring a comfortable and informed visit." />
    <section className="section section--paper"><div className="container faq-page">
      <div className="faq-page__intro"><p className="eyebrow eyebrow--gold">Helpful details</p><h2 className="font-display">Everything you need for an easy arrival.</h2><p>From breakfast and parking to room comforts and reservations, these answers cover the details guests ask most often.</p></div>
      <div className="faq-list">{FAQ_ITEMS.map((item, index) => <details className="faq-item" key={item.question} open={index === 0}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      <div className="faq-page__cta"><p>Still have a question? We are happy to help you plan your stay.</p><Link href="/booking" className="inn-button inn-button--dark">Check availability <ArrowRight size={17} /></Link></div>
    </div></section>
  </main>;
}

export function PoliciesPage({ kind }: { kind: "privacy" | "terms" }) {
  const isPrivacy = kind === "privacy";
  return <main><PageHero eyebrow={isPrivacy ? "Privacy policy" : "Terms & conditions"} title={isPrivacy ? "Your information, handled thoughtfully." : "A clear agreement for a comfortable stay."} copy={isPrivacy ? "This policy explains how Old Northside Bed and Breakfast uses information connected with reservations, payments, and guest service." : "Please review these terms before booking. They set out reservation, payment, arrival, and house expectations."} />
    <section className="section section--paper"><article className="container policy-content">{isPrivacy ? <>
      <p className="policy-date">Effective July 20, 2026</p><h2 className="font-display">Privacy at Old Northside</h2><p>Old Northside Bed and Breakfast collects the information needed to respond to inquiries, create and manage reservations, process payments, communicate about stays, and improve the guest experience. This may include your name, email address, telephone number, reservation details, and limited technical usage data.</p><h3>Payments and service providers</h3><p>Payment card information is processed through our payment provider. Old Northside Bed and Breakfast does not store full card numbers, CVV codes, or card-expiration details. We may share necessary information with trusted reservation, payment, technology, and communications providers solely to operate the inn and provide services you request.</p><h3>Reservation communications</h3><p>We may send transactional emails about reservations, deposits, payment balances, cancellations, upcoming stays, and guest services. These communications are part of operating your reservation.</p><h3>Retention, security, and requests</h3><p>We retain information for as long as reasonably needed for reservations, legal obligations, record keeping, and guest service. We use reasonable safeguards, but no online system can promise absolute security. For privacy questions or requests, contact the inn directly.</p>
    </> : <>
      <p className="policy-date">Effective August 6, 2026</p><h2 className="font-display">Booking and house terms</h2><p>Guests must be 18 or older to make a reservation. A reservation is confirmed after availability is verified and the required payment shown at checkout has been successfully processed. Reservations must be made at least one day in advance and may not exceed 28 nights. Rates, taxes, and the total payment due are shown before checkout.</p><h3>Payment, balance, and tax</h3><p>A first-night deposit, including applicable tax, is collected at booking unless a guest elects to pay the full stay amount. When a balance remains, it is due six days before arrival and may be charged to a guest’s saved payment method only when separately authorized by that guest. For stays of fewer than 30 consecutive nights, the quoted total includes 7% Indiana state tax and 10% Marion County Innkeeper’s Tax.</p><h3>Cancellations</h3><p>For cancellations made fewer than seven days before arrival, the applicable payment is refunded to a transferable gift certificate. A gift certificate may be used for a later stay or donated at the guest’s request to Little Red Door Cancer Center or Fair Haven Foundation.</p><h3>Arrival and house expectations</h3><p>Check-in, check-out, occupancy, children, pets and service animals, smoking/vaping, alcohol, and guest conduct are governed by the reservation terms and house rules communicated by the inn. Additional adults may be added at $15 per night per person, but no additional beds are available; please call the inn for additional people. The property is smoke-free; a smokers’ patio is available.</p><h3>Questions</h3><p>For clarification about an existing reservation or any house policy, please contact Old Northside Bed and Breakfast before arrival.</p>
    </>}</article></section></main>;
}

export function PetPolicyPage() {
  return <main><PageHero eyebrow="Old Northside Bed and Breakfast" title="Pet Policy" copy="A comfortable stay for every guest, including eligible dogs." />
    <section className="section section--paper"><article className="container policy-content">
      <p className="policy-date">Official Pet Policy</p>
      <h2 className="font-display">Traveling with your dog</h2>
      <p>A maximum of two dogs, each under 25 pounds, may stay at Old Northside Bed and Breakfast. Guests bringing a dog must review and acknowledge this policy as part of their reservation.</p>
      <h3>Guest responsibilities</h3>
      <ol>
        <li>Dogs must be completely housebroken.</li>
        <li>No barkers who could disturb other guests.</li>
        <li>Please bring your own coverings if you allow your dog on the bed.</li>
        <li>Dogs cannot be left at the inn when you leave the premises.</li>
      </ol>
      <h3>Restricted dog types</h3>
      <p>Restricted dog breeds include Akitas, Argentinean Mastiffs, Bull Mastiffs, Cane Corsos, Chows, Dobermans, English Bull Terriers, German Shepherds, Pit Bull Terriers, Rottweilers, Ridgebacks, Wolf Hybrids, as well as mixed breeds containing those bloodlines. Guard dogs and any dog with a history of aggression or biting are also prohibited for safety and insurance reasons. If you have a dog-breed or pet-policy question, confirm the details by calling the inn.</p>
      <h3>Cleaning and repair</h3>
      <p>If a dog soils or damages carpet or furniture, a cleaning or repair fee will be assessed.</p>
      <h3>Before you reserve</h3>
      <p>When booking with a dog, please confirm the number of dogs, confirm that each dog weighs under 25 pounds, and check the required acknowledgment that you have reviewed this policy.</p>
      <Link href="/booking" className="inn-button inn-button--dark">Reserve with your dog <ArrowRight size={17} /></Link>
    </article></section></main>;
}

export function ConfirmationPage() {
  return <main><section className="confirmation"><div className="confirmation__card"><div className="confirmation__seal"><CheckCircle2 size={42}/></div><p className="eyebrow eyebrow--gold">Reservation received</p><h1 className="font-display">Thank you for choosing Old Northside Bed and Breakfast.</h1><p>Your payment is being securely confirmed. You will receive a reservation email at the address you provided as soon as it is complete. Please keep your booking reference for your records.</p><div className="confirmation__actions"><Link href="/rooms" className="inn-button inn-button--dark">Explore the rooms</Link><Link href="/" className="text-link">Return home <ArrowRight size={16}/></Link></div></div></section></main>;
}
