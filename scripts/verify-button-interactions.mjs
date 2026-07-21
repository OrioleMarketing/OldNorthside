import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const results = [];

async function inspectControl(page, label, locator) {
  await locator.waitFor({ state: "visible" });
  await locator.focus();
  const focus = await locator.evaluate(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      radius: style.borderRadius,
      outline: style.outline,
      outlineOffset: style.outlineOffset,
      focusVisible: element.matches(":focus-visible"),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });

  const rect = focus.rect;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const hover = await locator.evaluate(element => {
    const style = getComputedStyle(element);
    return { hovered: element.matches(":hover"), transform: style.transform, backgroundColor: style.backgroundColor };
  });

  if (focus.radius !== "15px") throw new Error(`${label} radius was ${focus.radius}, expected 15px.`);
  if (!focus.focusVisible || focus.outline === "none") throw new Error(`${label} did not present a visible keyboard focus style.`);
  if (!hover.hovered) throw new Error(`${label} did not activate :hover.`);
  results.push({ label, focus, hover });
}

async function inspectViewport(name, viewport, isMobile) {
  const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

  await inspectControl(page, `${name}: hero Check availability`, page.getByRole("link", { name: "Check availability", exact: true }));
  await inspectControl(page, `${name}: booking Start over`, page.getByRole("button", { name: /Start over/i }));

  if (!isMobile) {
    await inspectControl(page, `${name}: header Book Direct`, page.locator('header a[href="/booking"]').first());
  } else {
    const menuButton = page.getByRole("button", { name: /menu|navigation/i }).first();
    if (await menuButton.count()) await inspectControl(page, `${name}: navigation menu`, menuButton);
  }

  const startOver = page.getByRole("button", { name: /Start over/i });
  await startOver.focus();
  await page.keyboard.press("Enter");
  await startOver.waitFor({ state: "visible" });
  results.push({ label: `${name}: Start over keyboard press`, passed: true });
  await context.close();
}

try {
  await inspectViewport("desktop", { width: 1280, height: 720 }, false);
  await inspectViewport("mobile", { width: 375, height: 812 }, true);
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  await browser.close();
}
