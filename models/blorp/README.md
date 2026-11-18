# Blorp AI · local Ollama model blueprint

Blorp is the branded **Ollama model alias** `blorp:latest`. It is based on an existing open-weight model, not a new model trained by Blorp.

## Installation
The Windows desktop app offers **Model Hub → Install Blorp**, which downloads a model after the user approves it. It requires Ollama, internet for the first download, and enough disk space. No weights are included in this repository or executable.

Alternatively, on Windows with Ollama already installed, run from the repository:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-blorp.ps1 -Edition balanced
# or lower-resource model:
powershell -ExecutionPolicy Bypass -File scripts/install-blorp.ps1 -Edition light
```

Or manually:

```powershell
ollama pull qwen3.5:4b
ollama create blorp -f models/blorp/Modelfile
ollama run blorp
```

## Editions

| Edition | Upstream model | Approx. download | Upstream license |
|---|---|---|---|
| Balanced (default) | `qwen3.5:4b` | 3.4 GB | Apache 2.0 |
| Lite | `qwen2.5-coder:1.5b` | 986 MB | Apache 2.0 |

See the Ollama model pages for original authors, license and updates:
- https://ollama.com/library/qwen3.5:4b
- https://ollama.com/library/qwen2.5-coder:1.5b

**Do not market Blorp as an independently trained foundation model.** Customization is a system prompt and inference settings only. Follow upstream attribution and license requirements if redistributing model artifacts.

A model is downloaded to each user's PC via Ollama and does not travel to Supabase. Choosing a connected external API provider sends the applicable task prompts to that provider.
