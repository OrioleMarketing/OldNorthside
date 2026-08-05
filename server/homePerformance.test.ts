import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
const stylesheetSource = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
const documentSource = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

describe("homepage performance media contract", () => {
  it("serves the audited homepage photos from responsive optimized WebP sources", () => {
    expect(homeSource).toContain("hero-dewenter-1280_74dd3461.webp");
    expect(homeSource).toContain("hero-dewenter-768_921ad6ea.webp");
    expect(homeSource).toContain("story-literary-960_a9c686d7.webp");
    expect(homeSource).toContain("story-literary-640_85b174a5.webp");
    expect(homeSource).toContain("room-bridal-960_79a564f7.webp");
    expect(homeSource).toContain("room-tiffany-960_d940efd6.webp");
    expect(homeSource).toContain("room-literary-960_527011a2.webp");
    expect(homeSource).toContain("offstreet-parking-1120_d36080ac.webp");
    expect(homeSource).not.toContain("OffStreetParking_1c77e0fb.png");
  });

  it("keeps the LCP image prioritized and defers lower-page media with declared dimensions", () => {
    expect(homeSource).toContain('fetchPriority="high"');
    expect(homeSource).toContain('width={1280} height={853}');
    expect(homeSource).toContain('width={960} height={640} loading="lazy" decoding="async"');
    expect(homeSource).toContain('width={1120} height={724} loading="lazy" decoding="async"');
    expect((homeSource.match(/loading="lazy"/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("loads the display fonts through preconnected document-head links instead of a stylesheet import", () => {
    expect(stylesheetSource).not.toContain("fonts.googleapis.com");
    expect(documentSource).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
    expect(documentSource).toContain('rel="preconnect" href="https://fonts.gstatic.com" crossorigin');
    expect(documentSource).toContain("family=DM+Sans");
    expect(documentSource).toContain("family=Fraunces");
  });
});
