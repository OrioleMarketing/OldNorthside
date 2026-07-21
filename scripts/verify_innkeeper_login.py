import os
import sys
from playwright.sync_api import sync_playwright

base_url = os.environ.get("E2E_BASE_URL", "").rstrip("/")
password = os.environ.get("INITIAL_ADMIN_PASSWORD")
if not base_url:
    raise SystemExit("E2E_BASE_URL is required")
if not password:
    raise SystemExit("INITIAL_ADMIN_PASSWORD must be supplied securely")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    page.goto(f"{base_url}/owner", wait_until="networkidle")
    page.get_by_role("heading", name="Innkeeper sign in").wait_for()
    page.get_by_label("Email address").fill("bruce@oriolemarketing.com")
    page.get_by_label("Password").fill(password)
    page.get_by_role("button", name="Sign in").click()
    page.get_by_role("heading", name="Reservation calendar").wait_for(timeout=15000)
    expected_origin = base_url
    actual_origin = page.url.split("/owner", 1)[0].rstrip("/")
    if actual_origin != expected_origin or not page.url.startswith(f"{base_url}/owner"):
        raise AssertionError(f"Innkeeper login left the website owner route: {page.url}")
    if not page.get_by_text("Bruce A Mayo", exact=True).count():
        raise AssertionError("Signed-in administrator identity was not rendered")
    print("Verified browser-based local innkeeper sign-in and protected owner dashboard access.")
    browser.close()
