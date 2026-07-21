import json
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "").rstrip("/")
PASSWORD = os.environ.get("INITIAL_ADMIN_PASSWORD")
EMAIL = os.environ.get("INITIAL_ADMIN_EMAIL", "bruce@oriolemarketing.com")

if not BASE_URL:
    raise SystemExit("E2E_BASE_URL is required")
if not PASSWORD:
    raise SystemExit("INITIAL_ADMIN_PASSWORD must be supplied securely")

results = []


def login(page):
    page.goto(f"{BASE_URL}/owner", wait_until="networkidle")
    if page.get_by_role("heading", name="Innkeeper sign in").count():
        page.get_by_label("Email address").fill(EMAIL)
        page.get_by_label("Password").fill(PASSWORD)
        page.get_by_role("button", name="Sign in securely", exact=True).click()
    page.get_by_role("heading", name="Reservation calendar").wait_for(timeout=15000)
    if not page.url.startswith(f"{BASE_URL}/owner"):
        raise AssertionError(f"Local innkeeper sign-in did not remain on the owner route: {page.url}")


def inspect_control(page, label, locator):
    locator.wait_for(state="visible", timeout=15000)
    locator.scroll_into_view_if_needed()
    locator.focus()
    focus = locator.evaluate(
        """element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            radius: style.borderRadius,
            outline: style.outline,
            focusVisible: element.matches(':focus-visible'),
            rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
          };
        }"""
    )
    rect = focus["rect"]
    page.mouse.move(rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2)
    hover = locator.evaluate(
        """element => {
          const style = getComputedStyle(element);
          return {hovered: element.matches(':hover'), transform: style.transform};
        }"""
    )
    if focus["radius"] != "15px":
        raise AssertionError(f"{label} radius was {focus['radius']}, expected 15px")
    if not focus["focusVisible"] or focus["outline"] == "none":
        raise AssertionError(f"{label} did not present a visible keyboard focus style")
    if not hover["hovered"]:
        raise AssertionError(f"{label} did not activate :hover")
    results.append({"label": label, "focus": focus, "hover": hover})


def verify_viewport(browser, name, viewport, mobile):
    context = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile)
    page = context.new_page()
    try:
        login(page)
        controls = [
            ("Add reservation", page.get_by_role("button", name="Add reservation", exact=True)),
            ("Block dates", page.get_by_role("button", name="Block dates", exact=True)),
            ("Save booking settings", page.get_by_role("button", name="Save booking settings", exact=True)),
            ("Sign out", page.get_by_role("button", name="Sign out", exact=True)),
        ]
        for label, locator in controls:
            inspect_control(page, f"{name}: {label}", locator)
        results.append({"label": f"{name}: authenticated owner route", "passed": True})
    finally:
        context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    try:
        verify_viewport(browser, "desktop", {"width": 1280, "height": 720}, False)
        verify_viewport(browser, "mobile", {"width": 375, "height": 812}, True)
    finally:
        browser.close()

print(json.dumps({"passed": True, "results": results}, indent=2))
