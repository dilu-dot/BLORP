"""Local Windows-only provider credential vault for BLORP.

Windows DPAPI encrypts credentials for the current Windows user. Provider keys
are never stored in SQLite, localStorage, application logs, or API responses.

This is for the localhost Python server, NOT a public/cloud credential service.
The Electron desktop already has a separate OS-encrypted ModelHub vault.
Cross-runtime vault consolidation is a later integration task.
"""
from __future__ import annotations

import ctypes
import ctypes.wintypes
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import threading
import time

PROVIDERS = {
    "openai": "OpenAI",
    "gemini": "Google AI Studio",
    "anthropic": "Anthropic",
    "openrouter": "OpenRouter",
    "groq": "Groq",
    "mistral": "Mistral",
    "nvidia": "NVIDIA NIM",
}
_PROVIDER = re.compile(r"^[a-z]{3,20}$")
_USER = re.compile(r"^[a-f0-9-]{36}$")
_KEY = re.compile(r"^[^\s\x00-\x1f\x7f]{8,450}$")
_LOCK = threading.RLock()


class VaultError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class WindowsDPAPI:
    """Current-Windows-user DPAPI; fails closed on non-Windows systems."""
    CRYPTPROTECT_UI_FORBIDDEN = 1

    def __init__(self):
        if sys.platform != "win32":
            raise VaultError(503, "Secure provider-key storage requires Windows DPAPI in the local server")
        from ctypes import POINTER, Structure, byref, c_void_p, c_wchar_p, c_ubyte

        class DATA_BLOB(Structure):
            _fields_ = [
                ("cbData", ctypes.wintypes.DWORD),
                ("pbData", POINTER(c_ubyte)),
            ]

        self._blob_type = DATA_BLOB
        self._byref = byref
        self._c_void_p = c_void_p
        self._pointer = POINTER(c_ubyte)
        self._crypt = ctypes.WinDLL("crypt32", use_last_error=True)
        self._kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        for fn in (self._crypt.CryptProtectData, self._crypt.CryptUnprotectData):
            fn.argtypes = [
                POINTER(DATA_BLOB), c_wchar_p, POINTER(DATA_BLOB), c_void_p,
                c_void_p, ctypes.wintypes.DWORD, POINTER(DATA_BLOB)
            ]
            fn.restype = ctypes.wintypes.BOOL
        self._kernel.LocalFree.argtypes = [c_void_p]
        self._kernel.LocalFree.restype = c_void_p

    def _operate(self, data: bytes, encrypt: bool) -> bytes:
        if not isinstance(data, bytes) or not data:
            raise VaultError(503, "Unable to encrypt or decrypt the credential vault")
        from ctypes import create_string_buffer, cast, string_at
        # Keep the input buffer alive until Windows finishes the call.
        source = create_string_buffer(data)
        inp = self._blob_type(len(data), cast(source, self._pointer))
        out = self._blob_type()
        func = self._crypt.CryptProtectData if encrypt else self._crypt.CryptUnprotectData
        try:
            if not func(self._byref(inp), None, None, None, None,
                        self.CRYPTPROTECT_UI_FORBIDDEN, self._byref(out)):
                raise VaultError(503, "Windows could not securely access the credential vault")
            return string_at(out.pbData, out.cbData)
        finally:
            if out.pbData:
                self._kernel.LocalFree(cast(out.pbData, self._c_void_p))

    def protect(self, data: bytes) -> bytes:
        return self._operate(data, True)

    def unprotect(self, data: bytes) -> bytes:
        return self._operate(data, False)


class ProviderVault:
    """Per-BLORP-account vault. Inject a test protector only in unit tests."""

    def __init__(self, root: Path, protector=None):
        self.root = Path(root) / "provider-credentials"
        self.protector = protector

    def available(self) -> bool:
        if self.protector is not None:
            return True
        return sys.platform == "win32"

    def _cipher(self):
        if self.protector is not None:
            return self.protector
        return WindowsDPAPI()

    def _filename(self, user_id: str) -> Path:
        if not isinstance(user_id, str) or not _USER.fullmatch(user_id):
            raise VaultError(422, "Invalid account identifier")
        return self.root / (user_id + ".dpapi")

    def _read(self, user_id: str) -> dict:
        path = self._filename(user_id)
        cipher = self._cipher()  # Fail closed, including when no vault file exists.
        try:
            raw = path.read_bytes()
        except FileNotFoundError:
            return {}
        except OSError as exc:
            raise VaultError(503, "Unable to read encrypted provider credentials") from exc
        try:
            result = json.loads(cipher.unprotect(raw).decode("utf-8"))
            if not isinstance(result, dict):
                raise ValueError("Invalid vault")
            for name, row in result.items():
                if name not in PROVIDERS or not isinstance(row, dict) or not isinstance(row.get("key"), str):
                    raise ValueError("Invalid vault")
            return result
        except (ValueError, UnicodeError, KeyError, TypeError, VaultError) as exc:
            raise VaultError(503, "Could not unlock stored provider credentials on this Windows account") from exc

    def _write(self, user_id: str, entries: dict):
        path = self._filename(user_id)
        cipher = self._cipher()
        if not entries:
            try:
                path.unlink(missing_ok=True)
            except OSError as exc:
                raise VaultError(503, "Could not remove encrypted provider credentials") from exc
            return
        try:
            encoded = json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            ciphertext = cipher.protect(encoded)
            if not isinstance(ciphertext, bytes) or not ciphertext:
                raise VaultError(503, "Encryption failed; key was not saved")
            path.parent.mkdir(parents=True, exist_ok=True)
            descriptor, temp = tempfile.mkstemp(prefix=".blorp-key-", dir=str(path.parent))
            try:
                with os.fdopen(descriptor, "wb") as file:
                    file.write(ciphertext)
                    file.flush()
                    os.fsync(file.fileno())
                os.chmod(temp, 0o600)
                os.replace(temp, path)
            finally:
                if os.path.exists(temp):
                    os.unlink(temp)
        except (OSError, TypeError, ValueError) as exc:
            raise VaultError(503, "Could not save encrypted credentials") from exc

    @staticmethod
    def _metadata(entries: dict) -> list[dict]:
        return [
            {
                "provider": provider,
                "name": PROVIDERS[provider],
                "label": str(row.get("label") or PROVIDERS[provider])[:60],
                "stored_at": int(row.get("stored_at") or 0),
                "status": "saved_not_verified",
            }
            for provider, row in sorted(entries.items()) if provider in PROVIDERS
        ]

    def get_secret(self, user_id: str, provider: str) -> str:
        """Server-only secret access for fixed-endpoint model verification.

        Never expose the returned value through HTTP, tracing or logs.
        """
        if not isinstance(provider, str) or provider not in PROVIDERS:
            raise VaultError(422, "Unsupported API provider")
        with _LOCK:
            row = self._read(user_id).get(provider)
            if not row:
                raise VaultError(404, "No encrypted API key saved for this provider")
            return row["key"]

    def list(self, user_id: str) -> dict:
        with _LOCK:
            if not self.available():
                return {"storage_available": False, "storage": "unavailable",
                        "providers": [], "live_verification": False}
            return {
                "storage_available": True,
                "storage": "Windows DPAPI (current OS user)",
                "providers": self._metadata(self._read(user_id)),
                "live_verification": False,
            }

    def connect(self, user_id: str, provider: str, key: str, label: str = "") -> dict:
        if not isinstance(provider, str) or provider not in PROVIDERS:
            raise VaultError(422, "Unsupported API provider")
        if not isinstance(key, str) or not _KEY.fullmatch(key):
            raise VaultError(422, "API key must contain 8–450 non-whitespace characters")
        if not isinstance(label, str) or len(label) > 60:
            raise VaultError(422, "Provider label must be at most 60 characters")
        with _LOCK:
            entries = self._read(user_id)
            entries[provider] = {
                "key": key,
                "label": label.strip() or PROVIDERS[provider],
                "stored_at": int(time.time()),
            }
            self._write(user_id, entries)
            return {
                "provider": provider, "name": PROVIDERS[provider],
                "status": "saved_not_verified", "stored": True,
            }

    def disconnect(self, user_id: str, provider: str) -> dict:
        if not isinstance(provider, str) or provider not in PROVIDERS:
            raise VaultError(422, "Unsupported API provider")
        with _LOCK:
            entries = self._read(user_id)
            existed = provider in entries
            entries.pop(provider, None)
            if existed:
                self._write(user_id, entries)
            return {"provider": provider, "removed": existed}
