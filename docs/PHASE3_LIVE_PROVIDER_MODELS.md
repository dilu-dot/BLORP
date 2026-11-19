# BLORP Phase 3.2 — Live provider verification and model catalogs

This **draft branch** builds directly on Phase 3.1 (PR #6) and keeps GitHub \`main\` unchanged. It adds provider model discovery through the existing Python localhost server and populates the existing premium Studio Model Hub with real returned model IDs.

## How it works

1. Run BLORP on **Windows localhost** and sign in through BLORP.
2. In **API Keys**, save one provider API key via the Windows DPAPI encrypted vault (Phase 3.1).
3. Click **Verify & Discover** beside that provider.
4. BLORP retrieves the secret **inside the Python process** and sends a server-side HTTPS request to that provider's fixed, allowlisted official catalog API. The browser never receives the key.
5. The result appears on the API Keys card. Model Hub lists only model IDs returned by a checked catalog. Models are in-memory discovery data and **not** a completed provider inference integration.
6. Recheck any time. Recent results are cached **in server RAM only** for up to 10 minutes, scoped to the signed-in account and saved provider. Replacing/removing a key invalidates its cached result. Restarting the backend clears catalog results.

## Provider endpoints

| Provider | Fixed endpoint | How status is determined |
| --- | --- | --- |
| OpenAI | GET \`https://api.openai.com/v1/models\` | Authenticated catalog check, **not proof of model usage/quotas** |
| Google AI Studio | GET \`https://generativelanguage.googleapis.com/v1beta/models?pageSize=100\` | Uses \`x-goog-api-key\`, filters for \`generateContent\` |
| Anthropic | GET \`https://api.anthropic.com/v1/models?limit=100\` | Uses \`x-api-key\` and version header |
| OpenRouter | GET \`https://openrouter.ai/api/v1/key\`, then \`/api/v1/models\` | The **authenticated /key check** is required because model listing can be public |
| Groq | GET \`https://api.groq.com/openai/v1/models\` | Authenticated catalog check |
| Mistral | GET \`https://api.mistral.ai/v1/models\` | Authenticated catalog check |
| NVIDIA NIM | GET \`https://integrate.api.nvidia.com/v1/models\` | Marked **public catalog only**; does **not** establish validity of the API key |

An HTTP 200 model list does not prove a specific model supports chat, is available under the current organization, has remaining quota, or can be used in an agent. NVIDIA's catalog may be publicly readable and is never labeled key-verified from this endpoint.

## Status labels

- **Authenticated catalog · inference untested**: a model catalog was retrieved through a provider-authenticated endpoint. This does not prove successful inference.
- **Public catalog · key unverified**: the catalog was retrieved but the API key's validity is not established (NVIDIA).
- **Key rejected**: provider returned HTTP 401.
- **Access restricted**: provider returned HTTP 403.
- **Rate limited**: provider returned HTTP 429.
- **Provider unavailable**: network/timeout/bad JSON/upstream error.
- **Not checked**: saved key exists, but no current discovery result.

## Server endpoints

- \`GET /api/provider-models\`: authenticated, returns only cached non-secret model discovery results owned by the current user.
- \`POST /api/provider-models/discover\`, JSON \`{"provider":"openai"}\`: authenticated, same-origin, exact localhost Host, bounded rate, fixed outbound destination. Returns sanitized status and an array of \`{"id":"...","name":"..."}\` objects. The caller **does not send the API key or a URL**.
- Original \`GET/POST /api/provider-keys\` and \`POST /api/provider-keys/remove\` remain unchanged except that credential changes invalidate discovery results.

## Safety and limits

- No user-supplied URLs, custom headers, URLs embedded in model IDs, or redirects.
- HTTPS certificates are validated; environment proxies and HTTP redirects are disabled.
- Strict request timeouts, 3 MB response limit, up to 250 models and at most three Gemini/Anthropic pages per check.
- Provider HTTP error bodies and auth headers are never returned or logged; no error can dump the key.
- Account-scoped in-memory cache (10-minute expiry), rate limiting, max 3 simultaneous network checks.
- Saved credential rotation is checked during discovery, so an old key's result is discarded.
- No prompt inference, chargeable test calls, purchase, membership grant, or automatic specialist execution is performed.
- Browser localStorage stores **no** account API secrets or discovered provider credentials.

## Test on Windows

\`\`\`powershell
cd D:\BLORP
git fetch origin
git switch feature/phase3-live-provider-model-discovery
python tests/test_provider_vault.py
python tests/test_provider_discovery.py
python tests/test_api.py
node tests/check_studio_inline.js
node --check public/assets/studio-provider-keys.js
python server.py
\`\`\`

Open \`http://127.0.0.1:8765/blorp-studio-subscriptions-preview.html\` (adjust port to whatever server prints), sign in, add a provider key, then click Verify & Discover. Check API Keys and Model Hub. Remove the key and verify models disappear. If the key is rejected, models must **not** appear. Test reloading the page and restarting the server.

**Real-provider end-to-end checks cannot run in CI without user's private API keys; CI uses mocked provider responses only.** Never paste private keys in test scripts or GitHub Secrets for this local proof-of-concept.

## Next increment

**Phase 3.3:** Optional controlled inference test (with explicit user consent and cost warning), model capability filtering, live model routing and exclusive Multi Task agent assignment enforced by backend. This phase does not mark an AI model executable or charge users merely from catalog discovery.
