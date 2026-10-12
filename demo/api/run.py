"""Vercel Python serverless function: run the deterministic pipeline DAG.

This file is deployed by Vercel as the `/api/run` endpoint. It follows the
documented Vercel Python pattern: `class handler(BaseHTTPRequestHandler)`
with do_GET / do_POST methods.

  POST /api/run  JSON body {"base_model","raw_examples","seed","dpo_beta"}
      -> 200 JSON {"stages":[...8 records...],
                   "manifest":[{"name","kind","hash","produced_by"}],
                   "eval_report": {...artifact...},
                   "endpoint": {...artifact...},
                   "model_card": {...artifact...},
                   "config_echo": {...}}
      -> 400 JSON {"error": "..."} on invalid/missing input
  any other method -> 405 JSON {"error": "Method not allowed"}

Stdlib only. No credentials, no network calls. All metrics are deterministic
SIMULATIONS of an MLOps pipeline (synthetic numbers), not real GPU training;
the demo UI must label runs as simulations.
"""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

# Make the project root (which contains the `pipeline/` package) importable
# both on Vercel and when run locally for testing.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from pipeline.pipeline import run_pipeline_traced  # noqa: E402

MAX_BODY_BYTES = 64 * 1024


def _is_int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _validate(cfg: dict) -> str | None:
    """Return an error message string if cfg is invalid, else None."""
    if not isinstance(cfg, dict):
        return "body must be a JSON object"
    expected = {"base_model", "raw_examples", "seed", "dpo_beta"}
    missing = expected - set(cfg.keys())
    if missing:
        return f"missing required keys: {sorted(missing)}"
    extra = set(cfg.keys()) - expected
    if extra:
        return f"unexpected keys: {sorted(extra)}"

    base_model = cfg["base_model"]
    if not isinstance(base_model, str) or not base_model.strip():
        return "base_model must be a non-empty string"
    if len(base_model) > 64:
        return "base_model must be at most 64 characters"

    raw_examples = cfg["raw_examples"]
    if not _is_int(raw_examples):
        return "raw_examples must be an integer"
    if not (1_000 <= raw_examples <= 10_000_000):
        return "raw_examples must be between 1000 and 10000000"

    seed = cfg["seed"]
    if not _is_int(seed):
        return "seed must be an integer"
    if not (0 <= seed <= 2_147_483_647):
        return "seed must be between 0 and 2147483647"

    beta = cfg["dpo_beta"]
    if isinstance(beta, bool) or not isinstance(beta, (int, float)):
        return "dpo_beta must be a number"
    if not (0.0 < float(beta) <= 1.0):
        return "dpo_beta must be in (0, 1]"

    return None


def _artifact_view(art: dict) -> dict:
    return {
        "name": art["name"],
        "kind": art["kind"],
        "hash": art["hash"],
        "produced_by": art["produced_by"],
        "payload": art["payload"],
    }


def run_pipeline_request(cfg: dict) -> dict:
    """Pure request logic (testable without HTTP). Raises ValueError on bad cfg."""
    err = _validate(cfg)
    if err:
        raise ValueError(err)
    # Normalise numeric types for a stable echo.
    cfg_norm = {
        "base_model": cfg["base_model"].strip(),
        "raw_examples": int(cfg["raw_examples"]),
        "seed": int(cfg["seed"]),
        "dpo_beta": float(cfg["dpo_beta"]),
    }
    stages = run_pipeline_traced(cfg_norm)
    by_stage = {r["stage"]: r for r in stages}
    manifest = [
        {
            "name": r["artifact"]["name"],
            "kind": r["artifact"]["kind"],
            "hash": r["artifact"]["hash"],
            "produced_by": r["artifact"]["produced_by"],
        }
        for r in stages
    ]
    return {
        "stages": stages,
        "manifest": manifest,
        "eval_report": _artifact_view(by_stage["eval"]["artifact"]),
        "endpoint": _artifact_view(by_stage["serve"]["artifact"]),
        "model_card": _artifact_view(by_stage["model_card"]["artifact"]),
        "config_echo": cfg_norm,
    }


class handler(BaseHTTPRequestHandler):
    server_version = "llm-finetuning-demo/1.0"

    def _send_json(self, status: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 (Vercel handler convention)
        self._send_json(405, {"error": "Method not allowed; use POST with a JSON config body"})

    def do_POST(self) -> None:  # noqa: N802 (Vercel handler convention)
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError):
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send_json(400, {"error": f"request body must be 1..{MAX_BODY_BYTES} bytes"})
            return
        try:
            raw = self.rfile.read(length)
            cfg = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(400, {"error": "request body must be valid JSON"})
            return
        try:
            result = run_pipeline_request(cfg)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self._send_json(200, result)

    # Only GET and POST are defined; every other method falls through here.
    def _method_not_allowed(self) -> None:
        self._send_json(405, {"error": "Method not allowed; use POST with a JSON config body"})

    do_PUT = _method_not_allowed  # noqa: N802
    do_DELETE = _method_not_allowed  # noqa: N802
    do_PATCH = _method_not_allowed  # noqa: N802
    do_HEAD = _method_not_allowed  # noqa: N802
    do_OPTIONS = _method_not_allowed  # noqa: N802

    def log_message(self, fmt: str, *args) -> None:  # keep serverless logs quiet
        pass
