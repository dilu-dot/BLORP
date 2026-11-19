"""Phase 3.1: provider keys are account-scoped and never leave the encrypted vault.

All keys in tests are fabricated. Unit tests inject a reversible stand-in for
DPAPI because CI runs on Linux; production is fail-closed without Windows DPAPI.
"""
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from provider_vault import ProviderVault, VaultError

USER_A = "13b7231a-ea82-46d2-bfe9-045a680365bd"
USER_B = "1950b6a1-33cf-456d-8967-5166484fa29c"
EXAMPLE = "not-a-real-key-123456789"


class FakeProtector:
    def protect(self, value):
        # Test-only placeholder to assert the ciphertext storage path.
        return b"FAKE:" + bytes(b ^ 91 for b in value)

    def unprotect(self, value):
        if not value.startswith(b"FAKE:"):
            raise ValueError("Vault damaged")
        return bytes(b ^ 91 for b in value[5:])


class ProviderVaultTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.vault = ProviderVault(Path(self.dir.name), protector=FakeProtector())

    def denied(self, status, function):
        with self.assertRaises(VaultError) as issue:
            function()
        self.assertEqual(issue.exception.status, status)

    def test_store_list_and_remove_without_exposing_secret(self):
        saved = self.vault.connect(USER_A, "gemini", EXAMPLE, "Gemini development")
        self.assertEqual(saved, {
            "provider": "gemini", "name": "Google AI Studio",
            "status": "saved_not_verified", "stored": True
        })
        path = Path(self.dir.name) / "provider-credentials" / (USER_A + ".dpapi")
        self.assertTrue(path.exists())
        self.assertNotIn(EXAMPLE.encode(), path.read_bytes())
        result = self.vault.list(USER_A)
        self.assertTrue(result["storage_available"])
        self.assertFalse(result["live_verification"])
        self.assertEqual(result["providers"][0]["label"], "Gemini development")
        self.assertNotIn(EXAMPLE, repr(result))
        self.assertEqual(self.vault.list(USER_B)["providers"], [])
        self.assertTrue(self.vault.disconnect(USER_A, "gemini")["removed"])
        self.assertFalse(path.exists())
        self.assertEqual(self.vault.list(USER_A)["providers"], [])

    def test_per_user_separation_and_provider_replacement(self):
        self.vault.connect(USER_A, "openai", EXAMPLE)
        self.vault.connect(USER_B, "anthropic", "different-fake-key-876")
        self.assertEqual([x["provider"] for x in self.vault.list(USER_A)["providers"]], ["openai"])
        self.assertEqual([x["provider"] for x in self.vault.list(USER_B)["providers"]], ["anthropic"])
        self.vault.connect(USER_A, "openai", "replacement-fake-key-abc", "Work")
        self.assertEqual(len(self.vault.list(USER_A)["providers"]), 1)
        self.assertEqual(self.vault.list(USER_A)["providers"][0]["label"], "Work")
        self.assertFalse(self.vault.disconnect(USER_A, "groq")["removed"])

    def test_reject_unsupported_and_malformed(self):
        self.denied(422, lambda: self.vault.connect(USER_A, "custom", EXAMPLE))
        self.denied(422, lambda: self.vault.connect(USER_A, [], EXAMPLE))
        self.denied(422, lambda: self.vault.disconnect(USER_A, {"bad": True}))
        self.denied(422, lambda: self.vault.connect(USER_A, "openai", "short"))
        self.denied(422, lambda: self.vault.connect(USER_A, "openai", "key with spaces"))
        self.denied(422, lambda: self.vault.connect(USER_A, "openai", EXAMPLE, "x" * 61))
        self.denied(422, lambda: self.vault.connect("../other", "openai", EXAMPLE))
        self.assertEqual(self.vault.list(USER_A)["providers"], [])

    def test_fails_closed_for_corrupt_vault(self):
        self.vault.connect(USER_A, "mistral", EXAMPLE)
        file = Path(self.dir.name) / "provider-credentials" / (USER_A + ".dpapi")
        file.write_bytes(b"truncated")
        self.denied(503, lambda: self.vault.list(USER_A))
        self.denied(503, lambda: self.vault.connect(USER_A, "groq", EXAMPLE))
        self.assertEqual(file.read_bytes(), b"truncated")

    def test_concurrent_writes_do_not_lose_providers(self):
        providers = ["openai","gemini","anthropic","openrouter","groq","mistral","nvidia"]
        errors = []
        def add(name):
            try:
                self.vault.connect(USER_A, name, EXAMPLE)
            except Exception as exc:
                errors.append(type(exc).__name__)
        threads = [threading.Thread(target=add,args=(name,)) for name in providers]
        for t in threads: t.start()
        for t in threads: t.join()
        self.assertEqual(errors, [])
        self.assertEqual(len(self.vault.list(USER_A)["providers"]), 7)

    def test_other_os_fails_closed_without_injected_cipher(self):
        if sys.platform != "win32":
            unsupported = ProviderVault(Path(self.dir.name))
            self.assertFalse(unsupported.list(USER_A)["storage_available"])
            self.denied(503, lambda: unsupported.connect(USER_A, "openai", EXAMPLE))


if __name__ == "__main__":
    unittest.main()
