from contextlib import contextmanager
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


@contextmanager
def studio_server():
    with tempfile.TemporaryDirectory() as data:
        env = dict(os.environ, BLORP_DATA_DIR=data, BLORP_PORT="0")
        env.pop("BLORP_GOOGLE_CLIENT_ID", None)
        proc = subprocess.Popen([sys._base_executable, "-u", str(ROOT / "server.py")], cwd=ROOT, env=env,
                                stdout=subprocess.PIPE, text=True)
        try:
            banner = proc.stdout.readline().strip()
            expected = f"BLORP Studio V4.3 ({ROOT / 'server.py'}): "
            assert banner.startswith(expected), banner
            url = banner[len(expected):]
            assert url.startswith("http://127.0.0.1:")
            with urllib.request.urlopen(url + "/api/health") as response:
                assert json.load(response)["studio_ui"] == "v4.3"
            print(f"Verified {ROOT / 'server.py'} (PID {proc.pid}) at {url}", flush=True)
            yield url
        finally:
            proc.terminate()
            proc.wait(timeout=10)
