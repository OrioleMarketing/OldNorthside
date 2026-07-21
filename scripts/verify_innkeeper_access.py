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


def verify_viewport(browser, name, viewport, mobile):
    context = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile)
    page = context.new_page()
    try:
        login(page)
        if mobile:
            page.goto(f"{BASE_URL}/owner/access", wait_until="networkidle")
        else:
            access_link = page.get_by_text("Innkeeper access", exact=True).first
            access_link.wait_for(state="attached", timeout=15000)
            access_link.click()
        page.get_by_role("heading", name="Innkeeper access").wait_for(timeout=15000)
        page.get_by_role("button", name="Create secure invitation", exact=True).wait_for(timeout=15000)
        page.get_by_role("heading", name="Current innkeeper administrators").wait_for(timeout=15000)
        page.get_by_role("heading", name="Recent invitations").wait_for(timeout=15000)

        action = page.get_by_role("button", name="Create secure invitation", exact=True)
        action.evaluate("element => { element.tabIndex = 0; }")
        for _ in range(40):
            page.keyboard.press("Tab")
            if action.evaluate("element => document.activeElement === element"):
                break
        if not action.evaluate("element => document.activeElement === element"):
            raise AssertionError(f"{name} could not reach the invitation action by keyboard navigation")
        focus = action.evaluate(
            """element => {
              const style = getComputedStyle(element);
              return { radius: style.borderRadius, outlineStyle: style.outlineStyle, focusVisible: element.matches(':focus-visible') };
            }"""
        )
        if focus["radius"] != "15px" or not focus["focusVisible"] or focus["outlineStyle"] == "none":
            raise AssertionError(f"{name} invitation action lacks expected keyboard focus styling: {focus}")
        results.append({"label": f"{name}: authenticated Innkeeper access page", "focus": focus})
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
