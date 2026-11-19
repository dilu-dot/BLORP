"""Two accounts in one tab, real editor writes and a delayed project response."""
import os
from playwright.sync_api import expect, sync_playwright
from studio_server import studio_server


def login(page, name, signup):
    page.locator("#authLaunch").click()
    if signup:
        page.locator('[data-auth-mode="signup"]').click()
        page.locator("#authName").fill(name)
    page.locator("#authEmail").fill(name + "@example.test")
    page.locator("#authPassword").fill("DisposableTest123!")
    page.locator("#authSubmit").click()
    expect(page.locator("#blorpAuthDialog")).not_to_be_visible()


def logout(page):
    page.locator("#profileTrigger").click()
    page.locator("#previewSignOut").click()
    expect(page.locator("#profileIdentityDetail")).to_have_text("Guest · sign in required")


with studio_server() as url, sync_playwright() as driver:
    browser = driver.chromium.launch(executable_path=os.getenv("BLORP_TEST_CHROME"))
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.route("**/api/local/models", lambda route: route.fulfill(json={"connected": False, "models": []}))
    page.goto(url)
    login(page, "WriterA", True)
    page.locator("#newProject").click()
    page.locator("#newProjectName").fill("Private project A")
    page.locator("#confirmProject").click()
    page.locator('[data-view="editor"]').click()
    project_id = page.locator("#editorProject").select_option(label="Private project A")[0]
    page.locator("#editorMakeStarter").click()
    marker = "<h1>Private source A</h1>"
    page.locator("#codeEditor").fill(marker)
    page.locator("#editorSave").click()
    expect(page.locator("#editorSaveState")).to_have_text("Saved to account")

    held = []
    def delay_response(route):
        held.append((route, route.fetch()))
    page.route("**/api/projects", delay_response)
    page.evaluate("() => {void BlorpBackend.loadProjects().catch(()=>{})}")
    page.wait_for_function("document.readyState === 'complete'")
    assert held and marker in held[0][1].text()
    logout(page)
    page.unroute("**/api/projects", delay_response)
    login(page, "WriterB", True)
    # A's held request belongs to the discarded document. Even a successful late reply
    # cannot run its callbacks in B's page.
    route, response = held.pop()
    route.fulfill(response=response)
    page.locator('[data-view="editor"]').click()
    expect(page.locator("#editorProject option")).to_have_count(1)
    expect(page.locator("#codeEditor")).to_have_value("")
    assert marker not in page.locator("#editorPreview").get_attribute("srcdoc")
    assert "Private project A" not in page.locator("body").inner_text()
    account = page.request.get(url + "/api/auth/me").json()["user"]["id"]
    files = {"index.html": "overwrite", "styles.css": "", "script.js": ""}
    assert page.request.post(url + "/api/projects/files", data={"account":account, "id":project_id, "files":files}).status == 404
    assert page.request.get(url+"/api/projects").json()["projects"] == []
    assert marker not in page.evaluate("JSON.stringify(localStorage) + JSON.stringify(sessionStorage)")
    logout(page)
    login(page, "WriterA", False)
    page.locator('[data-view="editor"]').click()
    page.locator("#editorProject").select_option(value=project_id)
    expect(page.locator("#codeEditor")).to_have_value(marker)
    browser.close()
