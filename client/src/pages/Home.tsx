import BookingWidget from "@/components/BookingWidget";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BedDouble, CalendarDays, CarFront, Coffee, Footprints, Landmark, MapPin, ShieldCheck, Sparkles, TreePine, Trophy, UtensilsCrossed, Wifi } from "lucide-react";
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

const indyHighlights = [
  { icon: UtensilsCrossed, title: "Dining & local flavor", body: "Savor popular local restaurants, downtown dining, and the many flavors that make Indianapolis an easy city to explore." },
  { icon: TreePine, title: "Parks & green spaces", body: "Step out for tree-lined streets, neighborhood green space, and the welcoming rhythm of a city built for discovery." },
  { icon: CalendarDays, title: "Festivals & city energy", body: "Plan around lively festivals, cultural events, entertainment, breweries, and distilleries throughout the year." },
  { icon: Trophy, title: "Sports & shared moments", body: "Cheer on a favorite team, catch an Indianapolis Indians game at Victory Field, or make an evening of downtown excitement." },
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
            <p>Constructed in 1885 by Herman C. DeWenter, a German immigrant and Indiana industrialist, this remarkable brick residence is a quintessential example of Romanesque Revival architecture in the heart of the city.</p>
            <p>In 1994, Gary Hofmeister transformed the Dewenter-Greenen House into a luxury bed and breakfast, preserving its legacy while introducing an elegant European turn-of-the-century motif. The home’s original maple slat floors, hand-carved cherry and mahogany woodwork, sculptured parlor ceiling, and hand-painted murals reflect a restoration shaped by skilled European craftsmen and artists.</p>
            <p>Original artwork from around the world fills the house, while a Ukrainian artist hand-painted several murals and ceilings. From a quiet weekend away to an Indianapolis adventure, the inn brings together historic character, attentive comfort, and a genuine sense of place.</p>
            <div className="story-grid__facts" aria-label="Inn heritage at a glance">
              <div><span>1885</span><strong>The Dewenter-Greenen House is built.</strong></div>
              <div><span>1994</span><strong>Gary Hofmeister begins its next chapter as an inn.</strong></div>
            </div>
            <Link href="/about" className="text-link">Discover the house <ArrowRight size={16} /></Link>
          </div>
          <div className="story-grid__image-wrap">
            <img src="/manus-storage/literary-room_69da343c.jpg" alt="The warm, historic interior of a guest room at Old Northside Bed and Breakfast" className="story-grid__image" />
            <div className="story-grid__note"><Sparkles size={17} /> Seven private-bath rooms</div>
          </div>
        </div>
      </section>

      <section className="section owner-section" aria-labelledby="owner-heading">
        <div className="container owner-grid">
          <div className="owner-portrait-wrap"><img src="/manus-storage/gary-hofmeister-portrait_bf2246de.jpg" alt="Gary Hofmeister, owner of Old Northside Bed and Breakfast" className="owner-portrait" /></div>
          <div className="owner-copy">
            <p className="eyebrow eyebrow--gold">A message from Gary Hofmeister</p>
            <h2 id="owner-heading" className="font-display">Gary Hofmeister, Renaissance Man.</h2>
            <p className="owner-copy__intro">Gary’s approach is simple: welcome every guest with the best service they have ever experienced, then keep looking for one more thoughtful way to make the stay exceptional.</p>
            <blockquote>“I never stop thinking about what I can add or enhance to reach that goal. The nicest people in the world come to B&amp;Bs. I know because they come here!”</blockquote>
            <p>If there is ever an issue during your stay, Gary welcomes you to contact him directly at <a href="mailto:garyh@hofmeister.com">garyh@hofmeister.com</a>.</p>
            <p className="owner-copy__source">Inspired by “Gary Hofmeister, Renaissance Man,” TownePost.com.</p>
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

      <section className="section indy-section" aria-labelledby="indy-heading">
        <div className="container">
          <div className="indy-intro">
            <p className="eyebrow eyebrow--light">Explore Indianapolis</p>
            <h2 id="indy-heading" className="font-display">Circle City discoveries, moments from your historic home base.</h2>
            <p>On the edge of downtown in Historic Old Northside, Old Northside Bed and Breakfast places you close to the dining, culture, entertainment, and attractions that make Indianapolis a vibrant place to visit.</p>
          </div>
          <div className="indy-grid" aria-label="Indianapolis experiences near the inn">
            {indyHighlights.map(({ icon: Icon, title, body }) => <article key={title} className="indy-card"><Icon aria-hidden="true" size={24} /><h3>{title}</h3><p>{body}</p></article>)}
          </div>
          <div className="indy-guide">
            <div>
              <p className="eyebrow eyebrow--light">A few nearby favorites</p>
              <p>Explore the President Benjamin Harrison Home, take in Monument Circle, or catch the atmosphere at Lucas Oil Stadium, the Indiana Convention Center, Gainbridge Fieldhouse, the Indianapolis Zoo, and Victory Field.</p>
            </div>
            <Link className="inn-button indy-guide__button" href="/visitor-guide">Open the Visitor Guide <Landmark size={17} /></Link>
          </div>
        </div>
      </section>

      <section className="section section--gold cta-section"><div className="container cta-section__inner"><div><p className="eyebrow">Your Indianapolis stay</p><h2 className="font-display">Book direct. Know your room is ready.</h2><p className="cta-section__copy">Begin at the Dewenter-Greenen House, then step into Old Northside for tree-lined walks and nearby downtown discoveries—an Indianapolis stay designed for memorable experiences and cherished moments.</p></div><Link className="inn-button inn-button--dark" href="/booking">Reserve a room <BedDouble size={18} /></Link></div></section>
    </main>
  );
}
