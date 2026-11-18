/* BLORP Frontend Foundation — UI only; no backend/auth changes. */
(() => {
  "use strict";
  const overview = document.getElementById("overview");
  if (!overview) return;
  // Remove the fabricated V4 metrics instead of showing them as real data.
  overview.innerHTML =
    '<div class="bf-intro"><div class="bf-intro-copy">' +
    '<div class="bf-eyebrow"><span class="bf-pulse"></span> BLORP / YOUR AI WORKSPACE</div>' +
    '<h1>One workspace.<br><em>Every creative workflow.</em></h1>' +
    '<p>Build, experiment and organize projects in a focused desktop-inspired studio. Connect models and services when you are ready.</p>' +
    '<div class="bf-intro-actions"><button type="button" class="btn primary" data-bf-view="playground">Open AI Playground ↗</button><button type="button" class="btn" data-bf-view="multitask">Explore Multi Task</button></div>' +
    '<div class="bf-intro-meta"><span>◈ Local-first</span><span>◇ Modular workflows</span><span>⌁ Your choice of model</span></div></div>' +
    '<div class="bf-orbit" aria-hidden="true"><div class="bf-orbit-ring bf-r1"></div><div class="bf-orbit-ring bf-r2"></div><div class="bf-orbit-center">b<span>.</span></div><div class="bf-orbit-chip bf-chip-1">LOCAL AI</div><div class="bf-orbit-chip bf-chip-2">MULTI TASK</div><div class="bf-orbit-chip bf-chip-3">PROJECTS</div></div></div>' +
    '<div class="bf-section-top"><div><span class="bf-overline">YOUR TOOLS</span><h2>Pick up where ideas start.</h2><p>Choose a workflow and build with focus.</p></div><span class="bf-mini-tag">FRONTEND FOUNDATION</span></div>' +
    '<div class="bf-feature-grid">' +
    '<button class="bf-feature bf-feature-primary" type="button" data-bf-view="playground"><span class="bf-feature-icon">✳</span><span class="bf-feature-label">01 / THINK</span><strong>AI Playground</strong><span>Conversations, prompts and model-based assistance.</span><span class="bf-feature-bottom">Open workspace <b>↗</b></span></button>' +
    '<button class="bf-feature" type="button" data-bf-view="multitask"><span class="bf-feature-icon">⌘</span><span class="bf-feature-label">02 / ORCHESTRATE</span><strong>Multi Task</strong><span>Specialist agents, per-agent models and workflow planning.</span><span class="bf-feature-bottom">Open workspace <b>↗</b></span></button>' +
    '<button class="bf-feature" type="button" data-bf-view="projects"><span class="bf-feature-icon">▣</span><span class="bf-feature-label">03 / ORGANIZE</span><strong>Project Library</strong><span>Keep briefs, files and build drafts in one place.</span><span class="bf-feature-bottom">Open library <b>↗</b></span></button></div>' +
    '<div class="bf-section-top bf-bottom-heading"><div><span class="bf-overline">PLATFORM STATUS</span><h2>Built in layers. Clear by design.</h2><p>Complete the interface first. Connect services and final authentication afterward.</p></div></div>' +
    '<div class="bf-status-grid">' +
    '<div class="bf-status-card"><span class="bf-status-icon">01</span><div><strong>Frontend workspace</strong><p>Navigation, responsive views and task setup.</p></div><span class="bf-status-tag">IN PROGRESS</span></div>' +
    '<div class="bf-status-card"><span class="bf-status-icon">02</span><div><strong>AI connections</strong><p>Local Ollama and provider routing.</p></div><span class="bf-status-tag bf-tag-later">NEXT STAGE</span></div>' +
    '<div class="bf-status-card"><span class="bf-status-icon">03</span><div><strong>Final accounts</strong><p>Google sign-in, access and sessions.</p></div><span class="bf-status-tag bf-tag-later">FINAL STAGE</span></div></div>';
  overview.querySelectorAll("[data-bf-view]").forEach(button => {
    button.addEventListener("click", () => {
      if (typeof changeView === "function") changeView(button.dataset.bfView);
    });
  });
  const buildTitle = document.querySelector("#builder .build-welcome-desc");
  if (buildTitle) buildTitle.textContent = "Describe your idea. Standard builds use one selected model; specialist agent teams belong exclusively in Multi Task.";
  const buildBrand = document.querySelector("#builder .build-header-caption small");
  if (buildBrand) buildBrand.textContent = "Creative build workspace";
  const banner = document.querySelector("#multitask .heading .subtitle");
  if (banner) banner.textContent = "Design specialist agents, assign models and plan complex work. Execution engine comes in the next stage.";
  const workflowNote = document.querySelector("#multitask .soft-note");
  if (workflowNote) workflowNote.textContent = "Multi Task currently saves agent configurations and workflow drafts. Agents do not execute until the orchestration backend is connected.";
  const topPill = document.querySelector(".top-right > .pill");
  if (topPill && topPill.textContent.includes("Design preview")) topPill.textContent = "● Frontend workspace";
})();
