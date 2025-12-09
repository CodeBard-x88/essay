"""Data preparation script for essay grading pipeline.

This module loads the raw dataset, cleans text fields, performs a train/validation
split, and saves the processed datasets for downstream training. All paths and
column names are driven by the YAML configuration for reproducibility.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, Tuple

import pandas as pd
import yaml


class Config:
    """Simple configuration wrapper for convenient attribute access."""

    def __init__(self, cfg: Dict):
        self.experiment_name = cfg.get("experiment_name", "experiment")
        self.data = cfg.get("data", {})
        self.training = cfg.get("training", {})

    @classmethod
    def from_yaml(cls, path: Path) -> "Config":
        with path.open("r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        return cls(cfg)


class TextCleaner:
    """Utility for normalizing essay text."""

    @staticmethod
    def clean(text: str) -> str:
        normalized = text.lower().strip()
        # Collapse multiple spaces and line breaks into a single space.
        normalized = " ".join(normalized.split())
        return normalized


class DataPreparer:
    """Handles dataset loading, cleaning, splitting, and persistence."""

    def __init__(self, config: Config):
        self.config = config
        self.text_column = self.config.data.get("text_column", "essay")
        self.label_column = self.config.data.get("label_column", "score")
        self.val_size = float(self.config.data.get("val_size", 0.2))
        self.random_state = int(self.config.training.get("seed", 42))
        self.raw_path = Path(self.config.data.get("raw_path", "model/data/training_data.csv"))
        self.train_path = Path(self.config.data.get("train_path", "model/training/data/train.csv"))
        self.val_path = Path(self.config.data.get("val_path", "model/training/data/val.csv"))

    def load_raw(self) -> pd.DataFrame:
        if not self.raw_path.exists():
            raise FileNotFoundError(f"Raw dataset not found at {self.raw_path}")
        df = pd.read_csv(self.raw_path)
        return df

    def preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        missing_cols = {self.text_column, self.label_column} - set(df.columns)
        if missing_cols:
            raise KeyError(f"Dataset missing required columns: {missing_cols}")

        processed = df.copy()
        processed[self.text_column] = processed[self.text_column].astype(str).map(TextCleaner.clean)
        processed[self.label_column] = pd.to_numeric(processed[self.label_column], errors="coerce")
        processed = processed.dropna(subset=[self.text_column, self.label_column])
        return processed

    def split(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        df = df.sample(frac=1.0, random_state=self.random_state).reset_index(drop=True)
        split_idx = int(len(df) * (1 - self.val_size))
        train_df = df.iloc[:split_idx]
        val_df = df.iloc[split_idx:]
        return train_df, val_df

    def save(self, train_df: pd.DataFrame, val_df: pd.DataFrame) -> None:
        for path in [self.train_path, self.val_path]:
            path.parent.mkdir(parents=True, exist_ok=True)
        train_df.to_csv(self.train_path, index=False)
        val_df.to_csv(self.val_path, index=False)

    def summarize(self, train_df: pd.DataFrame, val_df: pd.DataFrame) -> None:
        print(f"Experiment: {self.config.experiment_name}")
        print(f"Raw dataset: {self.raw_path}")
        print(f"Processed train rows: {len(train_df)}")
        print(f"Processed val rows: {len(val_df)}")
        if len(train_df) > 0:
            avg_len = train_df[self.text_column].str.split().str.len().mean()
            print(f"Average training essay length (tokens): {avg_len:.2f}")

    def run(self) -> None:
        raw_df = self.load_raw()
        processed_df = self.preprocess(raw_df)
        train_df, val_df = self.split(processed_df)
        self.save(train_df, val_df)
        self.summarize(train_df, val_df)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare dataset for essay model training")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("model/training/config/base.yaml"),
        help="Path to YAML configuration file",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = Config.from_yaml(args.config)
    preparer = DataPreparer(config)
    preparer.run()


if __name__ == "__main__":
    main()
