import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = fileURLToPath(new URL("../client/src/App.tsx", import.meta.url));
const appSource = readFileSync(appPath, "utf8");

describe("public-site navigation behavior", () => {
  it("returns visitors to the top when a route loads or changes", () => {
    expect(appSource).toContain('import { Link, Route, Switch, useLocation } from "wouter"');
    expect(appSource).toContain("function ScrollToTop()");
    expect(appSource).toContain("const [location] = useLocation()");
    expect(appSource).toContain("window.scrollTo(0, 0)");
    expect(appSource).toContain("}, [location])");
    expect(appSource).toContain("<ScrollToTop />");
  });
});
