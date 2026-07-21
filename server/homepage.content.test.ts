import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const homepagePath = fileURLToPath(new URL("../client/src/pages/Home.tsx", import.meta.url));
const homepageSource = readFileSync(homepagePath, "utf8");

describe("homepage guest-facing positioning", () => {
  it("preserves the approved Dewenter-Greenen House history and artistic context", () => {
    expect(homepageSource).toContain("Built in 1885 for industrialist Herman Dewenter");
    expect(homepageSource).toContain("Gary Hofmeister");
    expect(homepageSource).toContain("Ukrainian artist hand-painted several murals and ceilings");
  });

  it("presents the approved comfort, parking, walkability, and smoke-free benefits", () => {
    expect(homepageSource).toContain("Free off-street parking");
    expect(homepageSource).toContain("Walkable city access");
    expect(homepageSource).toContain("A smoke-free house");
    expect(homepageSource).toContain("many downtown restaurants, cultural destinations, and city features within walking distance");
  });
});
