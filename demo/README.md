# llm-finetuning-framework — interactive demo

Live, zero-login demo of the full LLM fine-tuning pipeline DAG, with a
Material 3 (Google Material) interface.

- **Original project:** [dev4aibots/llm-finetuning-framework](https://github.com/dev4aibots/llm-finetuning-framework)
  — this `demo/` subdirectory is an additive, self-contained web demo; the
  original project code is untouched.
- **What it does:** you configure a base model, dataset size, seed, and DPO
  beta, then the demo runs the complete 8-stage pipeline — data ingest →
  contamination check → SFT → DPO → quantize → serve → eval → model card —
  and renders the DAG, per-stage artifacts (hashes, produced_by, payloads),
  and a downloadable model card.

## Honesty note

All pipeline stages are **deterministic simulations**: `api/run.py` executes
the real ported pipeline math (seeded PRNGs, the original dossier's formulas),
but no real training happens and no GPU exists behind it. Metrics are
synthetic by design — the demo exists to show the MLOps workflow and
artifact provenance, not to claim real model quality. Nothing leaves your
browser except the JSON config POSTed to `/api/run`.

## Run it

- **Live:** deployed on Vercel from this directory (`vercel.json` not needed —
  static root + Python serverless functions are auto-detected).
- **Locally:** serve this directory with any static server, e.g.
  `python3 -m http.server 8080` in this folder, then open
  http://localhost:8080. The `/api/run` endpoint needs a Vercel-style Python
  serverless runtime; locally you can exercise the pipeline logic directly:
  `python3 -c "import sys; sys.path.insert(0,'.'); from api.run import
  run_pipeline_request; print(run_pipeline_request({'base_model':'llama-3-8b','raw_examples':100000,'seed':42,'dpo_beta':0.1}))"`.

## API

`POST /api/run` with JSON `{"base_model":str,"raw_examples":int,"seed":int,"dpo_beta":float}`
→ `200 {"stages":[...8...],"manifest":[...],"eval_report":{},"endpoint":{},"model_card":{},"config_echo":{}}`
(each stage: `{stage, artifact:{name,kind,hash,produced_by,payload}, duration_ms}`).
Other methods → `405`.

No credentials, no external network — stdlib Python only.

## Packaging note

The Material Web bundle (`web/js/material-bundle.js`) is self-contained, but
ships here as `js/material-bundle.part1/2/3.js` (byte-exact thirds) plus a
tiny `js/material-bundle.js` loader that fetches the parts, concatenates them,
and imports the result via a blob URL — the push path caps single calls at
~120KB and the full bundle is 235KB. The loader's top-level await guarantees
components register before `app.js` runs.
