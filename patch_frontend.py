from pathlib import Path
base=Path(__file__).resolve().parent
html=base/'public/index.html'
s=html.read_text()
nav='''<button type="button" id="localAiNav" data-local-view="localai" class="local-ai-nav">◈ &nbsp; Local AI Lab <span class="local-free">FREE</span></button>'''
if 'id="localAiNav"' not in s:
    assert '<button data-view="workflows"' in s
    s=s.replace('<button data-view="workflows"',nav+'\n<button data-view="workflows"',1)
local_section='''
<section class="tab" id="localai">
 <div class="section-overline"><p class="kicker">BLORP / LOCAL INTELLIGENCE</p><span class="preview-badge">● YOUR PC · NO PAID API NEEDED</span></div>
 <div class="heading"><div><h1>Local <em>AI Lab.</em></h1><p class="subtitle">Real AI responses and three specialist agents, powered by an Ollama model running on your computer.</p></div><button type="button" class="btn" id="localRefresh">⟳ Detect Ollama</button></div>
 <div class="local-status" id="localStatus" role="status" aria-live="polite">Checking for local models…</div>
 <div class="local-layout">
   <div class="panel local-main">
     <div class="local-controls">
       <label for="localModel" class="field-label">Installed model</label>
       <select id="localModel" class="search"><option value="">Detecting models…</option></select>
       <span class="local-model-note">These are real Ollama model names, not untrained Blorp V1–V5 product tiers.</span>
     </div>
     <div class="local-tabs" role="group" aria-label="Local AI mode">
       <button type="button" data-local-mode="chat" class="active">☷ Local Chat</button>
       <button type="button" data-local-mode="build">⌘ Build Website</button>
     </div>
     <div id="localChatThread" class="local-chat-thread" role="log" aria-live="polite"><div class="local-welcome">Ask a real local model a question, or switch to Build Website to run the agent team.</div></div>
     <label class="field-label" for="localInput" id="localInputLabel">Message your local model</label>
     <textarea id="localInput" class="large-prompt" rows="5" maxlength="3000" placeholder="Ask Blorp anything…"></textarea>
     <div class="local-actions"><button class="btn" type="button" id="localClear">↺ Clear chat</button><button class="btn primary" type="button" id="localRun">↑ Send to local model</button></div>
     <p class="local-disclaimer">Local model inference runs on your own PC. Local chat uses no cloud model API. Models may hallucinate; generated code is not executed by Blorp.</p>
   </div>
   <aside class="panel local-results">
     <div class="panelhead"><div><h2>Agent workspace</h2><p class="subtle" style="margin-top:7px">Local static website MVP</p></div><span class="tag">3 agents</span></div>
     <div class="local-agent-row"><span>01</span><div><strong>Architect Agent</strong><small>Creates the implementation plan</small></div></div>
     <div class="local-agent-row"><span>02</span><div><strong>Builder Agent</strong><small>Creates HTML, CSS and JavaScript</small></div></div>
     <div class="local-agent-row"><span>03</span><div><strong>QA Reviewer</strong><small>Reviews the code without running it</small></div></div>
     <div class="local-build-output" id="localBuildOutput" aria-live="polite"><p>Switch to <b>Build Website</b>, enter a brief, and run the agent team. You'll get an actual ZIP containing files if the model completes the task.</p></div>
     <a id="localDownload" class="btn primary" href="#" download hidden>↓ Download generated website ZIP</a>
   </aside>
 </div>
</section>
'''
if 'id="localai"' not in s:
    assert '<section class="tab" id="multitask">' in s
    s=s.replace('<section class="tab" id="multitask">',local_section+'\n<section class="tab" id="multitask">',1)
if '/assets/v51.js' not in s:
    s=s.replace('<script src="/assets/v5.js"></script>','<script src="/assets/v5.js"></script>\n<script src="/assets/v51.js"></script>')
if '/assets/v51.css' not in s:
    s=s.replace('<link rel="stylesheet" href="/assets/v5.css">','<link rel="stylesheet" href="/assets/v5.css">\n<link rel="stylesheet" href="/assets/v51.css">')
html.write_text(s)
print('patched index',len(s))
