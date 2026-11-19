# BLORP Studio integration audit

19 November 2026 · Issue #9 · Windows · base `4ea4c5b` on `feature/promote-studio-default-v43`.

## Scope and entry points

Reviewed the repository layout and history of the stacked Studio promotion, Python HTTP/SQLite service, Studio HTML and bridge scripts, Electron main/preload and native adapters, provider vault/discovery, local runtime, payment lifecycle, cloud source contracts, CI and tests. This is a first integration audit focused on boot and identity, not a line-by-line security certification. PR #3 supplies the design, #4–#7 stage checkout, server integration, keys and discovery, and #8 promotes the Studio. The root and explicit preview must still match. The legacy page retains its separate scripts.

## Prioritized findings and reproductions

| Priority | Finding and how to verify | Status |
|---|---|---|
| P0 | A localhost visit wrote the sanitized account state over the old browser draft key. The one-time backup omitted fields and could get stale. Seed a draft in the old key, open the server-backed root, sign in and reload, then compare the old record. | Fixed. Server-mode preferences use a separate key with a read-through for existing settings. No SQLite migration, bulk import or deletion. Existing backups are retained. |
| P1 | A valid server login could appear to fail when tab storage was unavailable: project selection restoration threw after the cookie had been issued. The draft backup also read optional storage outside a guard during boot. | Fixed. Exercise signup, reload, profile, logout and signin with the browser regression below. |
| P1 | Electron dev mode accepted any health response with `ok: true`, or silently opened the bundled demo when its configured server failed. A previous checkout on port 8765 could therefore be mistaken for this one. | Added a Studio identifier to health, validated it before local navigation, and made explicit backend selection fail visibly. The normal bundled entry remains available. Health identifies a compatible build, not a security credential. |
| P1 | Editor file maps, workflow runs and some device preferences remain in shared browser state. Inspect `ensureFileMap`, `persist` and the bridge payload whitelist. The server's project ownership checks cover stored projects; they do not establish account isolation for editor contents or asynchronous UI updates during account switching. | Open. Test with two accounts and delayed responses, specify an owner-scoped storage/migration contract, then wire editor save/reopen. Do not clear existing drafts to address this. |
| P1 | Default Electron opens the bundled preview. Legacy cloud/native renderer adapters are packaged but not imported by the premium root. The desktop source check still demanded those legacy imports in the promoted root. | Corrected entry-point checks. Desktop parity remains open. |
| P2 | Both historical browser scripts hard-code `/usr/bin/chromium` and assert legacy controls against the promoted root. On Windows both stop before the first page assertion. | New localhost browser test covers the premium auth path. Retarget legacy tests and port their fixtures separately. |
| P2 | Windows membership test cleanup kept the SQLite file open after its final transaction. `with sqlite3.connect(...)` alone does not close a connection. | Fixed explicit close in both fixtures. |
| P2 | Network inspection showed a 404 for favicon and a 503 on local model discovery without Ollama. Sign-in awaits discovery, adding delay even after credentials succeed. | Defer icon and decouple optional discovery from the auth dialog in phase 1. |

## Feature matrix

| Surface | Evidence and result |
|---|---|
| Root and legacy | Existing `tests/test_api.py` exercises real HTTP for `/`, `/index.html` and `/legacy-v53.html`. `tests/check_studio_inline.js` checks the two Studio copies and parses inline scripts. |
| Local account/profile | Real Chrome and Python using a fresh temp SQLite database: signup, authenticated reload, Profile, sign-out and password sign-in passed. No uncaught page errors in this flow. Projects at 390px had zero horizontal overflow. Other screens and malformed forms were not exhaustively exercised. |
| Projects | API suite passes authenticated save, read, delete and cross-account checks. Editor files and full project reopen through the UI remain partial. |
| Google and cloud | Optional configured identity verification exists. Electron PKCE test simulates a callback/token. Cloud migration/function source assertions pass. No live OAuth, cloud membership or deployed function was tested. |
| Local chat and models | Real model-discovery route returned 503 on the audit machine. Fake Ollama tests exercise the model list, chat, three-role pipeline and ZIP flow. No real model inference verified. |
| Provider keys | Python vault tests inject a fake protector. Discovery tests mock provider HTTP. Electron uses its own encrypted vault. No customer key, live inference or migration between vaults was tested. |
| Build Fast / Multi Task | The premium UI stages local previews. Native/backend implementations have mocked generation/artifact tests. Ordinary one-model production builds, editor round trip and durable specialist-only Multi Task orchestration remain incomplete. |
| Billing | Local fake-data tests cover server-issued five-minute attempts, expiry, duplicate UTRs, ownership, independent approval and entitlements. No funds, bank destination, QR scan, live checkout or production activation verified. |
| Packaging | Desktop source and mocked native/Model Hub suites pass. Electron binary install encountered ENOSPC; the graphical executable, warning dialog and packaged distribution were not run. Deno was unavailable for Edge TypeScript checks. |

## Reproduce on Windows

Use a separate clone. Keep your existing database and the other running server untouched.

```powershell
git clone --branch feature/promote-studio-default-v43 https://github.com/dilu-dot/BLORP BLORP-review
cd BLORP-review
git fetch origin codex/studio-startup-auth-audit
git switch --track origin/codex/studio-startup-auth-audit
git status -sb
git log -1 --oneline
$env:BLORP_DATA_DIR = Join-Path $env:TEMP ([guid]::NewGuid().ToString())
$env:BLORP_PORT = '0'
python server.py
```

Open the exact URL the process prints. In another PowerShell window query that origin's `/api/health` and check `studio` equals `blorp-v4.3`. Stop this foreground process with Ctrl+C. During the audit port 8765 already belonged to Python PID 13916; its checkout was unverified. The isolated smoke used 127.0.0.1:62560, PID 25148, then stopped. These are observations, not reusable port assignments.

```powershell
foreach ($suite in 'api','local_agents','memberships','payment_checkout','provider_vault','provider_discovery','cloud_backend') {
    python -X utf8 "tests/test_$suite.py"
    if ($LASTEXITCODE) { throw "$suite failed" }
}
node tests/check_studio_inline.js
npm run desktop:check
python -m venv .venv
.\.venv\Scripts\python -m pip install playwright
.\.venv\Scripts\python -m playwright install chromium
.\.venv\Scripts\python tests/test_studio_session.py
```

All seven individual Python suites passed with the Windows base interpreter. The browser regression also passed with installed Chrome via `BLORP_TEST_BROWSER`. JavaScript syntax checks across desktop, public assets and tests passed. Python unittest discovery is not the repository's suite runner: several scripts run at import, the legacy browser fixtures need a browser, and an initial discovery run reported Windows temp-file cleanup errors. Use the individual CI entry points above.

## Review sequence

1. Review the startup and auth/data-preservation fixes in this draft. Premium layout and existing checkout gates are preserved.
2. Finish phase 1 with account-switch races, project editor persistence and an actual Electron boot against both valid and stale ports.
3. Phase 2: verify real model inventory and one default before implementing opt-in inference. Design vault migration with account ownership and rollback.
4. Phase 3: one-model Build Fast with user-scoped files, entitlement checks and reopen tests.
5. Phase 4: Multi Task-only specialists with explicit budgets, cancellation and durable outputs.
6. Phase 5: independent security, payment configuration and release verification before any public deployment or activation.