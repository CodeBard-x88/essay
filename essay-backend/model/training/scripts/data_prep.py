"""
Data preparation script for the essay grading project.

Steps performed:
1. Load configuration from YAML.
2. Read the raw CSV dataset.
3. Clean text: lowercase, strip, collapse whitespace.
4. Split into train/validation sets.
5. Save processed splits to disk for downstream training.

This module is intentionally lightweight and modular so it can be
extended with richer preprocessing (e.g., tokenization, spellcheck,
augmentations) without disrupting the training pipeline.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

import pandas as pd
import yaml


@dataclass
class DatasetConfig:
    raw_path: Path
    processed_train_path: Path
    processed_val_path: Path
    text_column: str
    label_column: str
    validation_size: float
    shuffle: bool


@dataclass
class Config:
    experiment_name: str
    data: DatasetConfig


def load_config(config_path: Path) -> Config:
    """Load YAML configuration and map it to Config dataclasses."""
    with config_path.open("r") as f:
        cfg_dict = yaml.safe_load(f)

    data_cfg = cfg_dict.get("data", {})

    return Config(
        experiment_name=cfg_dict.get("experiment_name", "default_experiment"),
        data=DatasetConfig(
            raw_path=Path(data_cfg.get("raw_path")),
            processed_train_path=Path(data_cfg.get("processed_train_path")),
            processed_val_path=Path(data_cfg.get("processed_val_path")),
            text_column=data_cfg.get("text_column", "text"),
            label_column=data_cfg.get("label_column", "label"),
            validation_size=float(data_cfg.get("validation_size", 0.2)),
            shuffle=bool(data_cfg.get("shuffle", True)),
        ),
    )


def clean_text(text: str) -> str:
    """Basic text cleaning to normalize whitespace and casing."""
    if not isinstance(text, str):
        return ""
    normalized = " ".join(text.lower().strip().split())
    return normalized


def load_dataset(cfg: DatasetConfig) -> pd.DataFrame:
    """Load the raw dataset from CSV using the configured path."""
    if not cfg.raw_path.exists():
        raise FileNotFoundError(f"Raw dataset not found at {cfg.raw_path}")
    df = pd.read_csv(cfg.raw_path)
    expected_columns = {cfg.text_column, cfg.label_column}
    if not expected_columns.issubset(df.columns):
        missing = expected_columns.difference(df.columns)
        raise ValueError(f"Missing columns in dataset: {missing}")
    return df[[cfg.text_column, cfg.label_column]].copy()


def preprocess_dataset(df: pd.DataFrame, cfg: DatasetConfig) -> pd.DataFrame:
    """Apply cleaning to the text column and drop rows with missing labels."""
    df[cfg.text_column] = df[cfg.text_column].astype(str).apply(clean_text)
    df = df.dropna(subset=[cfg.label_column])
    return df


def split_dataset(df: pd.DataFrame, cfg: DatasetConfig) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Split the dataset into train and validation sets."""
    if cfg.shuffle:
        df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
    val_size = cfg.validation_size
    val_count = int(len(df) * val_size)
    val_df = df.iloc[:val_count].reset_index(drop=True)
    train_df = df.iloc[val_count:].reset_index(drop=True)
    return train_df, val_df


def save_splits(train_df: pd.DataFrame, val_df: pd.DataFrame, cfg: DatasetConfig) -> None:
    """Persist train and validation splits to disk."""
    cfg.processed_train_path.parent.mkdir(parents=True, exist_ok=True)
    cfg.processed_val_path.parent.mkdir(parents=True, exist_ok=True)
    train_df.to_csv(cfg.processed_train_path, index=False)
    val_df.to_csv(cfg.processed_val_path, index=False)


def print_stats(train_df: pd.DataFrame, val_df: pd.DataFrame, cfg: DatasetConfig) -> None:
    """Print basic dataset statistics to stdout."""
    stats = {
        "train_samples": len(train_df),
        "val_samples": len(val_df),
        "train_label_mean": float(train_df[cfg.label_column].mean()),
        "val_label_mean": float(val_df[cfg.label_column].mean()),
    }
    print(json.dumps(stats, indent=2))


def run(config_path: Path) -> None:
    cfg = load_config(config_path)
    raw_df = load_dataset(cfg.data)
    processed_df = preprocess_dataset(raw_df, cfg.data)
    train_df, val_df = split_dataset(processed_df, cfg.data)
    save_splits(train_df, val_df, cfg.data)
    print_stats(train_df, val_df, cfg.data)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare data for model training")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("training/config/base.yaml"),
        help="Path to YAML configuration file",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = parse_args(sys.argv[1:])
    run(args.config)
