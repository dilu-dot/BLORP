"""Exercise the promoted Studio over HTTP using a disposable account and database."""
import os
from playwright.sync_api import expect, sync_playwright
from studio_server import studio_server

with studio_server() as url:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.getenv("BLORP_TEST_CHROME"))
        for width in (1366, 390):
            page = browser.new_page(viewport={"width": width, "height": 844})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            email = f"studio-{width}@example.test"
            page.route("**/api/local/models", lambda route: route.fulfill(
                status=503, json={"error": "Test Ollama offline"}))
            page.goto(url)
            expect(page.locator("#profileIdentityDetail")).to_have_text("Guest · sign in required")
            for creating in (True, False):
                if width < 1080:
                    page.locator("#profileTrigger").click()
                    page.locator('[data-open-auth="signin"]').click()
                else:
                    page.locator("#authLaunch").click()
                if creating:
                    page.route("**/api/projects", lambda route: route.fulfill(
                        status=503, json={"error": "Test workspace unavailable"}))
                    page.locator('[data-auth-mode="signup"]').click()
                    page.locator("#authName").fill("Studio QA")
                page.locator("#authEmail").fill(email)
                page.locator("#authPassword").fill("DisposableTest123!")
                page.locator("#authSubmit").click()
                expect(page.locator("#blorpAuthDialog")).not_to_be_visible()
                page.unroute("**/api/projects")
                page.reload()
                expect(page.locator("#authLaunch")).to_have_text("Account ✓")
                page.locator("#authLaunch" if width >= 1080 else "#profileTrigger").click()
                expect(page.locator("#profileIdentityDetail")).to_contain_text(email)
                page.locator("#previewSignOut").click()
                expect(page.locator("#profileIdentityDetail")).to_contain_text("Guest")

            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), page.evaluate("Array.from(document.querySelectorAll('*')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>[e.id,e.className,e.getBoundingClientRect().right])")
            assert not errors, errors
            page.close()
        browser.close()
