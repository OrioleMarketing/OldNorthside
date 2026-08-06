import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const housePageSource = readFileSync(resolve(process.cwd(), "client/src/pages/InnPages.tsx"), "utf8");

describe("House page historical background", () => {
  it("preserves the supplied Dewenter-Greenen House architecture and ownership history", () => {
    expect(housePageSource).toContain("domestic late Romanesque Revival architecture");
    expect(housePageSource).toContain("corbie-step gable");
    expect(housePageSource).toContain("classically inspired terra-cotta details");
    expect(housePageSource).toContain("Herman C. Dewenter");
    expect(housePageSource).toContain("Charles P. Greenen");
  });

  it("adds the Old Northside preservation, landmark, and park context", () => {
    expect(housePageSource).toContain("Old Northside received historic designation in 1978");
    expect(housePageSource).toContain("President Benjamin Harrison Home");
    expect(housePageSource).toContain("Great Oak Commons");
    expect(housePageSource).toContain("Old Northside Historic Area Preservation Plan (1979)");
  });
});
