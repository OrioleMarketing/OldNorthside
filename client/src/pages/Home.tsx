import BookingWidget from "@/components/BookingWidget";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BedDouble, CalendarDays, CarFront, Coffee, Footprints, MapPin, ShieldCheck, Sparkles, Wifi } from "lucide-react";
import { Link } from "wouter";

const HERO_IMAGE = "/manus-storage/exterior_3b0e8c31.jpg";
const ROOM_IMAGES: Record<string, string> = {
  "the-bridal-room": "/manus-storage/library-suite_b24b3222.jpg",
  "the-tiffany-room": "/manus-storage/tiffany-room_0dbdd78d.jpg",
  "the-literary-room": "/manus-storage/literary-room_69da343c.jpg",
  "the-dewenter-room": "/manus-storage/dewenter-room_a9fea36d.jpg",
  "the-hollywood-room": "/manus-storage/hollywood-room_74a677e5.jpg",
  "the-rose-garden-room": "/manus-storage/rose-garden-room_b1faa21a.jpg",
  "the-library-wedding-suite": "/manus-storage/library-suite_b24b3222.jpg",
};

const amenities = [
  { icon: Coffee, title: "Breakfast on your schedule", body: "Enjoy a complete breakfast at the time that suits your morning." },
  { icon: CarFront, title: "Free off-street parking", body: "A valuable Indianapolis convenience, with a place for your car at the inn." },
  { icon: Footprints, title: "Walkable city access", body: "Settle in, then explore Old Northside and many downtown features on foot." },
  { icon: Wifi, title: "Comforts, thoughtfully covered", body: "Wi‑Fi, cable, hundreds of movies, popcorn, soft drinks, water, and a 24/7 snack bar." },
  { icon: ShieldCheck, title: "A smoke-free house", body: "The house is smoke-free throughout; a dedicated smoker’s patio is available outdoors." },
];

export default function Home() {
  const roomsQuery = trpc.booking.rooms.useQuery();
  const rooms = roomsQuery.data ?? [];

  return (
    <main>
      <section className="hero" aria-labelledby="home-title">
        <div className="hero__image" style={{ backgroundImage: `url(${HERO_IMAGE})` }} />
        <div className="hero__veil" />
        <div className="container hero__content">
          <p className="eyebrow eyebrow--light">Indianapolis · Est. 1885</p>
          <h1 id="home-title" className="font-display">A historic stay, made personal.</h1>
          <p className="hero__copy">Welcome to the Dewenter-Greenen House, a seven-room bed and breakfast in Indianapolis’s Old Northside neighborhood.</p>
          <div className="hero__actions">
            <a className="inn-button inn-button--primary" href="#availability">Check availability <ArrowRight size={17} /></a>
            <Link className="inn-button inn-button--ghost" href="/rooms">Explore the rooms</Link>
          </div>
          <p className="hero__address"><MapPin size={16} /> 1340 North Alabama Street · Indianapolis, Indiana</p>
        </div>
      </section>

      <section id="availability" className="section section--paper section--pullup"><div className="container"><BookingWidget /></div></section>

      <section className="section section--ink story-section">
        <div className="container story-grid">
          <div className="story-grid__copy">
            <p className="eyebrow eyebrow--gold">The house</p>
            <h2 className="font-display">Hoosier hospitality with an international flavor.</h2>
            <p>Built in 1885 for industrialist Herman Dewenter, the Dewenter-Greenen House has long been part of Indianapolis’s historic Old Northside. In 1994, local businessman, entertainer, and politician Gary Hofmeister acquired the home and reimagined it as a luxury bed and breakfast worthy of its history and lineage.</p>
            <p>Original artwork from around the world fills the house, while a Ukrainian artist hand-painted several murals and ceilings. Every guest room has a private bath, with select rooms offering large double jacuzzi tubs.</p>
            <p>From a quiet weekend away to an Indianapolis visit with a story worth remembering, the inn brings together historic character, attentive comfort, and a genuine sense of place.</p>
            <div className="story-grid__facts" aria-label="Inn heritage at a glance">
              <div><span>1885</span><strong>The Dewenter-Greenen House is built.</strong></div>
              <div><span>1994</span><strong>Gary Hofmeister begins its next chapter as an inn.</strong></div>
            </div>
            <Link href="/about" className="text-link">Discover the house <ArrowRight size={16} /></Link>
          </div>
          <div className="story-grid__image-wrap">
            <img src="/manus-storage/literary-room_69da343c.jpg" alt="The warm, historic interior of a guest room at Old Northside Bed & Breakfast" className="story-grid__image" />
            <div className="story-grid__note"><Sparkles size={17} /> Seven private-bath rooms</div>
          </div>
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="rooms-heading">
        <div className="container">
          <div className="section-heading"><div><p className="eyebrow eyebrow--gold">Accommodations</p><h2 id="rooms-heading" className="font-display">Choose the room that feels like yours.</h2></div><Link className="text-link" href="/rooms">View all seven rooms <ArrowRight size={16} /></Link></div>
          <div className="room-grid">
            {roomsQuery.isLoading ? <div className="room-loading">Gathering the rooms…</div> : rooms.slice(0, 3).map(room => (
              <article className="room-card" key={room.id}>
                <img src={ROOM_IMAGES[room.slug] ?? room.imageUrl ?? HERO_IMAGE} alt={room.name} />
                <div className="room-card__content"><p className="eyebrow eyebrow--gold">From ${Math.round(room.weekdayRateCents / 100)} nightly</p><h3 className="font-display">{room.name}</h3><p>{room.bed} · Private {room.bath.toLowerCase()}{room.hasFireplace ? " · Fireplace" : ""}</p><a href="#availability" className="room-card__action">Check dates <ArrowRight size={16} /></a></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="amenities-band"><div className="container amenities-grid">{amenities.map(({ icon: Icon, title, body }) => <article key={title} className="amenity"><Icon aria-hidden="true" size={24} /><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></section>

      <section className="section neighborhood-section"><div className="container neighborhood-grid"><div className="neighborhood-grid__visual"><div className="neighborhood-grid__monogram">ON</div></div><div><p className="eyebrow eyebrow--gold">Old Northside</p><h2 className="font-display">Park once. Explore Indianapolis on foot.</h2><p>Free off-street parking is a practical benefit in Indianapolis. Leave the car at the inn, then enjoy tree-lined Old Northside streets and many downtown restaurants, cultural destinations, and city features within walking distance.</p><p>When you return, you come back to the quiet character of a historic home rather than a downtown parking search.</p><Link href="/about" className="inn-button inn-button--dark">Plan your stay <CalendarDays size={17} /></Link></div></div></section>

      <section className="section section--gold cta-section"><div className="container cta-section__inner"><div><p className="eyebrow">Your Indianapolis stay</p><h2 className="font-display">Book direct. Know your room is ready.</h2></div><Link className="inn-button inn-button--dark" href="/booking">Reserve a room <BedDouble size={18} /></Link></div></section>
    </main>
  );
}
