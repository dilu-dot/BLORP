"""Local-only Ollama agent chain. No shell commands, no code execution, no cloud requests."""
from __future__ import annotations

import io
import json
import os
import re
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass

OLLAMA_BASE = f"http://127.0.0.1:{int(os.environ.get('BLORP_OLLAMA_PORT', '11434'))}"
MAX_REPLY = 360_000
ALLOWED_PATHS = {'index.html', 'styles.css', 'script.js', 'README.md'}


class LocalModelError(Exception):
    pass


def _request(path: str, payload=None, timeout=8):
    url = OLLAMA_BASE + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={'Content-Type':'application/json'})
    try:
        # Do not inherit proxy settings for requests to the user's loopback model server.
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(req, timeout=timeout) as resp:
            raw=resp.read(MAX_REPLY+1)
        if len(raw)>MAX_REPLY:
            raise LocalModelError('The local model response was too large.')
        return json.loads(raw)
    except urllib.error.HTTPError as exc:
        if exc.code==404:
            raise LocalModelError('Model not found in Ollama. Pull it first, then refresh models.') from exc
        raise LocalModelError(f'Ollama returned HTTP {exc.code}.') from exc
    except (urllib.error.URLError, ConnectionError, TimeoutError, OSError) as exc:
        raise LocalModelError(f'Cannot reach Ollama at {OLLAMA_BASE}. Start Ollama on this computer.') from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise LocalModelError('Ollama returned invalid JSON.') from exc


def models():
    result=_request('/api/tags',timeout=3)
    return [str(m.get('name','')) for m in result.get('models', []) if isinstance(m,dict) and m.get('name') and ':cloud' not in str(m['name']).lower()][:100]


def chat(model, messages, *, json_mode=False, tokens=1700):
    body={'model':model,'messages':messages,'stream':False,'options':{'temperature':0.15,'num_predict':tokens}}
    if json_mode:
        body['format']='json'
    data=_request('/api/chat',body,timeout=240)
    answer=data.get('message',{}).get('content','')
    if not isinstance(answer,str) or not answer.strip():
        raise LocalModelError('Model did not return any text. Try another installed model.')
    return answer.strip(), {'prompt_tokens':max(0,int(data.get('prompt_eval_count') or 0)), 'completion_tokens':max(0,int(data.get('eval_count') or 0))}


def parse_files(text):
    """Accept strict JSON file objects; deliberately narrow what can be packaged."""
    raw=text.strip()
    raw=re.sub(r'^```(?:json)?\s*|\s*```$', '', raw, flags=re.I)
    try:
        obj=json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LocalModelError('Builder did not return valid file JSON. Retry with a stronger coding model.') from exc
    if not isinstance(obj,dict) or not isinstance(obj.get('files'),dict):
        raise LocalModelError('Builder returned an invalid files structure.')
    raw_files=obj['files']
    if set(raw_files)-ALLOWED_PATHS or not raw_files:
        raise LocalModelError('Builder returned unexpected file paths; nothing has been saved.')
    if 'index.html' not in raw_files:
        raise LocalModelError('Builder did not generate index.html.')
    files={}
    for name,content in raw_files.items():
        if not isinstance(content,str) or len(content)>75_000:
            raise LocalModelError('Builder returned a file that is too large or invalid.')
        # The MVP promises downloadable, dependency-free static pages. External URLs and
        # network-capable JavaScript are not permitted in generated output. This is a
        # conservative filter, not a security audit; users must still review files.
        if re.search(r'https?://|\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\bnavigator\.sendBeacon\b|\bimportScripts\s*\(', content, re.I):
            raise LocalModelError('Generated files included a network dependency or request. Please retry with an offline-only brief.')
        files[name]=content
    if sum(len(x.encode('utf-8')) for x in files.values())>220_000:
        raise LocalModelError('Generated files exceed the 220 KB safety limit.')
    return files


def build_website(model, brief):
    """Three sequential text-generation agents; returns files and review, never executes code."""
    stats={'prompt_tokens':0,'completion_tokens':0}
    def ask(role, instruction, user, *, json_mode=False, tokens=1700):
        answer,usage=chat(model,[{'role':'system','content':instruction},{'role':'user','content':user}],json_mode=json_mode,tokens=tokens)
        for key in stats:stats[key]+=usage[key]
        return answer

    plan=ask('architect',
        'You are Blorp Architect, an expert web planner. Make a brief implementable plan for a single-page STATIC website with index.html, styles.css and script.js. No remote dependencies or CDNs. Never ask to execute code. Keep under 700 words.',
        brief, tokens=1000)
    prompt=(f'USER REQUEST:\n{brief}\n\nARCHITECT PLAN:\n{plan}\n\n'
            'Generate a complete responsive STATIC website with exactly three separate text files. '
            'Return ONLY a JSON object shaped as {"files":{"index.html":"...","styles.css":"...","script.js":"..."}}. '
            'All links between files must be relative. No external network calls or CDN libraries. '
            'No secret keys. Use semantic HTML, accessible controls, and CSS for mobile. '
            'Avoid markdown code fences and extraneous commentary. Keep each file concise and functional.')
    output=ask('builder','You are Blorp Builder. You write clean, minimal static website files. Respond with valid JSON ONLY.',prompt,json_mode=True,tokens=7000)
    files=parse_files(output)
    review=ask('reviewer',
        'You are Blorp QA Reviewer. Review the static website file excerpts for potential broken links, accessibility, layout, and correctness. '
        'You cannot run the code. Provide concise candid findings and limitations; do not claim tests passed.',
        'Original request: '+brief+'\nPlan: '+plan[:3500]+'\nFiles:\n'+ '\n'.join(name+':\n'+code[:4500] for name,code in files.items()),tokens=850)
    return {'plan':plan,'review':review,'files':files,'usage':stats}


def archive(result):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,content in result['files'].items():
            z.writestr(name,content)
        z.writestr('BLORP_REVIEW.txt','Architect plan (generated, not executed):\n'+result['plan']+'\n\nQA review (static model review only):\n'+result['review']+'\n\nThis project was not executed, sandbox-tested, or security audited.')
    return out.getvalue()
