# Evaluation

## What the eval stage produces

```json
{
  "from": "ef90ec046fe3",
  "mmlu_pro_delta": 3.2,
  "mt_bench_v2_delta": 0.41,
  "rewardbench2_delta": 0.08,
  "llama_guard_4_pass": 0.987
}
```

`from` is the content hash of the DPO checkpoint. That is the only field in this payload that is a fact about the run. The four metric values are constants in `stage_eval`, identical for every config, and are present to give the artifact the shape a real eval report would have.

## Why the numbers are not measured

Measuring them requires a base model, a held-out set, a GPU and a harness. None of those are in this repository, and inventing plausible numbers would make every downstream claim — "the model improved", "safety passed" — unfalsifiable. The repository is about the pipeline around a run, so the evaluation stage demonstrates the contract (an eval report names the checkpoint it scored) without pretending to satisfy it.

## What a real evaluation would need

If this were wired to a training backend, the eval artifact would carry:

1. **A frozen held-out set** with a content hash, committed before training, so the same examples cannot be used for both training and evaluation. The contamination stage exists to check this and currently reports zero overlap because there is no real corpus to scan.
2. **Per-example outputs**, not only aggregates, so a reviewer can inspect the failures instead of trusting a delta.
3. **A confidence interval** on every delta. A +3.2 on a 500-example benchmark with a wide interval is not the same claim as +3.2 on 10,000 examples, and a bare point estimate hides that.
4. **The judge**, if one is used. A model-graded benchmark is only as good as the judge's agreement with humans on a sample, and that agreement has to be measured and reported.
5. **A cost and latency record** for the eval run itself, because an evaluation that cannot be re-run within a budget rots.

## What the current tests do assert

- The eval report exists, is a report artifact, and names the DPO checkpoint it scored.
- The model card carries the eval report's hash, so the card cannot point at a different evaluation.
- A different seed changes upstream hashes, which would change the eval report's `from` — the lineage is live, not decorative.

Those are properties of the bookkeeping. They are checkable without a GPU, which is exactly why they are the ones this repository checks.
