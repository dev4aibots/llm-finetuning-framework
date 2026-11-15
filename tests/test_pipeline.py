"""Tests for the pipeline DAG and its artifact lineage.

The stage maths is a deterministic simulation, so these tests do not assert
model quality. They assert the property the repository actually exists for:
every artifact names what produced it and which upstream artifact it consumed,
and the whole run is reproducible byte-for-byte.

Run:  python -m unittest discover -s tests -t . -v
"""

from __future__ import annotations

import json
import unittest

import main


CFG = {
    "base_model": "llama-3.3-8b",
    "raw_examples": 300_000,
    "seed": 7,
    "dpo_beta": 0.08,
}

HASH_PATTERN = r"^[0-9a-f]{12}$"


class PipelineShapeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = main.run_pipeline(CFG, log=False)

    def test_runs_every_stage_in_the_documented_order(self) -> None:
        self.assertEqual(
            [name for name, _ in main.PIPELINE],
            ["data", "contamination", "sft", "dpo", "quantize", "serve", "eval", "model_card"],
        )
        self.assertEqual(
            list(self.manifest.artifacts),
            [
                "dataset",
                "contamination_check",
                "sft_checkpoint",
                "dpo_checkpoint",
                "quants",
                "endpoint",
                "eval_report",
                "model_card",
            ],
        )

    def test_every_artifact_names_its_producer_and_has_a_short_hash(self) -> None:
        for artifact in self.manifest.artifacts.values():
            self.assertTrue(artifact.produced_by, f"{artifact.name} has no producer")
            self.assertRegex(artifact.content_hash(), HASH_PATTERN)

    def test_contamination_check_names_the_dataset_it_scanned(self) -> None:
        dataset = self.manifest.get("dataset")
        report = self.manifest.get("contamination_check")
        self.assertEqual(report.payload["dataset_hash"], dataset.content_hash())

    def test_sft_names_the_dataset_hash(self) -> None:
        self.assertEqual(
            self.manifest.get("sft_checkpoint").payload["dataset_hash"],
            self.manifest.get("dataset").content_hash(),
        )

    def test_dpo_names_the_checkpoint_it_started_from(self) -> None:
        self.assertEqual(
            self.manifest.get("dpo_checkpoint").payload["from"],
            self.manifest.get("sft_checkpoint").content_hash(),
        )

    def test_quantization_names_the_checkpoint_it_compressed(self) -> None:
        self.assertEqual(
            self.manifest.get("quants").payload["from"],
            self.manifest.get("dpo_checkpoint").content_hash(),
        )

    def test_endpoint_names_the_weights_it_serves(self) -> None:
        # Without this link "which artifact is in production?" has no answer.
        self.assertEqual(
            self.manifest.get("endpoint").payload["from"],
            self.manifest.get("quants").content_hash(),
        )

    def test_eval_names_the_checkpoint_it_scored(self) -> None:
        self.assertEqual(
            self.manifest.get("eval_report").payload["from"],
            self.manifest.get("dpo_checkpoint").content_hash(),
        )

    def test_model_card_carries_both_the_training_and_eval_hashes(self) -> None:
        card = self.manifest.get("model_card").payload
        self.assertEqual(card["training_config_hash"], self.manifest.get("sft_checkpoint").content_hash())
        self.assertEqual(card["eval_hash"], self.manifest.get("eval_report").content_hash())

    def test_summary_covers_every_artifact(self) -> None:
        summary = self.manifest.summary()
        self.assertEqual(len(summary), len(self.manifest.artifacts))
        self.assertEqual({row[0] for row in summary}, set(self.manifest.artifacts))


class DeterminismTests(unittest.TestCase):
    def test_two_runs_produce_identical_hashes(self) -> None:
        first = main.run_pipeline(CFG, log=False)
        second = main.run_pipeline(CFG, log=False)
        self.assertEqual(first.summary(), second.summary())

    def test_a_different_seed_changes_the_dataset_hash(self) -> None:
        base = main.run_pipeline(CFG, log=False)
        other = main.run_pipeline({**CFG, "seed": 11}, log=False)
        self.assertNotEqual(base.get("dataset").content_hash(), other.get("dataset").content_hash())

    def test_content_hash_ignores_production_time(self) -> None:
        one = main.Artifact("dataset", "dataset", {"a": 1}, produced_by="test", produced_at=1.0)
        two = main.Artifact("dataset", "dataset", {"a": 1}, produced_by="test", produced_at=2.0)
        self.assertEqual(one.content_hash(), two.content_hash())

    def test_content_hash_is_order_independent_for_payload_keys(self) -> None:
        one = main.Artifact("x", "report", {"a": 1, "b": 2}, produced_by="test")
        two = main.Artifact("x", "report", {"b": 2, "a": 1}, produced_by="test")
        self.assertEqual(one.content_hash(), two.content_hash())


class DataAccountingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = main.run_pipeline(CFG, log=False).get("dataset").payload

    def test_rows_only_disappear(self) -> None:
        self.assertLessEqual(self.payload["after_dedup"], self.payload["raw_examples"])
        self.assertLessEqual(self.payload["after_quality"], self.payload["after_dedup"])
        self.assertLessEqual(self.payload["after_pii_scrub"], self.payload["after_quality"])

    def test_the_seed_is_recorded_on_the_artifact(self) -> None:
        self.assertEqual(self.payload["seed"], CFG["seed"])

    def test_contamination_report_covers_three_benchmarks_and_is_clean(self) -> None:
        report = main.run_pipeline(CFG, log=False).get("contamination_check").payload
        self.assertEqual(
            [row["bench"] for row in report["overlaps"]],
            ["MMLU-Pro", "MT-Bench-v2", "RewardBench-2"],
        )
        self.assertEqual(report["status"], "clean")


class ConfigValidationTests(unittest.TestCase):
    def test_missing_base_model_gives_one_clear_error(self) -> None:
        with self.assertRaises(ValueError) as caught:
            main.run_pipeline({"base_model": ""}, log=False)
        self.assertIn("base_model is required", str(caught.exception))

    def test_dpo_beta_must_be_a_probability(self) -> None:
        for beta in (0, -0.1, 1.5):
            with self.assertRaises(ValueError):
                main.run_pipeline({**CFG, "dpo_beta": beta}, log=False)

    def test_raw_examples_must_be_positive(self) -> None:
        with self.assertRaises(ValueError):
            main.run_pipeline({**CFG, "raw_examples": 0}, log=False)

    def test_reports_every_problem_at_once(self) -> None:
        with self.assertRaises(ValueError) as caught:
            main.run_pipeline({"base_model": "", "raw_examples": 0, "dpo_beta": 9}, log=False)
        message = str(caught.exception)
        self.assertIn("base_model", message)
        self.assertIn("raw_examples", message)
        self.assertIn("dpo_beta", message)


class ReportTests(unittest.TestCase):
    def test_json_report_round_trips(self) -> None:
        report = main.as_report(main.run_pipeline(CFG, log=False))
        encoded = json.dumps(report, sort_keys=True)
        decoded = json.loads(encoded)
        self.assertEqual(len(decoded["artifacts"]), 8)
        self.assertEqual(decoded["pipeline"][0], "data")
        self.assertEqual(decoded["pipeline"][-1], "model_card")

    def test_report_keeps_the_payload_for_every_stage(self) -> None:
        report = main.as_report(main.run_pipeline(CFG, log=False))
        for artifact in report["artifacts"]:
            self.assertIsInstance(artifact["payload"], dict)
            self.assertTrue(artifact["hash"])


if __name__ == "__main__":
    unittest.main()
