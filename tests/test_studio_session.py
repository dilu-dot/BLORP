"""Real loopback Studio smoke; install playwright + chromium, or set BLORP_TEST_BROWSER."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile
from playwright.sync_api import sync_playwright, expect

def main():
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as data:
        env = dict(os.environ, BLORP_DATA_DIR=data, BLORP_PORT="0")
        process = subprocess.Popen([sys.executable, str(root / "server.py")], env=env,
                                   stdout=subprocess.PIPE, text=True)
        try:
            url = process.stdout.readline().strip().split()[-1]
            assert url.startswith("http://127.0.0.1:")
            with sync_playwright() as engine:
                browser = engine.chromium.launch(executable_path=os.environ.get("BLORP_TEST_BROWSER"))
                page = browser.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                # Seed an old draft and make tab storage unavailable, as in restricted browser profiles.
                page.add_init_script("""
                  if (window === window.top) {
                  const key = 'blorp-frontend-unlocked-v2';
                  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({agents:[],groups:[],projects:[{id:'legacy-local'}]}));
                  Object.defineProperty(window,'sessionStorage',{get(){throw new Error('Tab storage unavailable')}});
                  }
                """)
                page.goto(url)
                page.locator("#authLaunch").click()
                page.locator('[data-auth-mode="signup"]').click()
                page.locator("#authName").fill("Studio audit")
                page.locator("#authEmail").fill("studio@example.test")
                page.locator("#authPassword").fill("Local-Test-Password-42")
                page.locator("#authSubmit").click()
                expect(page.locator("#blorpAuthDialog")).to_be_hidden()
                page.reload()
                page.locator("#profileTrigger").click()
                expect(page.locator("#profileIdentityName")).to_have_text("Studio audit")
                page.locator("#previewSignOut").click()
                expect(page.locator("#profileIdentityDetail")).to_contain_text("Guest")
                page.locator("#profileClose").click()
                page.locator("#authLaunch").click()
                page.locator("#authEmail").fill("studio@example.test")
                page.locator("#authPassword").fill("Local-Test-Password-42")
                page.locator("#authSubmit").click()
                expect(page.locator("#blorpAuthDialog")).to_be_hidden()
                expect(page.locator("#profileIdentityName")).to_have_text("Studio audit")
                assert page.evaluate("JSON.parse(localStorage.getItem('blorp-frontend-unlocked-v2')).projects[0].id") == "legacy-local"
                page.set_viewport_size({"width":390,"height":844})
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                assert not errors, errors
                browser.close()
        finally:
            process.terminate()
            process.wait(timeout=10)
            process.stdout.close()

if __name__ == "__main__":
    main()