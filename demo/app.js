/* llm-finetuning-framework demo — app logic.
   Talks to POST /api/run (real ported pipeline math, api/run.py).
   UI only replays the returned per-stage records; all metrics stay synthetic. */
import './js/material-bundle.js';

const $ = (id) => document.getElementById(id);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, reducedMotion() ? 0 : ms));

/* ---------------- diagnostics: silent failures become loud ----------------
   Any window error or unhandled promise rejection is written to the console
   AND to the visible pipeline log, so a dead button can never again die
   silently. This logger is intentionally permanent, not temporary. */
function diagReport(kind, err) {
  let detail = '';
  try { detail = err && err.stack ? String(err.stack).split('\n').slice(0, 3).join(' | ') : String(err && err.message !== undefined ? err.message : err); }
  catch { detail = '[unprintable error]'; }
  const line = `[diag] ${kind}: ${detail}`;
  try { console.error(line); } catch { /* noop */ }
  try {
    const log = document.getElementById('log');
    if (log) {
      const html = `<span class="log-dim">[diag         ] ${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`;
      if (typeof log.insertAdjacentHTML === 'function') {
        log.insertAdjacentHTML('beforeend', html + '\n');
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch { /* the logger itself must never throw */ }
}
window.addEventListener('error', (e) => diagReport('window.onerror', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => diagReport('unhandledrejection', e.reason));

const STAGES = [
  { id: 'data',          label: 'Data',          artifact: 'dataset' },
  { id: 'contamination', label: 'Contamination', artifact: 'contamination_check' },
  { id: 'sft',           label: 'SFT',           artifact: 'sft_checkpoint' },
  { id: 'dpo',           label: 'DPO',           artifact: 'dpo_checkpoint' },
  { id: 'quantize',      label: 'Quantize',      artifact: 'quants' },
  { id: 'serve',         label: 'Serve',         artifact: 'endpoint' },
  { id: 'eval',          label: 'Eval',          artifact: 'eval_report' },
  { id: 'model_card',    label: 'Model card',    artifact: 'model_card' },
];

/* DAG geometry (viewBox 0 0 980 440), node centers */
const NODES = {
  data:          { x: 110, y: 215 },
  contamination: { x: 330, y: 90 },
  sft:           { x: 330, y: 340 },
  dpo:           { x: 540, y: 340 },
  model_card:    { x: 540, y: 90 },
  quantize:      { x: 750, y: 340 },
  eval:          { x: 750, y: 90 },
  serve:         { x: 890, y: 215 },
};
const NODE_W = 150, NODE_H = 64;
const EDGES = [
  { from: 'data',  to: 'contamination', via: 'dataset' },
  { from: 'data',  to: 'sft',           via: 'dataset' },
  { from: 'sft',   to: 'dpo',           via: 'sft_checkpoint' },
  { from: 'sft',   to: 'model_card',    via: 'sft_checkpoint' },
  { from: 'dpo',   to: 'quantize',      via: 'dpo_checkpoint' },
  { from: 'dpo',   to: 'eval',          via: 'dpo_checkpoint' },
  { from: 'quantize', to: 'serve',      via: 'quants' },
];

let lastRun = null;   // full /api/run response
let snackTimer = null;

/* ---------------- theme ---------------- */
function initTheme() {
  const sw = $('themeSwitch');
  const saved = localStorage.getItem('llmff-theme');
  const dark = saved ? saved === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  sw.selected = dark;
  sw.addEventListener('change', () => {
    const d = sw.selected;
    document.documentElement.dataset.theme = d ? 'dark' : 'light';
    localStorage.setItem('llmff-theme', d ? 'dark' : 'light');
  });
}

/* ---------------- snackbar ---------------- */
function showSnack(text, actionLabel = 'Dismiss', onAction = null) {
  const bar = $('snackbar');
  $('snackText').textContent = text;
  const btn = $('snackAction');
  btn.textContent = actionLabel;
  btn.onclick = () => { hideSnack(); if (onAction) onAction(); };
  bar.hidden = false;
  requestAnimationFrame(() => bar.classList.add('show'));
  clearTimeout(snackTimer);
  snackTimer = setTimeout(hideSnack, 6000);
}
function hideSnack() {
  const bar = $('snackbar');
  bar.classList.remove('show');
  clearTimeout(snackTimer);
}

/* ---------------- clipboard / download ---------------- */
async function copyText(text, okMsg = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  showSnack(okMsg);
}
function downloadFile(name, text, mime = 'text/yaml') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------------- config ---------------- */
const fBase = () => $('fBase'), fSeed = () => $('fSeed'),
      fRaw = () => $('fRaw'),  fRawNum = () => $('fRawNum'), fBeta = () => $('fBeta');

/* Read a field's value defensively: if the Material component failed to
   upgrade (or the element is missing), return undefined instead of throwing —
   the caller turns that into a visible validation error, never a silent death. */
function fieldValue(el) {
  if (!el) return undefined;
  const v = el.value;
  return v === undefined || v === null ? undefined : v;
}
function validateConfig() {
  const errors = {};
  const baseRaw = fieldValue(fBase());
  const base = baseRaw === undefined ? '' : String(baseRaw).trim();
  if (baseRaw === undefined) errors.base = 'base_model field is not ready — UI components failed to load; reload the page';
  else if (!base) errors.base = 'base_model must be a non-empty string';
  else if (base.length > 64) errors.base = 'base_model must be at most 64 characters';

  const rawRaw = fieldValue(fRawNum());
  const raw = rawRaw === undefined ? NaN : Number(rawRaw);
  if (rawRaw === undefined) errors.raw = 'raw_examples field is not ready — UI components failed to load; reload the page';
  else if (!Number.isInteger(raw)) errors.raw = 'raw_examples must be an integer';
  else if (raw < 1000 || raw > 10000000) errors.raw = 'raw_examples must be between 1000 and 10000000';

  const seedRaw = fieldValue(fSeed());
  const seed = seedRaw === undefined ? NaN : Number(seedRaw);
  if (seedRaw === undefined) errors.seed = 'seed field is not ready — UI components failed to load; reload the page';
  else if (!Number.isInteger(seed)) errors.seed = 'seed must be an integer';
  else if (seed < 0 || seed > 2147483647) errors.seed = 'seed must be between 0 and 2147483647';

  const betaRaw = fieldValue(fBeta());
  const beta = betaRaw === undefined ? NaN : Number(betaRaw);
  if (betaRaw === undefined) errors.beta = 'dpo_beta field is not ready — UI components failed to load; reload the page';
  else if (!(beta > 0 && beta <= 1)) errors.beta = 'dpo_beta must be in (0, 1]';

  const cfg = Object.keys(errors).length ? null
    : { base_model: base, raw_examples: raw, seed, dpo_beta: beta };
  return { cfg, errors };
}
function applyFieldErrors(errors) {
  const map = { base: fBase(), raw: fRawNum(), seed: fSeed() };
  for (const [k, el] of Object.entries(map)) {
    el.error = !!errors[k];
    el.errorText = errors[k] || '';
  }
  if (errors.beta) showSnack(errors.beta);
}
function clearFieldErrors() {
  for (const el of [fBase(), fRawNum(), fSeed()]) { el.error = false; el.errorText = ''; }
}

function yamlFileName(cfg) {
  const safe = cfg.base_model.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'model';
  return `config/${safe}-${cfg.seed}.yaml`;
}
function buildYaml(cfg) {
  const name = yamlFileName(cfg);
  return [
    '# llm-finetuning-framework pipeline config',
    '# Generated by the demo composer. Replay a real run with:',
    `#   ./pipeline.sh ${name}`,
    `# NOTE: the scaffold hardcodes DPO beta=0.08 in stage_dpo (main.py:105);`,
    '# this value is recorded here for provenance but the stage uses the constant.',
    `base_model: "${cfg.base_model.replace(/"/g, '\\"')}"`,
    `raw_examples: ${cfg.raw_examples}`,
    `seed: ${cfg.seed}`,
    `dpo_beta: ${cfg.dpo_beta}`,
    '',
  ].join('\n');
}
function refreshComposerDerived() {
  const { cfg } = validateConfig();
  const rawRaw = fieldValue(fRawNum());
  const raw = rawRaw === undefined ? NaN : Number(rawRaw);
  $('rawPretty').textContent = Number.isFinite(raw) ? raw.toLocaleString('en-US') : '—';
  // kept = int(raw * 0.94 * 0.91 * 0.995) — the exact formula stage_data uses
  $('rawKept').textContent = Number.isInteger(raw) && raw >= 0
    ? Math.floor(raw * 0.94 * 0.91 * 0.995).toLocaleString('en-US') : '—';
  const betaRaw = fieldValue(fBeta());
  $('betaVal').textContent = betaRaw === undefined || !Number.isFinite(Number(betaRaw))
    ? '—' : Number(betaRaw).toFixed(2);
  if (cfg) {
    $('yamlPreview').textContent = buildYaml(cfg);
    const cmd = `./pipeline.sh ${yamlFileName(cfg)}`;
    $('reproCmd').textContent = cmd;
    // BUG-28: the model-card command and the "copy pipeline.sh" hint are
    // derived live from the composer config — never a stale hardcoded value.
    $('mcCmd').textContent = cmd;
    const pipeHint = $('pipeHintCmd');
    if (pipeHint) pipeHint.textContent = cmd;
  } else {
    $('yamlPreview').textContent = '# Fix the highlighted fields to preview the YAML config.';
  }
}

/* ---------------- stepper ---------------- */
function buildStepper() {
  const el = $('stepper');
  el.innerHTML = '';
  STAGES.forEach((s, i) => {
    const step = document.createElement('div');
    step.className = 'step todo'; step.dataset.stage = s.id; step.setAttribute('role', 'listitem');
    step.innerHTML = `
      <div class="step-body">
        <button class="step-node" data-stage="${s.id}" aria-label="${s.label} stage: not run yet">
          <span class="step-num t-label-lg">${i + 1}</span>
          <svg class="step-check" viewBox="0 0 24 24" width="20" height="20" style="display:none" aria-hidden="true">
            <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor"/>
          </svg>
        </button>
        <span class="step-label t-label-sm">${s.label}</span>
        <span class="step-dur" data-dur></span>
      </div>`;
    if (i < STAGES.length - 1) {
      const conn = document.createElement('div');
      conn.className = 'connector'; conn.innerHTML = '<span class="fill"></span>';
      step.appendChild(conn);
    }
    el.appendChild(step);
  });
  el.querySelectorAll('.step-node').forEach((b) =>
    b.addEventListener('click', () => openArtifact(STAGES.find((s) => s.id === b.dataset.stage).artifact)));
}
function setStepState(id, state, durMs = null) {
  const step = document.querySelector(`.step[data-stage="${id}"]`);
  if (!step) return;
  step.classList.remove('todo', 'active', 'done');
  step.classList.add(state);
  const node = step.querySelector('.step-node');
  node.querySelector('.step-num').style.display = state === 'done' ? 'none' : '';
  node.querySelector('.step-check').style.display = state === 'done' ? '' : 'none';
  node.setAttribute('aria-label',
    `${STAGES.find((s) => s.id === id).label} stage: ${state === 'done' ? 'complete' : state}`);
  const dur = step.querySelector('[data-dur]');
  if (durMs != null) dur.textContent = `${durMs.toFixed(2)} ms`;
  const conn = step.querySelector('.connector');
  if (conn) conn.classList.toggle('done', state === 'done');
}

/* ---------------- log ---------------- */
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function logHtml(html) {
  const log = $('log');
  const ph = log.querySelector('.log-dim');
  if (ph && log.children.length === 1 && log.textContent.includes('Press')) log.innerHTML = '';
  log.insertAdjacentHTML('beforeend', html + '\n');
  log.scrollTop = log.scrollHeight;
}
function logStatus(t) { $('logStatus').textContent = t; }

/* ---------------- DAG ---------------- */
const SVGNS = 'http://www.w3.org/2000/svg';
function buildDag() {
  const svg = $('dagSvg');
  svg.innerHTML = `
    <defs>
      <marker id="dagArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="var(--md-sys-color-outline-variant)"/>
      </marker>
    </defs>`;
  const shorten = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const t0 = (NODE_W / 2 + 8) / len, t1 = 1 - (NODE_W / 2 + 8) / len;
    return { x1: a.x + dx * t0, y1: a.y + dy * t0, x2: a.x + dx * t1, y2: a.y + dy * t1 };
  };
  for (const e of EDGES) {
    const p = shorten(NODES[e.from], NODES[e.to]);
    const line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', p.x1); line.setAttribute('y1', p.y1);
    line.setAttribute('x2', p.x2); line.setAttribute('y2', p.y2);
    line.setAttribute('class', 'dag-edge'); line.setAttribute('marker-end', 'url(#dagArrow)');
    svg.appendChild(line);
    const mx = (p.x1 + p.x2) / 2, my = (p.y1 + p.y2) / 2;
    const label = document.createElementNS(SVGNS, 'text');
    label.setAttribute('x', mx); label.setAttribute('y', my - 6);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'dag-edge-label');
    label.setAttribute('data-via', e.via);
    label.setAttribute('style', 'paint-order:stroke;stroke:var(--md-sys-color-surface-container-low);stroke-width:4px;');
    label.textContent = 'hash: pending…';
    svg.appendChild(label);
  }
  STAGES.forEach((s) => {
    const n = NODES[s.id];
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'dag-node st-todo'); g.dataset.stage = s.id;
    g.innerHTML = `
      <rect class="body" x="${n.x - NODE_W / 2}" y="${n.y - NODE_H / 2}" width="${NODE_W}" height="${NODE_H}"></rect>
      <text x="${n.x}" y="${n.y - 6}" text-anchor="middle" class="t-title-sm" fill="var(--md-sys-color-on-surface)">${esc(s.label)}</text>
      <text x="${n.x}" y="${n.y + 16}" text-anchor="middle" style="font-family:var(--md-ref-typeface-mono);font-size:11px" fill="var(--md-sys-color-on-surface-variant)">${esc(s.artifact)}</text>`;
    g.addEventListener('click', () => openArtifact(s.artifact));
    const title = document.createElementNS(SVGNS, 'title');
    title.textContent = `${s.label} — click to inspect artifact '${s.artifact}'`;
    g.appendChild(title);
    svg.appendChild(g);
  });
}
function dagNodeStyle() {
  const css = document.createElement('style');
  css.textContent = `
    .dag-node.st-todo .body { fill: var(--md-sys-color-surface-container-highest); }
    .dag-node.st-active .body { fill: var(--md-sys-color-primary-container); stroke: var(--md-sys-color-primary); stroke-width: 2; }
    .dag-node.st-done .body { fill: var(--md-sys-color-secondary-container); stroke: transparent; }`;
  document.head.appendChild(css);
}
function setDagState(id, state) {
  const g = document.querySelector(`.dag-node[data-stage="${id}"]`);
  if (g) { g.classList.remove('st-todo', 'st-active', 'st-done'); g.classList.add(`st-${state}`); }
}
function setDagHashes(byArtifact) {
  document.querySelectorAll('.dag-edge-label').forEach((t) => {
    const h = byArtifact[t.dataset.via];
    t.textContent = h ? `hash=${h}` : 'hash: pending…';
  });
}

/* ---------------- run ---------------- */
class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

/* BUG-30: pre-run the eval deltas show "—" (run the pipeline to populate),
   never mock numbers. Post-run they show the real eval_report values. */
function fmtDelta(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(2).replace(/\.?0+$/, '');
  return (n < 0 ? '−' : '+') + s;
}
function resetEvalDeltas() {
  for (const id of ['deltaMmlu', 'deltaMt', 'deltaRw']) {
    const el = $(id);
    if (el) el.textContent = '—';
  }
  for (const id of ['barMmlu', 'barMt', 'barRw']) {
    const el = $(id);
    if (el) el.value = 0;
  }
  const g = $('gaugeNum');
  if (g) g.textContent = '—';
}
function resetRunUI() {
  STAGES.forEach((s) => { setStepState(s.id, 'todo'); setDagState(s.id, 'todo'); });
  document.querySelectorAll('.step [data-dur]').forEach((d) => (d.textContent = ''));
  $('runProgress').value = 0;
  $('log').innerHTML = '';
  $('errorState').classList.add('hidden');
  setDagHashes({});
  resetEvalDeltas();
}

async function runPipeline() {
  // validateConfig is total (never throws), but belt-and-braces: a config
  // read failure must be visible, never a silent dead click.
  let cfg, errors;
  try {
    ({ cfg, errors } = validateConfig());
  } catch (e) {
    diagReport('runPipeline.validateConfig', e);
    logStatus('failed');
    showSnack('Could not read the config — see the log for details.');
    return;
  }
  if (!cfg) { applyFieldErrors(errors); showSnack('Fix the highlighted fields to run.'); return; }
  const btn = $('btnRun');
  try {
    clearFieldErrors();
    btn.disabled = true;
    resetRunUI();
    logStatus('running');
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) throw new ApiError(data.error || `Request failed (HTTP ${res.status})`, res.status);
    await reveal(data, cfg);
    logStatus('complete');
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      // server-side validation message → snackbar (per spec)
      logHtml(`<span class="log-dim">[api        ] 400 — ${esc(e.message)}</span>`);
      showSnack(e.message);
    } else {
      logHtml(`<span class="log-dim">[api        ] network failure — ${esc(e.message || e)}</span>`);
      $('errorTitle').textContent = 'Could not reach the pipeline API';
      $('errorMsg').textContent = 'The request to /api/run failed (network error or the endpoint is unavailable). Your config is intact — retry when ready.';
      $('errorState').classList.remove('hidden');
    }
    logStatus('failed');
  } finally {
    btn.disabled = false;
  }
}

async function reveal(data, cfg) {
  lastRun = data;
  const byArtifact = {};
  const stageRecs = data.stages || [];
  for (let i = 0; i < stageRecs.length; i++) {
    const rec = stageRecs[i];
    setStepState(rec.stage, 'active');
    setDagState(rec.stage, 'active');
    $('runProgress').value = i / stageRecs.length;
    logHtml(`<span>[${esc(rec.stage.padEnd(14))}] running...</span>`);
    await sleep(450);
    byArtifact[rec.artifact.name] = rec.artifact.hash;
    setStepState(rec.stage, 'done', rec.duration_ms);
    setDagState(rec.stage, 'done');
    setDagHashes(byArtifact);
    $('runProgress').value = (i + 1) / stageRecs.length;
    logHtml(`<span>[${esc(rec.stage.padEnd(14))}] -&gt; artifact '${esc(rec.artifact.name)}' <span class="log-hash">hash=${esc(rec.artifact.hash)}</span></span>`);
    logHtml(`<span class="log-dur">                      done in ${Number(rec.duration_ms).toFixed(2)} ms</span>`);
  }
  renderManifest(stageRecs);
  renderEval(data.eval_report);
  renderServe(data.endpoint);
  renderModelCard(data.model_card);
  showSnack(`Pipeline complete — 8 stages, config ${cfg.base_model} / seed ${cfg.seed}`);
}

/* ---------------- manifest ---------------- */
function renderManifest(stageRecs) {
  const body = $('manifestBody');
  body.innerHTML = '';
  stageRecs.forEach((rec, i) => {
    const a = rec.artifact;
    const tr = document.createElement('tr');
    tr.className = 'row-main';
    tr.innerHTML = `
      <td class="t-title-sm">${esc(a.name)}</td>
      <td><span class="kind-chip">${esc(a.kind)}</span></td>
      <td class="hash">${esc(a.hash)}</td>
      <td class="t-body-sm">${esc(a.produced_by)}</td>
      <td><button class="expand-btn" aria-expanded="false" aria-label="Expand payload for ${esc(a.name)}">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button></td>`;
    const ptr = document.createElement('tr');
    ptr.className = 'payload-row hidden';
    ptr.innerHTML = `<td colspan="5"><pre class="code mono">${esc(JSON.stringify(a.payload, null, 2))}</pre></td>`;
    const toggle = () => {
      const open = ptr.classList.toggle('hidden');
      tr.querySelector('.expand-btn').setAttribute('aria-expanded', String(!open));
    };
    tr.addEventListener('click', (e) => { if (!e.target.closest('.expand-btn')) toggle(); });
    tr.querySelector('.expand-btn').addEventListener('click', toggle);
    body.appendChild(tr); body.appendChild(ptr);
  });
}

/* ---------------- eval / serve / model card ---------------- */
function renderEval(rep) {
  if (!rep) return;
  const p = rep.payload || {};
  const max = Math.max(p.mmlu_pro_delta || 0, p.mt_bench_v2_delta || 0, p.rewardbench2_delta || 0, 0.001);
  $('barMmlu').value = (p.mmlu_pro_delta || 0) / max;
  $('barMt').value = (p.mt_bench_v2_delta || 0) / max;
  $('barRw').value = (p.rewardbench2_delta || 0) / max;
  // BUG-30: delta labels show the REAL artifact values, not hardcoded mocks.
  $('deltaMmlu').textContent = fmtDelta(p.mmlu_pro_delta);
  $('deltaMt').textContent = fmtDelta(p.mt_bench_v2_delta);
  $('deltaRw').textContent = fmtDelta(p.rewardbench2_delta);
  const pass = Number(p.llama_guard_4_pass || 0);
  const C = 351.86;
  $('gaugeFill').style.strokeDashoffset = String(C * (1 - pass));
  $('gaugeNum').textContent = pass.toFixed(3);
}
function renderServe(ep) {
  if (!ep) return;
  const p = ep.payload || {};
  const backend = String(p.backend || '');
  $('svBackend').textContent = backend.split(' + ')[0] || backend;
  $('svEagle').textContent = Number(p.eagle_acceptance || 0).toFixed(2);
}
function renderModelCard(mc) {
  if (!mc) return;
  const p = mc.payload || {};
  $('mcLicense').textContent = String(p.data_license_declared);
  $('mcTrainHash').textContent = p.training_config_hash || '—';
  $('mcEval').textContent = String(p.eval_attached);
  $('mcSafety').textContent = String(p.safety_attached);
  // BUG-28: the run's command is backend-derived from the run config; only
  // overwrite the live composer-derived value when the payload has one.
  if (p.reproducibility_command) $('mcCmd').textContent = p.reproducibility_command;
}

/* ---------------- artifact dialog ---------------- */
let dlgPayloadText = '';
function openArtifact(artifactName) {
  const dlg = $('artifactDialog');
  const rec = lastRun && (lastRun.stages || []).find((r) => r.artifact.name === artifactName);
  $('dlgTitle').textContent = `artifact '${artifactName}'`;
  if (!rec) {
    $('dlgMeta').innerHTML = `<dt>Status</dt><dd>No run yet — press “Run pipeline” to produce this artifact.</dd>`;
    $('dlgPayload').textContent = '∅';
    dlgPayloadText = '';
  } else {
    const a = rec.artifact;
    $('dlgMeta').innerHTML = `
      <dt>Kind</dt><dd class="mono">${esc(a.kind)}</dd>
      <dt>Hash</dt><dd class="mono">${esc(a.hash)}</dd>
      <dt>Produced by</dt><dd class="mono">${esc(a.produced_by)}</dd>
      <dt>Stage</dt><dd class="mono">${esc(rec.stage)} · ${Number(rec.duration_ms).toFixed(2)} ms</dd>`;
    dlgPayloadText = JSON.stringify(a.payload, null, 2);
    $('dlgPayload').textContent = dlgPayloadText;
  }
  // BUG-29: show() is async and can reject (e.g. showModal constraints) —
  // never let that die silently and leave UI state ambiguous.
  try {
    const r = dlg.show();
    if (r && typeof r.catch === 'function') r.catch((e) => diagReport('dialog.show', e));
  } catch (e) {
    diagReport('dialog.show', e);
  }
}

/* BUG-29: hard guarantee that closing the artifact dialog can never leave a
   stuck modal top-layer / transparent backdrop intercepting pointer events. */
async function closeArtifactDialog() {
  const dlg = $('artifactDialog');
  try { await dlg.close(); }
  catch (e) { diagReport('dialog.close', e); }
  try {
    const inner = dlg.shadowRoot && dlg.shadowRoot.querySelector('dialog');
    if (inner && inner.open) inner.close();
  } catch (e) { diagReport('dialog.force-close', e); }
  try { if (dlg.open) dlg.open = false; }
  catch (e) { diagReport('dialog.unset-open', e); }
}

/* ---------------- wiring ---------------- */
function initComposer() {
  // tabs
  const tabs = $('composerTabs');
  tabs.addEventListener('change', () => {
    const i = tabs.activeTabIndex;
    $('panelForm').classList.toggle('hidden', i !== 0);
    $('panelYaml').classList.toggle('hidden', i !== 1);
  });
  // slider <-> number sync
  fRaw().addEventListener('input', () => { fRawNum().value = fRaw().value; refreshComposerDerived(); });
  fRawNum().addEventListener('change', () => {
    let v = Math.round(Number(fRawNum().value));
    if (!Number.isFinite(v)) v = 300000;
    v = Math.min(10000000, Math.max(1000, v));
    fRawNum().value = v; fRaw().value = v; refreshComposerDerived();
  });
  fBeta().addEventListener('input', refreshComposerDerived);
  // BUG-32: keyboard/drag stepping can leave float artifacts (0.07999…) in
  // the slider's built-in value label. Snap to 2 decimals on commit, and
  // refresh the readout on every input path (mouse, touch, keyboard).
  fBeta().addEventListener('change', () => {
    const el = fBeta();
    const v = Math.round(Number(fieldValue(el)) * 100) / 100;
    if (Number.isFinite(v)) el.value = v;
    refreshComposerDerived();
  });
  for (const el of [fBase(), fSeed(), fRawNum()]) el.addEventListener('input', refreshComposerDerived);

  $('btnRun').addEventListener('click', runPipeline);
  $('btnRetry').addEventListener('click', runPipeline);

  const doYaml = () => {
    const { cfg, errors } = validateConfig();
    if (!cfg) { applyFieldErrors(errors); showSnack('Fix the highlighted fields to generate YAML.'); return; }
    clearFieldErrors();
    const name = yamlFileName(cfg).split('/').pop();
    downloadFile(name, buildYaml(cfg));
    showSnack(`Downloaded ${name}`);
  };
  $('btnYaml').addEventListener('click', doYaml);
  $('btnYaml2').addEventListener('click', doYaml);
  $('btnCopyYaml').addEventListener('click', () => {
    const t = $('yamlPreview').textContent;
    if (t.startsWith('# Fix')) { showSnack('Fix the highlighted fields first.'); return; }
    copyText(t, 'YAML config copied');
  });
  $('btnCopyCmd').addEventListener('click', () => copyText($('reproCmd').textContent, 'Reproducibility command copied'));
  $('btnCopyMc').addEventListener('click', () => copyText($('mcCmd').textContent, 'Reproducibility command copied'));
  $('btnCopyManifest').addEventListener('click', () => {
    if (!lastRun) { showSnack('Run the pipeline first.'); return; }
    copyText(JSON.stringify(lastRun.manifest, null, 2), 'Manifest JSON copied');
  });
  $('btnCopyReal').addEventListener('click', () => copyText($('realCmds').textContent, 'Commands copied'));
  // BUG-28: copy the LIVE reproducibility command, not a hardcoded placeholder.
  $('btnCopyPipe').addEventListener('click', () => copyText($('reproCmd').textContent, 'Command copied'));

  // BUG-29: the dialogAction="close" attribute is a no-op in this Material Web
  // build, so the close path lives entirely here — and it is hardened.
  $('dlgClose').addEventListener('click', closeArtifactDialog);
  $('dlgCopy').addEventListener('click', () => {
    if (!dlgPayloadText) { showSnack('Nothing to copy yet.'); return; }
    copyText(dlgPayloadText, 'Artifact payload copied');
  });
  $('snackAction').addEventListener('click', hideSnack);

  refreshComposerDerived();
}

function initChrome() {
  const bar = $('topbar');
  addEventListener('scroll', () => bar.classList.toggle('scrolled', scrollY > 4), { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  // BUG-25: each init phase is guarded so a single throwing phase can never
  // silently abort button wiring or the automatic first run. Failures are
  // reported loudly via the diag logger instead of dying quiet.
  const phase = (name, fn) => {
    try { fn(); }
    catch (e) { diagReport(`init:${name}`, e); }
  };
  phase('theme', initTheme);
  phase('chrome', initChrome);
  phase('stepper', buildStepper);
  phase('dag-style', dagNodeStyle);
  phase('dag', buildDag);
  phase('composer', initComposer);
  // component sanity: if the Material bundle failed to register, say so
  // visibly instead of leaving a dead page.
  try {
    const missing = ['md-filled-button', 'md-outlined-text-field', 'md-slider', 'md-tabs', 'md-dialog']
      .filter((t) => !window.customElements.get(t));
    if (missing.length) {
      diagReport('init:components', new Error(`unregistered components: ${missing.join(', ')}`));
      showSnack('UI components failed to load — reload the page.');
    }
  } catch (e) { diagReport('init:components-check', e); }
  // first impression: run the default config immediately.
  // runPipeline is async: a synchronous throw becomes a rejection, so .catch
  // it explicitly — an unhandled rejection here was the silent killer.
  try {
    const r = runPipeline();
    if (r && typeof r.catch === 'function') r.catch((e) => diagReport('auto-run', e));
  } catch (e) {
    diagReport('auto-run-sync', e);
  }
});
