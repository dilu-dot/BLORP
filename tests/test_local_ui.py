"""Exercise the Studio local-model registration UI without downloading a model."""
import os
from playwright.sync_api import expect, sync_playwright
from studio_server import studio_server

with studio_server() as url, sync_playwright() as driver:
    browser = driver.chromium.launch(executable_path=os.getenv("BLORP_TEST_CHROME"))
    for width in (1512, 390):
        page = browser.new_page(viewport={"width": width, "height": 844})
        page.goto(url)
        if width < 680:
            page.locator("#menuBtn").click()
        page.locator('[data-view="localai"]').click()
        page.locator("#localai [data-add-local-llm]").click()
        page.locator("#localLLMName").fill("test-model:local")
        page.locator("#localLLMDefaultCheck").check()
        page.locator('#localLLMForm button[type="submit"]').click()
        expect(page.locator("#localLLMCount")).to_have_text("1")
        expect(page.locator("#localDefaultCurrent")).to_contain_text("test-model:local")
        page.close()
    browser.close()
