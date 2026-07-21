import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const homepagePath = fileURLToPath(new URL("../client/src/pages/Home.tsx", import.meta.url));
const indexPath = fileURLToPath(new URL("../client/index.html", import.meta.url));
const appPath = fileURLToPath(new URL("../client/src/App.tsx", import.meta.url));
const innPagesPath = fileURLToPath(new URL("../client/src/pages/InnPages.tsx", import.meta.url));
const emailPath = fileURLToPath(new URL("../server/email.ts", import.meta.url));
const stripePath = fileURLToPath(new URL("../server/stripe.ts", import.meta.url));
const homepageSource = readFileSync(homepagePath, "utf8");
const indexSource = readFileSync(indexPath, "utf8");
const appSource = readFileSync(appPath, "utf8");
const innPagesSource = readFileSync(innPagesPath, "utf8");
const emailSource = readFileSync(emailPath, "utf8");
const stripeSource = readFileSync(stripePath, "utf8");

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

  it("preserves the owner welcome, portrait asset, direct contact, and approved browser title", () => {
    expect(homepageSource).toContain("Gary Hofmeister, Renaissance Man.");
    expect(homepageSource).toContain("/manus-storage/gary-hofmeister-portrait_bf2246de.jpg");
    expect(homepageSource).toContain("garyh@hofmeister.com");
    expect(indexSource).toContain("<title>Old Northside Bed and Breakfast</title>");
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
