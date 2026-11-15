# Limitations

Written down so nobody has to discover them in an interview.

## The metrics are synthetic

Every number in `eval_report` and `endpoint` is a constant in `main.py`. No model was trained, no benchmark was run, no GPU exists behind this repository. The README says so at the top and the demo says so in a banner. If you need measured deltas, this is the wrong repository.

## The manifest is in memory

`Manifest` lives for the duration of `run_pipeline`. Nothing is persisted, so "show me the manifest from last Tuesday" has no answer. The fix is small — write `as_report()` to SQLite or object storage with the run config — and it is not done here.

## Hashes are truncated to 48 bits

`content_hash()` returns the first 12 hex characters of a SHA-256. That is fine for distinguishing artifacts inside one manifest and inadequate as a security control: 48 bits is collision-resistant against accident, not against an adversary. Use the full digest if the manifest ever crosses a trust boundary.

## The contamination check scans nothing

`stage_contamination` reports zero overlap for three benchmark names by construction. It does not read a corpus and does not run MinHash. The artifact shape is right; the work is not done.

## Validation covers the config keys the stages use, not a schema

`validate_config` checks `base_model`, `raw_examples` and `dpo_beta`. Unknown keys are ignored rather than rejected, so a typo in an optional key passes silently. A schema (pydantic or a dataclass) would be the next step.

## The demo copy can drift

`demo/pipeline/pipeline.py` is vendored, not imported. When a stage changes in `main.py`, the demo must be updated by hand. The header states the upstream file, but nothing enforces the sync. A CI job that diffs the stage functions would close this.

## No packaging, no versioning

There is no `pyproject.toml` and no released version. `main.py` is a script with importable functions. That is deliberate for a study repository, and it means you cannot `pip install` it.
