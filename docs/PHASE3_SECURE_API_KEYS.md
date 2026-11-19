# BLORP — Phase 3.1: Secure local provider credentials

This branch adds **secure API-key registration** to the Python localhost Studio preview. It depends on the existing Phase 2 Studio backend branch (PR #5). It intentionally does **not** implement provider inference, live provider health checks, remote model discovery, or autonomous specialists yet.

## What is connected

- Signed-in BLORP accounts can list, save/replace, and remove provider API keys.
- The supported providers are OpenAI, Google AI Studio/Gemini, Anthropic, OpenRouter, Groq, Mistral and NVIDIA NIM.
- The Python server on Windows encrypts each account's key vault with **Windows Data Protection API (DPAPI), scoped to the current Windows user**. Ciphertexts live under the configured BLORP data directory in \`provider-credentials/<user-id>.dpapi\`.
- Provider key contents are **not stored in SQLite**, placed into exported HTML/config, returned by API responses, or copied to browser localStorage.
- No OS-protected storage means **no key saving**. Linux/macOS localhost endpoints fail closed for writes; listing reports unavailable.
- Supported provider-key entries appear in API Keys and Model Hub as **Saved · not verified**. Until Phase 3.2, they do not unlock model selection or provider inference.
- Existing localhost sign-in/out controls the provider vault view. Browser-side provider drafts do not override the server's authenticated list.
- Existing Electron desktop has a **separate** encrypted Model Hub vault tied to its cloud account. This phase does not migrate or synchronize credentials between the two applications.

## Windows test

Use a Windows PC on the feature branch with Python installed:

\`\`\`powershell
cd D:\BLORP
git fetch origin
git switch feature/phase3-secure-provider-keys
python tests/test_provider_vault.py
python tests/test_api.py
python server.py
\`\`\`

Open \`http://127.0.0.1:8765/blorp-studio-subscriptions-preview.html\` (or the selected port), sign in, select **API Keys → Add Key**, select one supported provider, paste its real API key, enter a label, and save. Check the **API Keys** list and **Model Hub**: it should say **Saved — not verified**, **not Healthy**. Refresh the browser and verify the same provider remains visible. Remove it and verify it disappears.

**Never paste a live key into a standalone \`file://\` HTML preview.** That mode deliberately keeps the input disabled and offers metadata-only drafts.

## Local API contract

All requests require a real BLORP sign-in session. Credential changes also require an exact localhost **Origin** and **Host** header; the server is bound to \`127.0.0.1\`.

- \`GET /api/provider-keys\`: Returns \`storage_available\`, \`storage\`, \`live_verification:false\`, and \`providers\`. Each item includes only a provider ID, display name, label, save time, and \`status:"saved_not_verified"\`.
- \`POST /api/provider-keys\`: \`{"provider":"openai","key":"<secret>","label":"My key"}\`. Validates the provider and key; writes Windows-encrypted storage; responds with confirmation only (never the key).
- \`POST /api/provider-keys/remove\`: \`{"provider":"openai"}\`. Deletes the key for the authenticated account.

These are **local development endpoints only**, not remote SaaS credentials storage. Providers are chosen from an allowlist; custom URLs and arbitrary endpoints are not accepted. No actual provider network requests are issued in this phase.

## Security and limits

Windows DPAPI protects the stored bytes at rest for the current Windows OS user. It is **not a hardware-backed cloud KMS**, and malware running as the same Windows user can potentially access the user's secrets. The Python server is intended for one local Windows user, not a public multi-tenant service.

The account's session cookie must remain private. The server uses same-origin checks, session-scoped authorization, input validation, atomic file writes, and per-user change limits. Real provider health, key rotation, audit trails, cloud tenancy, encryption recovery, CSRF token hardening, and credential migration from the Electron vault are future work.

**No provider key was uploaded to GitHub.** Tests use fake keys and a reversible *test-only* protector injected into the unit tests; production never falls back to it.

## Next increment

**Phase 3.2 — Provider Model Discovery & Verification.** Add supported fixed-endpoint verification, live discovery and user-visible quota/connection errors. Only then make available provider models selectable in the real Model Hub. Do not mark a provider Healthy merely because its secret was saved.
