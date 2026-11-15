# Engineering decisions

## Content hash instead of a filename or a run id

`checkpoints/final` is a name that two runs can share, and "which checkpoint is this?" is the question the whole repository exists to answer. A SHA-256 over the canonical payload is either equal or not equal; there is no ambiguity to resolve later. The hash is truncated to 12 hex characters because it is an identity within a manifest, not a security boundary, and short ids are readable in a terminal.

Rejected: a monotonically increasing run number (needs shared state), a UUID (says nothing about content), a timestamp (says nothing about content and breaks reproducibility).

## `produced_at` is recorded but excluded from the hash

Wall-clock time is useful when debugging "when did this run?" and harmful when comparing "is this the same artifact?". Including it makes every re-run a different artifact, which defeats the point of the hash. The field stays on the dataclass and out of `content_hash()`, and `test_content_hash_ignores_production_time` pins that decision.

## Validation at the boundary, not inside stages

`run_pipeline` calls `validate_config` before the first stage. The earlier version raised `KeyError: 'base_model'` from inside `stage_sft`, after the data and contamination stages had already printed output — a confusing failure with a misleading traceback. The current version collects every problem and raises one `ValueError` naming all of them, which is asserted by `test_reports_every_problem_at_once`.

## Stages are pure functions

No stage touches the network, the filesystem or `random`. The seed is a config value, and every metric is a constant. This makes a full run take milliseconds, makes the output deterministic, and lets the tests assert the DAG's properties without mocking anything. The trade-off is explicit: the metrics are not measurements. `docs/evaluation.md` says what measuring them would require.

## The endpoint and the model card carry their inputs

The first version of the pipeline failed its own premise in two places:

- `stage_serve` fetched the quantized artifact and then did not record which one it served.
- `stage_model_card` set `eval_attached: true` without storing the eval artifact's hash.

Both are exactly the failure this repository is supposed to prevent — an artifact that claims provenance without carrying it. Both were fixed in `main.py` and in the vendored demo copy, and both now have a test.

## The demo vendors the stages instead of importing them

The demo deploys as its own static site with a Python serverless function; importing from the parent directory would make the deploy depend on files outside its root. The copy is mechanical and the demo header names the upstream file. The cost is that a stage change must be applied twice, which is a real maintenance smell; the alternative is a shared package, which is more machinery than this repo needs.
