"""No live provider keys or paid vendor calls are used in these tests."""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import provider_discovery as discovery

FAKE_KEY="fake-key-for-tests-123456"


class CatalogTests(unittest.TestCase):
    def test_fixed_endpoints_and_header_types(self):
        for provider,url in discovery.ENDPOINTS.items():
            calls=[]
            def fetch(target,headers):
                calls.append((target,headers))
                if provider=="openrouter" and target.endswith("/key"):
                    return {"data":{"is_free_tier":True}}
                if provider=="gemini":
                    return {"models":[{"name":"models/gemini-test","displayName":"Gemini Test","supportedGenerationMethods":["generateContent"]}]}
                return {"data":[{"id":"test/chat-model","name":"Test Chat Model"}]}
            result=discovery.discover(provider,FAKE_KEY,transport=fetch)
            self.assertTrue(all(url.startswith("https://") for url,_ in calls))
            self.assertEqual(result["model_count"],1)
            self.assertEqual(result["models"][0]["id"],"gemini-test" if provider=="gemini" else "test/chat-model")
            self.assertTrue(result["model_access_unverified"])
            self.assertEqual(result["status"],"catalog_only" if provider=="nvidia" else "catalog_checked")
            self.assertEqual(result["authentication_confirmed"],provider!="nvidia")
            self.assertNotIn(FAKE_KEY,json.dumps(result))
            if provider in ("gemini","anthropic"):
                header="x-goog-api-key" if provider=="gemini" else "x-api-key"
                self.assertEqual(calls[0][1][header],FAKE_KEY)
            else:self.assertEqual(calls[0][1]["Authorization"],"Bearer "+FAKE_KEY)
            if provider=="openrouter":
                self.assertEqual([url for url,_ in calls],
                    [discovery.OPENROUTER_KEY_ENDPOINT,discovery.ENDPOINTS["openrouter"]])
            else:
                self.assertEqual(calls[0][0],url)

    def test_openrouter_key_endpoint_rejects_invalid_without_catalog(self):
        calls=[]
        def fetch(url,headers):
            calls.append(url)
            raise discovery.DiscoveryError(401,"invalid","Provider rejected this API key")
        with self.assertRaises(discovery.DiscoveryError) as ex:
            discovery.discover("openrouter",FAKE_KEY,transport=fetch)
        self.assertEqual(ex.exception.status,"invalid")
        self.assertEqual(calls,[discovery.OPENROUTER_KEY_ENDPOINT])

    def test_gemini_pagination_filters_non_generation_models(self):
        calls=[]
        def fetch(url,headers):
            calls.append(url)
            if len(calls)==1:
                return {"models":[
                    {"name":"models/gemini-flash","displayName":"Flash","supportedGenerationMethods":["generateContent"]},
                    {"name":"models/text-embedding","supportedGenerationMethods":["embedContent"]},
                    {"name":"malicious-id","supportedGenerationMethods":["generateContent"]}],
                    "nextPageToken":"a/+b"}
            return {"models":[{"name":"models/gemini-pro","supportedGenerationMethods":["generateContent"]}]}
        result=discovery.discover("gemini",FAKE_KEY,transport=fetch)
        self.assertEqual([m["id"] for m in result["models"]],["gemini-flash","gemini-pro"])
        self.assertIn("pageToken=a%2F%2Bb",calls[1])

    def test_anthropic_pagination_and_duplicate_ids(self):
        calls=[]
        def fetch(url,headers):
            calls.append(url)
            if len(calls)==1:
                return {"data":[{"id":"claude-test"}],"has_more":True,"last_id":"claude-test"}
            return {"data":[{"id":"claude-test"},{"id":"claude-test-new"}],"has_more":False}
        result=discovery.discover("anthropic",FAKE_KEY,transport=fetch)
        self.assertEqual(result["model_count"],2)
        self.assertTrue(calls[1].endswith("&after_id=claude-test"))

    def test_reject_bad_payloads_and_host_provider_input(self):
        with self.assertRaises(discovery.DiscoveryError):
            discovery.discover("https://evil.example",FAKE_KEY)
        with self.assertRaises(discovery.DiscoveryError):
            discovery.discover("openai","short")
        with self.assertRaises(discovery.DiscoveryError) as ex:
            discovery.discover("openai",FAKE_KEY,transport=lambda _u,_h:{"data":"wrong"})
        self.assertEqual(ex.exception.status,"unavailable")

    def test_catalog_cap_and_no_false_full_completeness(self):
        def fetch(_u,_h):
            return {"data":[{"id":"model-"+str(i)} for i in range(300)]}
        result=discovery.discover("openai",FAKE_KEY,transport=fetch)
        self.assertEqual(result["model_count"],discovery.MAX_MODELS)
        self.assertTrue(result["truncated"])

    def test_http_errors_are_sanitized(self):
        for code,state in ((401,"invalid"),(403,"restricted"),(429,"rate_limited"),(500,"unavailable")):
            class Transport:
                def open(self,*args,**kwargs):
                    raise urllib.error.HTTPError(
                        "https://api.openai.com/v1/models?secret=SENSITIVE",
                        code,"response contains SENSITIVE",{},None)
            with patch.object(discovery.urllib.request,"build_opener",return_value=Transport()):
                with self.assertRaises(discovery.DiscoveryError) as ex:
                    discovery._read_json(discovery.ENDPOINTS["openai"],{"Authorization":"Bearer SENSITIVE"})
                self.assertEqual(ex.exception.status,state)
                self.assertNotIn("SENSITIVE",str(ex.exception))

    def test_no_user_supplied_url_and_redirects_blocked(self):
        self.assertTrue(all(url.startswith("https://") for url in discovery.ENDPOINTS.values()))
        handler=discovery._RejectRedirects()
        with self.assertRaises(discovery.DiscoveryError):
            handler.redirect_request(None,None,302,"move",{},"http://internal.example/secret")


if __name__=="__main__":
    unittest.main()
