# Blorp AI 0.5.7 – Functional Local Studio Preview

Blorp has **real local functionality** in this release, but it is **not yet a complete AI SaaS or multi-agent website builder**.

## Working features
- Supabase email/password authentication and configured Google OAuth.
- Server-checked membership status.
- **Local AI Studio** with real Ollama chat responses (no fake canned answers).
- Conversations stored on the user's computer as JSON files, per signed-in user.
- Real static website projects with `index.html`, `styles.css`, `script.js` saved to local Windows app data.
- Local coding model generates HTML/CSS/JS source, which can be edited, saved and previewed in an isolated iframe.
- "Open folder" reveals the real local project files in File Explorer.

## Setup on Windows
1. Install [Ollama](https://ollama.com/download/windows).
2. In PowerShell run `ollama pull qwen2.5-coder:3b`.
3. Open `Blorp AI 0.5.7.exe`, sign in, open **Local AI Studio**, then click **Refresh models**.
4. Use **AI Chat** to ask the model, **Website Builder** to generate source, and **My Projects** to edit files.

Local data location: `%APPDATA%\blorp-ai-customer-desktop\BlorpWorkspace\<signed-in-user-id>\` (actual path displayed by native workspace; userData directory may vary with Electron app name). Chat prompts and generated websites are not uploaded to Supabase. Local AI uses your machine CPU/GPU and storage. Installing and downloading the model needs an internet connection initially; inference runs locally.

## Limitations
- The local generator is **single-pass** and can return invalid JSON; retry with a stronger coder model. No background terminals, arbitrary filesystem writes, external websites, tests or code execution.
- **Multi-agent coordination**, cloud AI and actual payment checkout remain inactive and are not advertised as functioning.
- The old static preview pages are hidden from the main navigation so users aren't misled about demo features.
- Model-generated HTML/JS can be unsafe; inspect code before publishing or opening it outside Blorp's sandboxed preview.
- Supabase sign-in still needs network access, even though project/chat data stays on the local drive.
- This is an unsigned Windows preview. Run on a test computer before broader distribution.

## Developer build
```powershell
npm install
npm run desktop:check
python desktop/generate_icon.py
npm run desktop:build
```

Private Devo Engine owner app is separate and **not** connected to this local Studio.
