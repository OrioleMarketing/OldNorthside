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
const homepageSource = readFileSync(homepagePath, "utf8");
const indexSource = readFileSync(indexPath, "utf8");
const appSource = readFileSync(appPath, "utf8");
const innPagesSource = readFileSync(innPagesPath, "utf8");
const emailSource = readFileSync(emailPath, "utf8");
const stripeSource = readFileSync(stripePath, "utf8");
const bookingWidgetSource = readFileSync(bookingWidgetPath, "utf8");
const stylesheetSource = readFileSync(stylesheetPath, "utf8");

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
    expect(homepageSource).toContain('const HERO_IMAGE = "/manus-storage/dewenter-room_a9fea36d.jpg"');
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
