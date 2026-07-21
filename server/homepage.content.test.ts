import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const homepagePath = fileURLToPath(new URL("../client/src/pages/Home.tsx", import.meta.url));
const indexPath = fileURLToPath(new URL("../client/index.html", import.meta.url));
const appPath = fileURLToPath(new URL("../client/src/App.tsx", import.meta.url));
const innPagesPath = fileURLToPath(new URL("../client/src/pages/InnPages.tsx", import.meta.url));
const emailPath = fileURLToPath(new URL("../server/email.ts", import.meta.url));
const stripePath = fileURLToPath(new URL("../server/stripe.ts", import.meta.url));
const bookingWidgetPath = fileURLToPath(new URL("../client/src/components/BookingWidget.tsx", import.meta.url));
const stylesheetPath = fileURLToPath(new URL("../client/src/index.css", import.meta.url));
const roomSourceRecordPath = fileURLToPath(new URL("../official-room-source.md", import.meta.url));
const homepageSource = readFileSync(homepagePath, "utf8");
const indexSource = readFileSync(indexPath, "utf8");
const appSource = readFileSync(appPath, "utf8");
const innPagesSource = readFileSync(innPagesPath, "utf8");
const emailSource = readFileSync(emailPath, "utf8");
const stripeSource = readFileSync(stripePath, "utf8");
const bookingWidgetSource = readFileSync(bookingWidgetPath, "utf8");
const stylesheetSource = readFileSync(stylesheetPath, "utf8");
const roomSourceRecord = readFileSync(roomSourceRecordPath, "utf8");

describe("homepage guest-facing positioning", () => {
  it("preserves the approved Dewenter-Greenen House history and artistic context", () => {
    expect(homepageSource).toContain("Constructed in 1885 by Herman C. DeWenter");
    expect(homepageSource).toContain("Romanesque Revival architecture");
    expect(homepageSource).toContain("European turn-of-the-century motif");
    expect(homepageSource).toContain("original maple slat floors");
    expect(homepageSource).toContain("Ukrainian artist hand-painted several murals and ceilings");
  });

  it("presents the approved comfort, parking, walkability, and smoke-free benefits", () => {
    expect(homepageSource).toContain("Free off-street parking");
    expect(homepageSource).toContain("Walkable city access");
    expect(homepageSource).toContain("A smoke-free house");
    expect(homepageSource).toContain("many downtown restaurants, cultural destinations, and city features within walking distance");
    expect(homepageSource).toContain("Begin at the Dewenter-Greenen House");
    expect(homepageSource).toContain("Old Northside for tree-lined walks and nearby downtown discoveries");
  });

  it("uses the approved welcoming hero, lighter transition, clear reading rhythm, parking image, and booking hierarchy", () => {
    expect(homepageSource).toContain('const HERO_IMAGE = "/manus-storage/dewenter-room_c0fd6bf3.jpg"');
    expect(homepageSource).toContain('Welcome to the Dewenter-Greenen House, now the Old Northside Bed and Breakfast');
    expect(homepageSource).toContain('className="hero-transition"');
    expect(homepageSource).toContain('Inn contact and booking details');
    expect(homepageSource).toContain('/manus-storage/OffStreetParking_1c77e0fb.png');
    expect(homepageSource).toContain('alt="Off-street guest parking at Old Northside Bed and Breakfast"');
    expect(homepageSource).not.toContain('neighborhood-grid__monogram">ON');
    expect(homepageSource.indexOf('className="section section--paper story-section"')).toBeLessThan(homepageSource.indexOf('id="availability"'));
    expect(stylesheetSource).toContain('.hero-transition__card');
    expect(stylesheetSource).toContain('background: #f4ebdc');
    expect(stylesheetSource).toContain('clip-path: polygon(0 58%, 100% 0');
    expect(bookingWidgetSource).toContain('numberOfMonths={1}');
    expect(bookingWidgetSource).not.toContain('numberOfMonths={compact ? 1 : 2}');
  });

  it("presents the owner-approved Indianapolis visitor experience and links to an internal Visitor Guide", () => {
    expect(homepageSource).toContain("Explore Indianapolis");
    expect(homepageSource).toContain("Historic Old Northside");
    expect(homepageSource).toContain("Dining & local flavor");
    expect(homepageSource).toContain("Parks & green spaces");
    expect(homepageSource).toContain("Festivals & city energy");
    expect(homepageSource).toContain("President Benjamin Harrison Home");
    expect(homepageSource).toContain("Monument Circle");
    expect(homepageSource).toContain("Lucas Oil Stadium");
    expect(homepageSource).toContain("Indianapolis Zoo");
    expect(homepageSource).toContain('href="https://www.visitindy.com/"');
    expect(homepageSource).toContain('target="_blank"');
    expect(homepageSource).toContain('rel="noopener noreferrer"');
    expect(homepageSource).toContain('aria-label="Explore Visit Indy in a new tab"');
    expect(homepageSource).toContain("Explore Visit Indy");
    expect(homepageSource).not.toContain("Indianapolis%20Visitor%20Guide");
    expect(appSource).toContain('path="/visitor-guide"');
    expect(innPagesSource).toContain("Indianapolis Visitor Guide");
    expect(innPagesSource).toContain("Dine your way through the city");
    expect(innPagesSource).toContain("President Benjamin Harrison Home");
    expect(innPagesSource).toContain("Gainbridge Fieldhouse");
  });

  it("preserves the owner welcome, portrait asset, direct contact, and approved browser title", () => {
    expect(homepageSource).toContain("Gary Hofmeister, Renaissance Man.");
    expect(homepageSource).toContain("/manus-storage/gary-hofmeister-portrait_bf2246de.jpg");
    expect(homepageSource).toContain("garyh@hofmeister.com");
    expect(indexSource).toContain("<title>Old Northside Bed and Breakfast</title>");
    expect(indexSource).toContain('/manus-storage/favicon_design_1_5841d8ac.webp');
    expect(appSource).toContain("Bed and Breakfast · Indianapolis");
    expect(appSource).toContain("Old Northside Bed and Breakfast. All rights reserved.");
    expect(appSource).toContain('href="/" className="site-footer__logo-link"');
    expect(appSource).toContain('/manus-storage/old-northside-footer-logo_9f8b55b3.png');
    expect(appSource).toContain('alt="Old Northside Bed and Breakfast"');
    expect(innPagesSource).toContain("Old Northside Bed and Breakfast");
    expect(innPagesSource).toContain("Thank you for choosing Old Northside Bed and Breakfast.");
    expect(emailSource).toContain("Old Northside Bed and Breakfast");
    expect(stripeSource).toContain("Old Northside Bed and Breakfast");
    expect(homepageSource).not.toContain("Old Northside Bed & Breakfast");
    expect(innPagesSource).not.toContain("Old Northside Bed & Breakfast");
    expect(emailSource).not.toContain("Old Northside Bed &amp; Breakfast");
    expect(stripeSource).not.toContain("Old Northside Bed & Breakfast");
  });
});


describe("official room and pet-policy updates", () => {
  it("uses authorized interior room images as the room-card covers and gallery lead images", () => {
    const officialInteriorCovers = [
      "/manus-storage/bridal-room-1_13ca6d81.jpg",
      "/manus-storage/tiffany-room-1_b1f1fa89.jpg",
      "/manus-storage/literary-room-1_187fc98d.jpg",
      "/manus-storage/dewenter-room-1_7072f519.jpg",
      "/manus-storage/hollywood-room-1_1cf10f56.jpg",
      "/manus-storage/rose-garden-1_b8433d99.jpg",
      "/manus-storage/wedding-suite-1_181e4bed.jpg",
    ];

    officialInteriorCovers.forEach(image => {
      expect(homepageSource).toContain(image);
      expect(innPagesSource).toContain(image);
    });
    expect(homepageSource).not.toContain("/manus-storage/bridal-room_3e9601fd.png");
    expect(roomSourceRecord).toContain("the largest and only main-floor guest room");
    expect(roomSourceRecord).toContain("hand-faux-painted walls");
  });

  it("provides full source-grounded room descriptions and keyboard-operable multi-image galleries", () => {
    expect(innPagesSource).toContain("function RoomGallery");
    expect(innPagesSource).toContain("Use the arrows, thumbnails, or left and right arrow keys");
    expect(innPagesSource).toContain("A romantic, tranquil retreat with pastel details");
    expect(innPagesSource).toContain("The inn’s largest and only main-floor guest room");
    expect(innPagesSource).toContain("Indiana literary history sets the tone");
    expect(innPagesSource).toContain("hand-faux-painted walls, genuine antiques");
    expect(innPagesSource).toContain("bridal-room-5_a5d7cc97.jpg");
    expect(innPagesSource).toContain("wedding-suite-6_e7dcc656.jpg");
    expect(stylesheetSource).toContain(".room-gallery__control");
    expect(stylesheetSource).toContain(".room-gallery__thumbnails");
    expect(stylesheetSource).toContain(".room-gallery:focus-visible");
  });

  it("publishes the supplied Pet Policy and requires its acknowledgment in the booking form", () => {
    expect(appSource).toContain('path="/pet-policy"');
    expect(appSource).toContain('href="/pet-policy"');
    expect(innPagesSource).toContain("A maximum of two dogs, each under 25 pounds");
    expect(innPagesSource).toContain("Dogs must be completely housebroken.");
    expect(innPagesSource).toContain("No barkers who could disturb other guests.");
    expect(innPagesSource).toContain("Dogs cannot be left at the inn when you leave the premises.");
    expect(innPagesSource).toContain("a cleaning or repair fee will be assessed");
    expect(bookingWidgetSource).toContain("Will a dog stay with you?");
    expect(bookingWidgetSource).toContain("petPolicyAcknowledged");
    expect(bookingWidgetSource).toContain('href="/pet-policy"');
  });
});

describe("global interactive control styling", () => {
  it("applies the approved 15px corner radius to native and site-specific button controls", () => {
    expect(stylesheetSource).toContain("/* Global button-radius standard */");
    expect(stylesheetSource).toMatch(
      /button:not\(\.rdp-day_button\):not\(\.button-radius-exempt\),[\s\S]*?\.inn-button,[\s\S]*?\.site-nav__book,[\s\S]*?\.hero-transition__cta,[\s\S]*?\.booking-reset,[\s\S]*?\.owner-button,[\s\S]*?\.owner-resend-button\s*\{\s*border-radius:\s*15px;\s*\}/,
    );
    expect(stylesheetSource).toContain("button:not(.rdp-day_button):not(.button-radius-exempt)");
    expect(stylesheetSource).toContain("/* Global keyboard-focus standard for actionable controls */");
    expect(stylesheetSource).toContain(
      "button:not(.rdp-day_button):not(.button-radius-exempt):focus-visible",
    );
    expect(stylesheetSource).toContain("outline: 3px solid #2f493f;");
    expect(stylesheetSource).toContain("outline-offset: 3px;");

    const globalRadiusRule = stylesheetSource.indexOf("/* Global button-radius standard */");
    expect(globalRadiusRule).toBeGreaterThan(stylesheetSource.indexOf(".hero-transition__cta {"));
    expect(globalRadiusRule).toBeGreaterThan(stylesheetSource.indexOf(".booking-reset {"));
    expect(globalRadiusRule).toBeGreaterThan(stylesheetSource.indexOf(".owner-button {"));
    expect(globalRadiusRule).toBeGreaterThan(stylesheetSource.indexOf(".owner-resend-button {"));
  });
});
