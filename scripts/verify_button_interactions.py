import json
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:3000")
results = []


def inspect_control(page, label, locator):
    locator.wait_for(state="visible")
    locator.scroll_into_view_if_needed()
    locator.focus()
    focus = locator.evaluate(
        """element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            radius: style.borderRadius,
            outline: style.outline,
            outlineOffset: style.outlineOffset,
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
          return {hovered: element.matches(':hover'), transform: style.transform, backgroundColor: style.backgroundColor};
        }"""
    )
    if focus["radius"] != "15px":
        raise AssertionError(f"{label} radius was {focus['radius']}, expected 15px.")
    if not focus["focusVisible"] or focus["outline"] == "none":
        raise AssertionError(f"{label} did not present a visible keyboard focus style.")
    if not hover["hovered"]:
        raise AssertionError(f"{label} did not activate :hover.")
    results.append({"label": label, "focus": focus, "hover": hover})


def inspect_viewport(browser, name, viewport, mobile):
    context = browser.new_context(viewport=viewport, is_mobile=mobile, has_touch=mobile)
    page = context.new_page()
    try:
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        inspect_control(page, f"{name}: hero Check availability", page.get_by_role("link", name="Check availability", exact=True))
        inspect_control(page, f"{name}: booking Start over", page.get_by_role("button", name="Start over"))
        if not mobile:
            inspect_control(page, f"{name}: header Book Direct", page.get_by_role("link", name="Book Direct", exact=True).first)
        else:
            menu = page.get_by_role("button", name="Open navigation")
            if menu.count():
                inspect_control(page, f"{name}: navigation menu", menu)
        start_over = page.get_by_role("button", name="Start over")
        start_over.focus()
        page.keyboard.press("Enter")
        start_over.wait_for(state="visible")
        results.append({"label": f"{name}: Start over keyboard press", "passed": True})
    finally:
        context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    try:
        inspect_viewport(browser, "desktop", {"width": 1280, "height": 720}, False)
        inspect_viewport(browser, "mobile", {"width": 375, "height": 812}, True)
    finally:
        browser.close()

print(json.dumps({"passed": True, "results": results}, indent=2))
