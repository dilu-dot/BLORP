# BLORP Studio → localhost backend integration (Phase 2)

This branch builds on PR #4's **server-enforced 5-minute checkout** and imports the approved premium Studio HTML from PR #3 **without replacing `public/index.html`**.

## Preview URL

1. On the Phase 2 branch run `python server.py` from the repository root.
2. Open **http://127.0.0.1:8765/blorp-studio-subscriptions-preview.html** (if the server chooses a fallback port, use that port instead).
3. **Do not open the HTML with file://** to test backend functionality: file:// retains the intentionally offline demonstration.
4. Create a local BLORP account or sign in. Google is available only after the owner configures `BLORP_GOOGLE_CLIENT_ID` and installs `requirements-google.txt` dependencies.
5. Create a project, select it in Workspace Playground, and choose an Ollama model from the installed-model suggestions.
6. Start Ollama with an installed model, for example `ollama pull qwen2.5-coder:3b`, then reload Studio or call `window.BlorpBackend.discoverModels()` in the browser console. The Workspace chat calls the real `/api/local/chat` endpoint; agent groups are **not** automatically started.
7. In Membership, select a plan and Subscribe. The real checkout API requires owner-configured QR, UPI ID and exact INR prices. A server-issued attempt expires after five minutes, and payment remains pending until verified by the owner. Never trust or publicly deploy an unverified image.

## What is connected

| Studio feature | Backend |
| --- | --- |
| Email sign-up / sign-in / sign-out | `/api/auth/signup`, `/api/auth/signin`, `/api/auth/signout`, `/api/auth/me` |
| Google sign-in (when configured) | Google Identity Services → verified `/api/auth/google` |
| Account plan & credits | authenticated `/api/auth/me` |
| Project CRUD | `GET/POST/DELETE /api/projects` (account scoped) |
| Workspace project conversations | Saved in each account's SQLite project payload (last 10 trimmed messages) |
| Installed Ollama models | `GET /api/local/models` |
| Single-model Workspace chat | `POST /api/local/chat` (real local Ollama inference; no automatic specialist agents) |
| Subscribe / QR / five-minute UTR | `POST/GET /api/billing/attempt`, `GET /api/billing/qr`, `POST /api/billing/request` |
| Manual membership approval | Existing owner-only `/api/owner/payments/decision` |

## Offline versus localhost

The standalone HTML's old email, Google, chat and UTR demonstrations run **only under file://**. On localhost the new `public/assets/studio-backend-bridge.js` handles these interactions and prevents the simulated paths. This distinction is intentional.

Legacy browser drafts are **not** automatically uploaded into a new account. The first localhost Studio visit backs up existing local project data under `blorp-local-projects-pre-backend-backup-v1`. Authenticated project messages and project records are excluded from the frontend's localStorage snapshot; account-scoped data comes from SQLite. Never put API key secrets into the browser.

## Not connected / pending

- Secure API provider key vault and real hosted-provider inference in the browser. All provider entries inside Studio remain **drafts**; the bridge supports local Ollama only.
- Multi Task specialist orchestration in this premium frontend. Group configuration remains a draft, and the existing server's `/api/agents/run` is intentionally disabled.
- Real Studio editor filesystem persistence, cross-device cloud sync, and collaborative project work.
- Fully deployed, hardened public authentication, session recovery, secure public web hosting, rate limits and production subscription infrastructure.
- Automatically verified UPI transfers. Even a valid-looking UTR **never** proves payment or activates a plan.

## Security and review

BLORP's Python server is bound to `127.0.0.1` and intended for local development. Client-side membership badges/credits are informational: server-side membership and owner-role checks remain authoritative.

Review this draft PR and the test workflow before merging; do **not** publicly deploy, enable payments, or automatically merge without a production security and compliance review. For Windows testing, run `python tests/test_api.py`, `python tests/test_memberships.py`, `python tests/test_local_agents.py`, `python tests/test_payment_checkout.py`, and `node --check public/assets/studio-backend-bridge.js`.
