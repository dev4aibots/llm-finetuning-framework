# Architecture

## Shape

One process, no services, no dependencies.

```
config dict
    │
    ▼
validate_config ── errors collected, raised once
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ run_pipeline                                                 │
│                                                              │
│  data ──▶ contamination ──▶ sft ──▶ dpo ──▶ quantize ──▶     │
│                                                serve ──▶     │
│                                                eval  ──▶     │
│                                                model_card    │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
Manifest (ordered dict of Artifact)
    │
    ├── summary()   → name, kind, hash, producer
    └── as_report() → JSON, sorted keys, payload included
```

`main.PIPELINE` is the single source of stage order. `run_pipeline` walks it, passes the manifest built so far to each stage, and appends the artifact the stage returns. A stage may only read artifacts that already exist, so the list is also the dependency order.

## Artifact

```python
@dataclass
class Artifact:
    name: str          # "dataset", "eval_report", ...
    kind: str          # dataset | checkpoint | quant | endpoint | report
    payload: dict      # everything the stage produced
    produced_by: str   # the tool that would own this stage in production
    produced_at: float # wall clock, excluded from the hash
```

`content_hash()` is `sha256(json.dumps(payload, sort_keys=True))[:12]`. Sorting keys makes the hash independent of dict insertion order; excluding `produced_at` makes it independent of when the run happened.

## Lineage rule

An artifact that consumes another artifact stores the producer's `content_hash()` in its own payload:

| Consumer | Key | Points at |
|---|---|---|
| `contamination_check` | `dataset_hash` | `dataset` |
| `sft_checkpoint` | `dataset_hash` | `dataset` |
| `dpo_checkpoint` | `from` | `sft_checkpoint` |
| `quants` | `from` | `dpo_checkpoint` |
| `endpoint` | `from` | `quants` |
| `eval_report` | `from` | `dpo_checkpoint` |
| `model_card` | `training_config_hash`, `eval_hash` | `sft_checkpoint`, `eval_report` |

Because the hash covers the whole payload, and the payload contains the upstream hash, a change propagates: changing the seed changes `dataset`, which changes `sft_checkpoint`, and so on to `model_card`. `tests/test_pipeline.py` asserts each row of the table.

## Execution model

Every stage is a pure function of `(manifest, config)`. There is no I/O, no randomness beyond the recorded seed, and no clock in any payload. That is what makes the byte-for-byte reproducibility check in CI possible: two `python main.py --json` runs produce identical files.

The simulation is deliberate. The repository exists to exercise the bookkeeping of a run, and bookkeeping is easiest to test when the stages are cheap and deterministic. See `docs/evaluation.md` for what would change with a real training backend.

## Demo copy

`demo/pipeline/pipeline.py` is a vendored port of the stages with one addition (`run_pipeline_traced`) that records per-stage durations for the UI. The stage functions are kept in sync with `main.py`; when the endpoint's `from` key was added, it was added in both places. The demo header states that stage metrics are simulations and that any UI built on it must label runs as such.
