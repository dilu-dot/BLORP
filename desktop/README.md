# Blorp AI 0.5.8 — Local Multi-Agent Studio + Manual UPI Cloud Preview

## What works
- Supabase email/password and configured Google sign-in.
- Actual native local chat via installed Ollama model; locally stored chat files.
- Real HTML/CSS/JS project creation and file editor on the customer's PC.
- **Three-stage sequential local website agents**: Architect writes plan, Builder generates source, QA reviewer critiques it using the same Ollama model. They do NOT execute or test the generated code.
- Local isolated website preview (source must be reviewed before publishing).
- Cloud membership and a manually verified UPI request form: owner-configured prices and UPI instructions, customer-entered payer name/UTR, pending status; **no automatic confirmation**.

## Setup
1. Install Ollama from https://ollama.com/download/windows.
2. Run `ollama pull qwen2.5-coder:3b` in PowerShell.
3. Open the 0.5.8 portable EXE, sign in, select Local AI Studio, then Refresh models.
4. Use AI Chat or Website Builder. Open projects in My Projects.
5. For UPI, select Membership & UPI. Payment remains unavailable until the private Owner configures an actual UPI ID and four plan prices.

## Limits
- This is **not** a finished cloud AI or payment gateway. UTR is a manual claim. Owner must confirm real funds in the bank statement before approval.
- Multi-agent flow is sequential model calls, not autonomous terminal commands, isolated worktrees or integration tests.
- Customer chats/projects are on the local PC, never in Supabase.
- Generated HTML/JS is untrusted. No general shell or OS command execution is provided.
- Private Devo Engine Owner source is never bundled in this public EXE.

## Cloud AI status (0.5.9)
An authenticated OpenRouter cloud chat path is now available via the JWT-protected `blorp-ai` Edge Function. The model is `openai/gpt-4o-mini`. It is restricted to active Builder/Studio plans, with a server-side request quota of 20/60 requests per UTC day. The OpenRouter API key MUST be configured as a **Supabase Edge Function secret** named `BLORP_OPENROUTER_API_KEY`; never bundle it in either desktop app or repo. Without a secret, Cloud AI is safely disabled. Generated websites still require a local Ollama model. User chat transcripts remain on the local Windows device; cloud requests temporarily transmit the prompt to OpenRouter for inference.

## Final cloud setup for administrators (November 18, 2026)
- Cloud AI Edge Function: `blorp-ai` deployed to Supabase project `piwcwmspjhtalryzpkez`. Auth JWT verification is ON.
- To **enable** paid cloud AI, create a provider API key at https://openrouter.ai/settings/keys and store it as Supabase Edge Function secret `BLORP_OPENROUTER_API_KEY` in the project Dashboard. Never paste it into this repository or either desktop EXE.
- Set an OpenRouter key spending limit. Backend also caps Builder to 20 and Studio to 60 requests per UTC day. Provider failures can consume daily request allowance.
- The Owner app is private and separate: `dilu-dot/Devo-Engine` 0.6.1. Google Owner OAuth requires additional Supabase redirect `http://127.0.0.1:47857/devo-auth/callback`.
- Real prices/UPI are initially unconfigured; the private Owner must enter values and verify a bank payment before granting membership.
- Google login / the actual payment flow / cloud model calls must each be tested end-to-end on Windows before broader public launch.

## Blorp Model Hub 0.6.0

**Default Blorp local LLM:** Select **Model Hub → Install Blorp**, then Balanced (~3.4 GB Qwen3.5 4B, Apache 2.0) or Lite (~986 MB Qwen2.5-Coder 1.5B, Apache 2.0). Ollama must first be installed and running. Installation downloads the chosen model from Ollama into the **user's computer** and creates an Ollama model alias `blorp:latest` with a Blorp system prompt. No large model files or weights are committed to GitHub or bundled in the EXE.

**Add multiple APIs:** Model Hub supports separate provider keys for OpenAI, OpenRouter, Groq, Mistral, NVIDIA NIM, Google Gemini and Anthropic. Fixed official HTTPS endpoints, no arbitrary custom URLs. API keys are encrypted with the OS credential service via Electron `safeStorage`. If OS encryption is unavailable, storing provider keys is refused.

**Set model by job:** Configure Chat, Architect, Landing Page, Frontend, Three.js, Animations and QA independently. **BLORP Auto** in the model dropdown selects the configured route. The agent pipeline calls Architect, task-specific Builder and QA with their respective models, which can span different APIs. API costs are paid through the user's connected providers, not included in the subscription. Users must set provider spending limits.

**Limitations:** Provider requests transmit user task prompts to the selected provider. Generated websites remain on the user's PC. The generator still produces only `index.html`, `styles.css` and `script.js`; no actual Three.js module is bundled, and models do not execute code. The app does not download third-party software silently. BYOK model names must be entered exactly as offered by the provider and a test call may incur provider charges.
