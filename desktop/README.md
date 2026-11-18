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
