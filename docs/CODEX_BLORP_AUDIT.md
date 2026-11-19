# BLORP Studio integration audit · Issue #9

Baseline: feature/promote-studio-default-v43 at 4ea4c5b. PR #3 supplied the standalone design. The stacked changes add timed checkout (#4), Studio/API wiring (#5), the provider vault (#6), catalog discovery (#7), then the Studio root and preserved legacy page (#8). Both Studio HTML copies match; the fixes are in their shared bridge. No schema or design migration.

## Findings in repair order

| Priority | Reproduction and consequence | Disposition |
|---|---|---|
| P0 triage | Launch a clean checkout on loopback with temporary SQLite storage. Request the root, both named pages, then create an account. | No unconditional startup crash reproduced. The existing HTTP smoke already checks all three routes. Existing customer database upgrades were not exercised. |
| P1 | Start with another listener on 8765. The backend can select another port; the prior banner identified V5.1 and Electron accepted any health response with ok=true. | Banner identifies V4.3, checkout path and actual URL. Health now identifies the Studio UI; Electron's explicit backend mode checks it. Desktop fallback still opens the offline shell. |
| P1 | Submit valid signup with the projects endpoint returning 503. SQLite creates the account and cookie, but the old UI keeps the login dialog open and presents the workspace failure as an auth failure. Selecting Account also used to reopen sign-in. | Fixed; desktop and mobile HTTP browser regression covers signup with failed project hydration, subsequent signin, reload, Profile and signout. Model discovery no longer blocks login. Late project-list results are discarded after account changes. |
| P1 | Inspect the write targets of build_frontend.py and patch_frontend.py. Both target the promoted public/index.html using legacy assumptions. | Avoid running either against this checkout. Move archival generation to an explicit scratch destination and verify the premium root checksum. |
| P1 | Use the Studio Build Fast control; inspect the timed progress sequence in public/index.html and compare it with local_runtime.build_website. | Studio progress/editor seeds are prototypes; the separate backend build uses architect, builder and reviewer prompts. Decouple specialist roles from ordinary Build Fast before connecting the UI. |
| P1 | Run npm run desktop:check. desktop/check.js expects cloud-desktop.js and other legacy renderer bundles in the promoted index. | Composite check fails. The individual native workspace and Model Hub suites pass with doubles. Restore runtime coverage of the actual renderer before claiming packaged parity. |
| P1 | Compare public/index.html persist() exclusions with editor draft and run persistence. The browser preferences are origin-wide, while database project access is user-scoped. | Audit remaining editor, run, group and payment UI state across account switches, including in-flight saves/chat and session expiry. Do not migrate or erase offline drafts implicitly. |
| P2 | Run tests/test_browser.py or test_local_ui.py. Both assume /usr/bin/chromium, set HTML content directly and query legacy selectors. | Keep legacy coverage on the legacy HTTP route. New Studio browser test uses a real server and a fresh browser context. |
| P2 | Open Studio through HTTP with Ollama stopped. The status request returns 503; the shell still contains offline copy. Browser also requests missing favicon.ico. | Clarify connection status per feature; revisit console diagnostics when navigating away during discovery. |

## Feature matrix

| Area | Evidence and scope |
|---|---|
| Working locally | tests/test_api.py covers root/index/legacy, cookie sessions, project persistence and account isolation over HTTP. tests/test_studio_browser.py exercised real email auth in installed Chrome at 1366 and 390 pixels, with zero uncaught page errors or horizontal overflow in those flows. Project and model failure paths in that test are injected. |
| Partial | Studio chats with the Python Ollama route. No local Ollama listener responded during the baseline check. tests/test_local_agents.py verifies the API and ZIP using a fake Ollama. Generated code execution and live model quality were not tested. |
| Partial | provider_vault.py and provider_discovery.py implement scoped credentials and bounded discovery. Vault and mocked discovery tests pass. A listed model is not proof of inference. Electron has a separate vault. No real provider keys were used. |
| Partial | payment_checkout.py and tests/test_memberships.py enforce timed attempts, duplicate references, pending status and owner verification using synthetic payment data. No bank destination, QR or transfer verified. |
| Preview / missing | Build Fast progress, inline editor drafts and Multi Task orchestration in the default UI. /api/agents/run fails closed. No durable end-to-end specialist execution demonstrated. |
| Conditional / unverified | Google needs configured OAuth. Supabase SQL and Edge sources pass the Python contract check; live services, Deno checks, packaged Electron, installer and production billing were not verified locally. |

## Reproduce on Windows

From a fresh clone, use PowerShell:

~~~powershell
git switch codex/blorp-integration-audit
git status -sb
git log -1 --oneline
$env:BLORP_DATA_DIR = Join-Path $env:TEMP ("blorp-audit-" + [guid]::NewGuid())
$env:BLORP_PORT = "0"
python server.py
~~~

Use the printed URL for Studio and append /legacy-v53.html for the old dashboard. Ctrl+C stops that console's process. At audit start, loopback port 8765 already belonged to python.exe PID 20920; its command line used a relative server.py, so its checkout was unknown. It was left running.

Run these from the repository root with a standard Python installation. On this Windows host, terminating a redirected virtual-environment Python subprocess could leave the temporary SQLite file locked. The base CPython interpreter passed API, membership and browser tests.

~~~powershell
$env:PYTHONUTF8 = "1"
python -m compileall -q .
foreach ($name in 'api','local_agents','memberships','payment_checkout','provider_vault','provider_discovery','cloud_backend') {
    python "tests/test_$name.py"
    if ($LASTEXITCODE) { throw "Failed $name" }
}
python -m pip install playwright
python -m playwright install chromium
python tests/test_studio_browser.py
node tests/check_studio_inline.js
node desktop/native-workspace.test.js
node desktop/model-hub.test.js
npm run desktop:check
~~~

The last command reproduces the outstanding renderer check. Alternatively set BLORP_TEST_CHROME to an installed Chrome executable for the browser test. All tracked public asset and desktop JS files passed node --check. The old browser suites initially stopped at missing Playwright and have not been certified. Linux CI includes the new HTTP browser test; local Chrome evidence does not establish a green hosted run.

## Next incremental changes

1. Close the remaining Phase 1 account-switch and editor persistence gaps with a two-user browser test; isolate old build utilities. Restore desktop/legacy QA against their actual entry points.
2. Verify Model Hub defaults and catalog/inference boundaries with vendor mocks. Design vault migration separately.
3. Wire single-model Build Fast to scoped artifacts, editor/reopen and backend entitlements.
4. Implement specialist orchestration only in Multi Task. Gate release, payments and deployment on separate verification and owner approval.

## Session isolation follow-up (stacked on PR #10)

The localhost editor stores its three source files in a nullable editor_files column on the existing account/project row. Normal chat and project metadata updates leave that column intact. The additive migration preserves pre-existing rows. Old unowned browser drafts remain in their original storage; the signed-in editor does not guess which account owns them. Back up the original browser profile before attempting any historical draft recovery. The offline preview keeps its existing browser save path.

The server serializes each snapshot in one SQLite update; the editor queues writes in their original order. Across concurrent editor tabs the last completed save wins. A successful signout opens a fresh document; other open Studio tabs refresh on an account change. Authenticated bridge requests carry the expected account ID so a stale tab cannot use a different account's cookie to save a project. The server still authenticates with its session cookie.

The browser suites start the absolute checkout/server.py path on an OS-assigned loopback port, validate the banner and health marker, and stop that PID. StudioServer rejects competing binds. On the Windows audit host two older processes reported port 8765 from D:/BLORP-main and E:/BLORP-main. Both were left alone.

Run the four browser scripts test_studio_browser.py, test_editor_isolation.py, test_browser.py and test_local_ui.py under tests/ with the Playwright setup above. The new isolation case uses one browser context, two accounts, two tabs, a held project-list response, a real editor save, and a rejected stale write. Electron's source checks distinguish the promoted renderer from the preserved legacy page; running the packaged binary remains separate QA.
