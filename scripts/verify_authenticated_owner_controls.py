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


def move_keyboard_focus_to(page, locator, label):
    locator.wait_for(state="visible", timeout=15000)
    locator.scroll_into_view_if_needed()
    for _ in range(120):
        page.keyboard.press("Tab")
        if locator.evaluate("element => document.activeElement === element"):
            return
    raise AssertionError(f"{label} could not be reached through keyboard navigation")


def inspect_control(page, label, locator):
    move_keyboard_focus_to(page, locator, label)
    focus = locator.evaluate(
        """element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            radius: style.borderRadius,
            outlineStyle: style.outlineStyle,
            focusVisible: element.matches(':focus-visible'),
            rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
          };
        }"""
    )
    locator.hover()
    hover = locator.evaluate("element => ({hovered: element.matches(':hover'), transform: getComputedStyle(element).transform})")
    if focus["radius"] != "15px":
        raise AssertionError(f"{label} radius was {focus['radius']}, expected 15px")
    if not focus["focusVisible"] or focus["outlineStyle"] == "none":
        raise AssertionError(f"{label} did not present a visible keyboard focus style: {focus}")
    if not hover["hovered"]:
        raise AssertionError(f"{label} did not activate :hover")
    results.append({"label": label, "focus": focus, "hover": hover})


def inspect_if_present(page, label, locator):
    if locator.count():
        inspect_control(page, label, locator.first)
    else:
        results.append({"label": label, "skipped": "No matching live reservation currently exposes this conditional control."})


def verify_viewport(browser, name, viewport, mobile):
    context = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile)
    page = context.new_page()
    try:
        login(page)
        inspect_control(page, f"{name}: Add reservation", page.get_by_role("button", name="Add reservation", exact=True))
        inspect_control(page, f"{name}: Block dates", page.get_by_role("button", name="Block dates", exact=True))
        inspect_control(page, f"{name}: Save booking settings", page.get_by_role("button", name="Save booking settings", exact=True))
        reminder_control = page.get_by_role("button", name="Activate reminders", exact=True)
        if not reminder_control.count():
            reminder_control = page.get_by_role("button", name="Pause reminders", exact=True)
        inspect_control(page, f"{name}: reminder schedule control", reminder_control)
        inspect_if_present(page, f"{name}: Send balance reminder", page.get_by_role("button", name="Send balance reminder", exact=True))
        inspect_if_present(page, f"{name}: Send secure payment link", page.get_by_role("button", name="Send secure payment link", exact=True))
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
