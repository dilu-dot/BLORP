"""Fixed-endpoint provider model discovery for BLORP's Windows localhost server.

A successful catalog fetch is NOT proof an LLM can run inference, has quota,
or supports chat. OpenRouter requires a separate authenticated /key check;
NVIDIA's potentially public catalog is reported as 'catalog_only'.

No provider responses, authentication headers or keys are logged or cached to disk.
The outbound URL never comes from a user/client request.
"""
from __future__ import annotations

import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request

MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/+\-]{0,139}$")
MAX_BYTES = 3_000_000
MAX_MODELS = 250
TIMEOUT_SECONDS = 9

# Only fixed official HTTPS hosts; never accept URLs, model paths or redirects from clients.
ENDPOINTS = {
    "openai": "https://api.openai.com/v1/models",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",
    "anthropic": "https://api.anthropic.com/v1/models?limit=100",
    "openrouter": "https://openrouter.ai/api/v1/models",
    "groq": "https://api.groq.com/openai/v1/models",
    "mistral": "https://api.mistral.ai/v1/models",
    "nvidia": "https://integrate.api.nvidia.com/v1/models",
}
OPENROUTER_KEY_ENDPOINT = "https://openrouter.ai/api/v1/key"


class DiscoveryError(Exception):
    def __init__(self, code: int, status: str, description: str):
        super().__init__(description)
        self.code = code
        self.status = status


class _RejectRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise DiscoveryError(502, "unavailable", "Unexpected provider redirect")


def _read_json(url: str, headers: dict[str, str], timeout=TIMEOUT_SECONDS):
    """An exact URL, default verified TLS, no redirects, and no environment proxy."""
    req = urllib.request.Request(url, headers=headers, method="GET")
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        _RejectRedirects(),
    )
    try:
        with opener.open(req, timeout=timeout) as response:
            if response.geturl() != url:
                raise DiscoveryError(502, "unavailable", "Unexpected provider redirect")
            content = response.read(MAX_BYTES + 1)
            if len(content) > MAX_BYTES:
                raise DiscoveryError(502, "unavailable", "Provider catalog exceeded safe size limit")
            result = json.loads(content.decode("utf-8"))
            if not isinstance(result, dict):
                raise ValueError("Expected object")
            return result
    except urllib.error.HTTPError as exc:
        # Never read, print, forward or log untrusted provider error bodies/headers.
        if exc.code == 401:
            raise DiscoveryError(401, "invalid", "Provider rejected this API key") from None
        if exc.code == 403:
            raise DiscoveryError(403, "restricted", "Provider denied access for this key or account") from None
        if exc.code == 429:
            raise DiscoveryError(429, "rate_limited", "Provider rate limit reached; retry later") from None
        raise DiscoveryError(502, "unavailable", "Provider catalog is unavailable (HTTP %d)" % exc.code) from None
    except DiscoveryError:
        raise
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, UnicodeError) as exc:
        # Do not echo URLs, exception text or key-bearing request details.
        raise DiscoveryError(502, "unavailable", "Provider discovery request failed or returned invalid JSON") from None


def _headers(provider: str, secret: str):
    if provider == "gemini":
        return {"x-goog-api-key": secret, "Accept": "application/json"}
    if provider == "anthropic":
        return {"x-api-key": secret, "anthropic-version": "2023-06-01", "Accept": "application/json"}
    return {"Authorization": "Bearer " + secret, "Accept": "application/json"}


def _clean_models(provider, payload):
    data = payload.get("models", []) if provider == "gemini" else payload.get("data", [])
    if not isinstance(data, list):
        raise DiscoveryError(502, "unavailable", "Unexpected provider model response")
    found = []
    for row in data:
        if not isinstance(row, dict):
            continue
        ident = row.get("name") if provider == "gemini" else row.get("id")
        if not isinstance(ident, str):
            continue
        if provider == "gemini":
            if "generateContent" not in row.get("supportedGenerationMethods", []):
                continue
            if not ident.startswith("models/"):
                continue
            ident = ident[7:]
        if not MODEL_ID.fullmatch(ident):
            continue
        name = row.get("displayName") or row.get("name") if provider == "gemini" else row.get("name")
        title = name if isinstance(name, str) and len(name) <= 120 else ident
        found.append({"id": ident, "name": title[:120]})
    return found


def discover(provider: str, secret: str, *, transport=None):
    if not isinstance(provider, str) or provider not in ENDPOINTS:
        raise DiscoveryError(422, "invalid_request", "Unsupported model provider")
    if not isinstance(secret, str) or len(secret) < 8:
        raise DiscoveryError(422, "invalid_request", "Missing stored provider API key")
    fetch = transport or _read_json
    headers = _headers(provider, secret)

    # OpenRouter's public models endpoint does NOT validate a BYOK key.
    # Its authenticated /key endpoint is required before listing models.
    if provider == "openrouter":
        metadata = fetch(OPENROUTER_KEY_ENDPOINT, headers)
        if not isinstance(metadata.get("data"), dict):
            raise DiscoveryError(502, "unavailable", "OpenRouter did not return authenticated key metadata")

    results = []
    seen = set()
    url = ENDPOINTS[provider]
    # Bound pages to avoid excessive requests and vendor bills. All next-page
    # queries are restricted to a fixed original URL + encoded cursor string.
    page = 0
    truncated = False
    while True:
        page += 1
        data = fetch(url, headers)
        for item in _clean_models(provider, data):
            if item["id"] not in seen:
                seen.add(item["id"])
                results.append(item)
            if len(results) >= MAX_MODELS:
                truncated = True
                break
        if truncated:
            break
        if provider == "gemini":
            token = data.get("nextPageToken")
            if not token:
                break
            if not isinstance(token, str) or len(token) > 250:
                raise DiscoveryError(502, "unavailable", "Unexpected provider pagination token")
            if page >= 3:
                truncated = True
                break
            url = ENDPOINTS[provider] + "&pageToken=" + urllib.parse.quote(token, safe="")
        elif provider == "anthropic":
            if not data.get("has_more"):
                break
            token = data.get("last_id")
            if not isinstance(token, str) or not MODEL_ID.fullmatch(token):
                raise DiscoveryError(502, "unavailable", "Unexpected provider pagination cursor")
            if page >= 3:
                truncated = True
                break
            url = ENDPOINTS[provider] + "&after_id=" + urllib.parse.quote(token, safe="")
        else:
            break

    # NVIDIA's /models catalog may be public and success doesn't validate a key.
    # All other vendors normally authenticate model listings; even then, actual
    # inference/model permissions, billing, quotas and geography remain unknown.
    catalog_only = provider == "nvidia"
    return {
        "provider": provider,
        "status": "catalog_only" if catalog_only else "catalog_checked",
        "authentication_confirmed": not catalog_only,
        "model_access_unverified": True,
        "models": results,
        "model_count": len(results),
        "truncated": truncated,
    }
