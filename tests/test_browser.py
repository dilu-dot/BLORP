"""Check Studio V4.3 navigation, pricing and editor shell at desktop and phone widths."""
import os
from playwright.sync_api import expect, sync_playwright
from studio_server import studio_server

with studio_server() as url, sync_playwright() as driver:
    browser = driver.chromium.launch(executable_path=os.getenv("BLORP_TEST_CHROME"))
    for width in (1512, 1280, 390):
        page = browser.new_page(viewport={"width": width, "height": 844})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url)
        expect(page.locator("#projects")).to_be_visible()
        for view in ("builder", "multitask", "workflows", "chat", "membership", "editor"):
            if width < 680:
                page.locator("#menuBtn").click()
            page.locator(f'button[data-view="{view}"]').click()
            expect(page.locator("#" + view)).to_be_visible()
            if view == "membership":
                page.locator('[data-billing-cycle="yearly"]').click()
                expect(page.locator("#membership")).to_contain_text("$216")
            elif view == "editor":
                expect(page.locator("#codeEditor")).to_be_disabled()
                assert page.locator("#editorPreview").get_attribute("sandbox") == ""
        assert not errors, errors
        page.close()
    browser.close()
