"""Pipeline package: vendored original + faithful demo port."""

from .pipeline import (
    PIPELINE,
    Artifact,
    Manifest,
    run_pipeline,
    run_pipeline_traced,
)

__all__ = [
    "PIPELINE",
    "Artifact",
    "Manifest",
    "run_pipeline",
    "run_pipeline_traced",
]
