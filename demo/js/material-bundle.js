// Split-bundle loader for the Material Web component bundle.
//
// The full bundle (web/js/material-bundle.js) is self-contained (no relative
// imports) but exceeds the per-call size limit of the push path used to ship
// this demo, so it is stored as three byte-exact parts that are concatenated
// here. `app.js` imports this file for its side effects (custom-element
// registration); the top-level await below guarantees components register
// before any dependent module body runs.
const partUrls = ['./material-bundle.part1.js', './material-bundle.part2.js', './material-bundle.part3.js'];
const texts = await Promise.all(
  partUrls.map(async (u) => {
    const res = await fetch(new URL(u, import.meta.url));
    if (!res.ok) throw new Error(`material-bundle loader: failed to fetch ${u} (${res.status})`);
    return res.text();
  }),
);
const blobUrl = URL.createObjectURL(new Blob([texts.join('')], { type: 'text/javascript' }));
await import(/* @vite-ignore */ blobUrl);
