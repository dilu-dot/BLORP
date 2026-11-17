# Local AI Lab — How it works

## Architecture

```
Browser (Blorp Local AI Lab)
    ↓ localhost HTTP + local authenticated cookie
Python server.py (127.0.0.1, default port 8765)
    ↓ localhost Ollama API (127.0.0.1:11434)
Installed Ollama coding model
    ├─ Local Chat: conversation prompt → response
    └─ Build Website:
         Architect → Builder (strict JSON) → QA Reviewer
                 ↓
         ZIP containing static files + static review
```

The three roles run **sequentially using the selected model**, not in parallel or as separate trained models. No shell commands are run on model output.

## First-time setup

1. Download Ollama from https://ollama.com/download/windows and open the app.
2. Open PowerShell and run:

   ```powershell
   ollama pull qwen2.5-coder:3b
   ollama list
   ```

3. Start Blorp with `START_BLORP_WINDOWS.bat`.
4. Sign up for a **local** account and open **Local AI Lab**.
5. Click **Detect Ollama**, choose the model, enter a prompt and send.

For a smaller model: `ollama pull qwen2.5-coder:1.5b`. For a stronger model on an adequately resourced PC: `ollama pull qwen2.5-coder:7b`. These are examples, not installed automatically.

## Troubleshooting

| Symptom | What to check |
|---|---|
| “Cannot reach Ollama” | Open the Ollama app; check `ollama list` in PowerShell. Visit `http://127.0.0.1:11434/api/tags` to see available models. |
| “No models installed” | Use `ollama pull qwen2.5-coder:3b`, then click Detect Ollama. |
| “Sign in required” | Register/sign in at localhost, not inside the standalone HTML preview. |
| “Builder did not return valid file JSON” | Use a stronger coding model, choose a simpler static website brief, then try again. |
| “Generated files included a network request” | Ask for a self-contained static website with no APIs, CDN, fonts or remote images. |
| Build is slow | Smaller model, shorter prompt, or a computer with more GPU VRAM/RAM; CPU inference can take several minutes. |
| Browser preview says UI-only | Run Blorp from the `.bat` launcher and open its localhost URL. Opening the HTML file directly cannot call a local Python backend. |
| Python command not found | Install Python 3.10+ and choose the Python launcher; try `py -3 --version`. |

## API endpoints (local only)

| Method | Route | Behavior |
|---|---|---|
| GET | `/api/local/models` | Lists installed **non-cloud** Ollama model names |
| POST | `/api/local/chat` | Authenticated model reply; JSON `{ "model": "...", "message": "...", "history": [] }` |
| POST | `/api/local/agents/build` | Authenticated Architect→Builder→QA run; JSON `{ "model": "...", "brief": "..." }` |
| GET | `/api/local/artifacts/{id}` | Authenticated, account-owned ZIP download |
| GET | `/api/health` | Basic local server health |
| POST | `/api/agents/run` | Always returns HTTP 503; generic unsafe execution is not enabled |

`/api/local/chat` and `/api/local/agents/build` are serialized by a lock and subject to limits. All generated source files are **untrusted AI output**. The word “review” in the returned payload is *model commentary*, not executable test results.

## Next planned engineering steps

- Sandbox-based test execution of generated static sites; real accessibility/performance checks.
- Git worktrees, per-agent workspaces and conflict resolution.
- Real model routing profiles and task-specific benchmarks; possible fine-tuning with model licenses reviewed.
- Authenticated deployment with logs and billing only after production security audits and genuine metering.
