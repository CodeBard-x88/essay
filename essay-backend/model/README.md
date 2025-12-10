# Model Service

This directory contains the essay grading model service, including training pipelines.

## DVC Tracking
- Track raw datasets under `training/data/raw/` (e.g., `training/data/raw/raw_essays.csv`).
- Track processed training/validation splits generated in `training/data/`.
- Track training artifacts in `training/artifacts/` (models, tokenizers, metrics).

Initialize DVC in this folder (`cd essay-backend/model && dvc init`) and use `dvc add` to version these assets.
