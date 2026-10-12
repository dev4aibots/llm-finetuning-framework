// Split-bundle loader for the Material Web component bundle.
//
// The full bundle (js/material-bundle.js) is self-contained (no relative
// imports) but exceeds the per-call size limit of the push path used to ship
// this demo, so it is stored as three byte-exact parts that are concatenated
// here. `app.js` imports this file for its side effects (custom-element
// registration); the top-level await below guarantees components register
// before any dependent module body runs.
//
// BUG-25 hardening: the loader used to fail SILENTLY — a rejected import
// here aborts the entire app module (no buttons wired, no auto-run, no error
// shown). Now every failure path is LOUD: a fallback evaluation strategy,
// then a visible fatal banner + rethrow as a last resort.
const partUrls = ['./material-bundle.part1.js', './material-bundle.part2.js', './material-bundle.part3.js'];

function loaderFatal(message) {
  try { console.error('[material-bundle loader] FATAL:', message); } catch { /* noop */ }
  try {
    const host = document.documentElement || document;
    const div = document.createElement('div');
    div.setAttribute('role', 'alert');
    div.style.cssText = 'position:fixed;inset:auto 16px 16px 16px;z-index:99999;'
      + 'background:#8C1D18;color:#fff;font:14px/1.5 system-ui,sans-serif;'
      + 'padding:16px 20px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.4);';
    div.textContent = 'This demo failed to load its UI components (' + message + '). '
      + 'Reload the page; if it persists, the deployment is missing js/material-bundle.part*.js.';
    const btn = document.createElement('button');
    btn.textContent = 'Reload';
    btn.style.cssText = 'margin-left:12px;padding:6px 14px;border:none;border-radius:4px;cursor:pointer;';
    btn.onclick = () => location.reload();
    div.appendChild(btn);
    host.appendChild(div);
  } catch { /* banner itself must never throw */ }
}

const texts = await Promise.all(
  partUrls.map(async (u) => {
    const res = await fetch(new URL(u, import.meta.url));
    if (!res.ok) throw new Error(`material-bundle loader: failed to fetch ${u} (${res.status})`);
    return res.text();
  }),
);
const source = texts.join('');
let loaded = false;
let lastError = null;
// Strategy 1 (shipped, proven): dynamic import of a blob module URL.
try {
  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  await import(/* @vite-ignore */ blobUrl);
  loaded = true;
} catch (e) {
  lastError = e;
}
// Strategy 2 (fallback): classic script injection. The bundle has no
// import/export statements, so module semantics are not required.
// A syntax error here surfaces as a window error event, not a synchronous
// throw, so verify by checking that components actually registered.
if (!loaded) {
  try {
    const s = document.createElement('script');
    s.textContent = source;
    (document.head || document.documentElement).appendChild(s);
    loaded = typeof customElements !== 'undefined' && !!customElements.get('md-filled-button');
    if (!loaded) lastError = new Error('classic script fallback: components did not register');
  } catch (e) {
    lastError = e;
  }
}
if (!loaded) {
  const msg = lastError && lastError.message ? lastError.message : String(lastError);
  loaderFatal(msg);
  throw new Error(`material-bundle loader: all strategies failed (${msg})`);
}
