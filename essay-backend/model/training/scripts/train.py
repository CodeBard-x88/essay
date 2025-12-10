"""
Training script for essay scoring model.

Designed to be modular so you can easily swap out the tokenizer/model
with your production-grade components.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import yaml
from torch import nn
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader, Dataset

try:
    import mlflow
except ImportError:  # pragma: no cover - optional dependency
    mlflow = None


# ---------------------------------------------------------------------------
# Configuration dataclasses
# ---------------------------------------------------------------------------


@dataclass
class DatasetConfig:
    processed_train_path: Path
    processed_val_path: Path
    text_column: str
    label_column: str
    max_seq_len: int
    max_vocab_size: int


@dataclass
class ModelConfig:
    embedding_dim: int
    hidden_dim: int
    num_layers: int
    dropout: float


@dataclass
class TrainingConfig:
    batch_size: int
    lr: float
    epochs: int
    weight_decay: float
    device: str
    seed: int
    grad_clip: float


@dataclass
class ArtifactConfig:
    output_dir: Path
    model_filename: str
    tokenizer_filename: str
    metrics_filename: str


@dataclass
class MLflowConfig:
    tracking_uri: str
    experiment_name: str
    run_name: str
    log_artifacts: bool = True


@dataclass
class Config:
    experiment_name: str
    data: DatasetConfig
    model: ModelConfig
    training: TrainingConfig
    artifacts: ArtifactConfig
    mlflow: Optional[MLflowConfig]


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def load_config(config_path: Path) -> Config:
    with config_path.open("r") as f:
        cfg = yaml.safe_load(f)

    data_cfg = cfg.get("data", {})
    model_cfg = cfg.get("model", {})
    training_cfg = cfg.get("training", {})
    artifact_cfg = cfg.get("artifacts", {})
    mlflow_cfg = cfg.get("mlflow") or None

    mlflow_config = None
    if mlflow_cfg:
        mlflow_config = MLflowConfig(
            tracking_uri=str(mlflow_cfg.get("tracking_uri", "file:mlruns")),
            experiment_name=str(mlflow_cfg.get("experiment_name", cfg.get("experiment_name", "default_experiment"))),
            run_name=str(mlflow_cfg.get("run_name", "training")),
            log_artifacts=bool(mlflow_cfg.get("log_artifacts", True)),
        )

    return Config(
        experiment_name=cfg.get("experiment_name", "default_experiment"),
        data=DatasetConfig(
            processed_train_path=Path(data_cfg.get("processed_train_path")),
            processed_val_path=Path(data_cfg.get("processed_val_path")),
            text_column=data_cfg.get("text_column", "text"),
            label_column=data_cfg.get("label_column", "label"),
            max_seq_len=int(data_cfg.get("max_seq_len", model_cfg.get("max_seq_len", 256))),
            max_vocab_size=int(data_cfg.get("max_vocab_size", model_cfg.get("max_vocab_size", 20000))),
        ),
        model=ModelConfig(
            embedding_dim=int(model_cfg.get("embedding_dim", 128)),
            hidden_dim=int(model_cfg.get("hidden_dim", 256)),
            num_layers=int(model_cfg.get("num_layers", 2)),
            dropout=float(model_cfg.get("dropout", 0.2)),
        ),
        training=TrainingConfig(
            batch_size=int(training_cfg.get("batch_size", 32)),
            lr=float(training_cfg.get("lr", 1e-3)),
            epochs=int(training_cfg.get("epochs", 5)),
            weight_decay=float(training_cfg.get("weight_decay", 0.0)),
            device=str(training_cfg.get("device", "cpu")),
            seed=int(training_cfg.get("seed", 42)),
            grad_clip=float(training_cfg.get("grad_clip", 1.0)),
        ),
        artifacts=ArtifactConfig(
            output_dir=Path(artifact_cfg.get("output_dir", "training/artifacts")),
            model_filename=artifact_cfg.get("model_filename", "model.pt"),
            tokenizer_filename=artifact_cfg.get("tokenizer_filename", "tokenizer.json"),
            metrics_filename=artifact_cfg.get("metrics_filename", "metrics.json"),
        ),
        mlflow=mlflow_config,
    )


# ---------------------------------------------------------------------------
# Tokenizer (placeholder implementation)
# ---------------------------------------------------------------------------


class SimpleTokenizer:
    """
    Minimal tokenizer to convert text into integer token ids.

    TODO: Replace with your production tokenizer (e.g., HuggingFace).
    """

    PAD_TOKEN = "<PAD>"
    UNK_TOKEN = "<UNK>"

    def __init__(self, max_vocab_size: int, max_seq_len: int):
        self.max_vocab_size = max_vocab_size
        self.max_seq_len = max_seq_len
        self.word_index: Dict[str, int] = {}
        self.index_word: Dict[int, str] = {}
        self.pad_id: int = 0
        self.unk_id: int = 1

    def fit(self, texts: Iterable[str]) -> None:
        freq: Dict[str, int] = {}
        for text in texts:
            for token in text.split():
                freq[token] = freq.get(token, 0) + 1
        # Reserve 0 for PAD and 1 for UNK
        sorted_tokens = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)
        limited_tokens = sorted_tokens[: self.max_vocab_size - 2]
        self.word_index = {self.PAD_TOKEN: self.pad_id, self.UNK_TOKEN: self.unk_id}
        for idx, (token, _) in enumerate(limited_tokens, start=2):
            self.word_index[token] = idx
        self.index_word = {idx: token for token, idx in self.word_index.items()}

    def encode(self, text: str) -> List[int]:
        tokens = text.split()
        ids = [self.word_index.get(token, self.unk_id) for token in tokens]
        return ids[: self.max_seq_len]

    def to_dict(self) -> Dict[str, object]:
        return {
            "word_index": self.word_index,
            "max_vocab_size": self.max_vocab_size,
            "max_seq_len": self.max_seq_len,
            "pad_id": self.pad_id,
            "unk_id": self.unk_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "SimpleTokenizer":
        tokenizer = cls(
            max_vocab_size=int(data.get("max_vocab_size", 0)),
            max_seq_len=int(data.get("max_seq_len", 0)),
        )
        tokenizer.word_index = {k: int(v) for k, v in data.get("word_index", {}).items()}
        tokenizer.index_word = {idx: token for token, idx in tokenizer.word_index.items()}
        tokenizer.pad_id = int(data.get("pad_id", 0))
        tokenizer.unk_id = int(data.get("unk_id", 1))
        return tokenizer


# ---------------------------------------------------------------------------
# Dataset and DataLoader utilities
# ---------------------------------------------------------------------------


class EssayDataset(Dataset):
    def __init__(self, texts: List[str], labels: List[float], tokenizer: SimpleTokenizer):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> Tuple[List[int], float]:
        text = self.texts[idx]
        label = float(self.labels[idx])
        token_ids = self.tokenizer.encode(text)
        return token_ids, label


def collate_batch(batch: List[Tuple[List[int], float]], pad_id: int, max_seq_len: int) -> Tuple[torch.Tensor, torch.Tensor]:
    sequences, labels = zip(*batch)
    tensor_seqs = [torch.tensor(seq, dtype=torch.long) for seq in sequences]
    padded = pad_sequence(tensor_seqs, batch_first=True, padding_value=pad_id)
    if padded.size(1) < max_seq_len:
        pad_size = max_seq_len - padded.size(1)
        pad_tensor = torch.full((padded.size(0), pad_size), pad_id, dtype=torch.long)
        padded = torch.cat([padded, pad_tensor], dim=1)
    else:
        padded = padded[:, :max_seq_len]
    labels_tensor = torch.tensor(labels, dtype=torch.float)
    return padded, labels_tensor


def build_dataloader(dataset: EssayDataset, batch_size: int, pad_id: int, max_seq_len: int, shuffle: bool) -> DataLoader:
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        collate_fn=lambda batch: collate_batch(batch, pad_id, max_seq_len),
    )


# ---------------------------------------------------------------------------
# Model (placeholder implementation)
# ---------------------------------------------------------------------------


class TextRegressor(nn.Module):
    """
    Simple LSTM-based regressor.

    TODO: Replace with project-specific architecture.
    """

    def __init__(self, vocab_size: int, cfg: ModelConfig, pad_id: int):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, cfg.embedding_dim, padding_idx=pad_id)
        self.lstm = nn.LSTM(
            input_size=cfg.embedding_dim,
            hidden_size=cfg.hidden_dim,
            num_layers=cfg.num_layers,
            dropout=cfg.dropout,
            batch_first=True,
        )
        self.dropout = nn.Dropout(cfg.dropout)
        self.fc = nn.Linear(cfg.hidden_dim, 1)

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        embedded = self.embedding(input_ids)
        outputs, (hidden, _) = self.lstm(embedded)
        final_hidden = hidden[-1]
        logits = self.fc(self.dropout(final_hidden))
        return logits.squeeze(-1)


# ---------------------------------------------------------------------------
# Training / Evaluation loops
# ---------------------------------------------------------------------------


def train_one_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
    grad_clip: float,
) -> float:
    model.train()
    total_loss = 0.0
    for batch_inputs, batch_labels in dataloader:
        batch_inputs = batch_inputs.to(device)
        batch_labels = batch_labels.to(device)

        optimizer.zero_grad()
        preds = model(batch_inputs)
        loss = criterion(preds, batch_labels)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
        optimizer.step()
        total_loss += loss.item() * len(batch_inputs)
    return total_loss / len(dataloader.dataset)


def evaluate(model: nn.Module, dataloader: DataLoader, criterion: nn.Module, device: torch.device) -> float:
    model.eval()
    total_loss = 0.0
    with torch.no_grad():
        for batch_inputs, batch_labels in dataloader:
            batch_inputs = batch_inputs.to(device)
            batch_labels = batch_labels.to(device)
            preds = model(batch_inputs)
            loss = criterion(preds, batch_labels)
            total_loss += loss.item() * len(batch_inputs)
    return total_loss / len(dataloader.dataset)


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def save_artifacts(model: nn.Module, tokenizer: SimpleTokenizer, cfg: Config, metrics: Dict[str, float]) -> Dict[str, Path]:
    cfg.artifacts.output_dir.mkdir(parents=True, exist_ok=True)
    model_path = cfg.artifacts.output_dir / cfg.artifacts.model_filename
    tokenizer_path = cfg.artifacts.output_dir / cfg.artifacts.tokenizer_filename
    metrics_path = cfg.artifacts.output_dir / cfg.artifacts.metrics_filename

    torch.save(model.state_dict(), model_path)
    with tokenizer_path.open("w") as f:
        json.dump(tokenizer.to_dict(), f, indent=2)
    with metrics_path.open("w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved model to {model_path}")
    print(f"Saved tokenizer to {tokenizer_path}")
    print(f"Saved metrics to {metrics_path}")
    return {"model": model_path, "tokenizer": tokenizer_path, "metrics": metrics_path}


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def run_training(config_path: Path) -> None:
    cfg = load_config(config_path)
    set_seed(cfg.training.seed)

    device = torch.device(cfg.training.device)

    mlflow_enabled = mlflow is not None and cfg.mlflow is not None
    if mlflow_enabled:
        # Configure MLflow tracking
        mlflow.set_tracking_uri(cfg.mlflow.tracking_uri)
        mlflow.set_experiment(cfg.mlflow.experiment_name)

    run_context = (
        mlflow.start_run(run_name=cfg.mlflow.run_name) if mlflow_enabled else contextlib.nullcontext()
    )

    with run_context:
        # Load preprocessed splits
        train_df = pd.read_csv(cfg.data.processed_train_path)
        val_df = pd.read_csv(cfg.data.processed_val_path)

        # Initialize tokenizer
        tokenizer = SimpleTokenizer(cfg.data.max_vocab_size, cfg.data.max_seq_len)
        tokenizer.fit(train_df[cfg.data.text_column].tolist())

        # Build datasets and dataloaders
        train_dataset = EssayDataset(
            texts=train_df[cfg.data.text_column].tolist(),
            labels=train_df[cfg.data.label_column].tolist(),
            tokenizer=tokenizer,
        )
        val_dataset = EssayDataset(
            texts=val_df[cfg.data.text_column].tolist(),
            labels=val_df[cfg.data.label_column].tolist(),
            tokenizer=tokenizer,
        )

        train_loader = build_dataloader(
            train_dataset, cfg.training.batch_size, tokenizer.pad_id, cfg.data.max_seq_len, shuffle=True
        )
        val_loader = build_dataloader(
            val_dataset, cfg.training.batch_size, tokenizer.pad_id, cfg.data.max_seq_len, shuffle=False
        )

        vocab_size = len(tokenizer.word_index)
        model = TextRegressor(vocab_size=vocab_size, cfg=cfg.model, pad_id=tokenizer.pad_id)
        model.to(device)

        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(
            model.parameters(),
            lr=cfg.training.lr,
            weight_decay=cfg.training.weight_decay,
        )

        if mlflow_enabled:
            # Log hyperparameters for reproducibility
            mlflow.log_params(
                {
                    "experiment_name": cfg.experiment_name,
                    "model.embedding_dim": cfg.model.embedding_dim,
                    "model.hidden_dim": cfg.model.hidden_dim,
                    "model.num_layers": cfg.model.num_layers,
                    "model.dropout": cfg.model.dropout,
                    "model.max_vocab_size": cfg.data.max_vocab_size,
                    "model.max_seq_len": cfg.data.max_seq_len,
                    "training.batch_size": cfg.training.batch_size,
                    "training.lr": cfg.training.lr,
                    "training.epochs": cfg.training.epochs,
                    "training.weight_decay": cfg.training.weight_decay,
                    "training.device": cfg.training.device,
                    "training.seed": cfg.training.seed,
                    "training.grad_clip": cfg.training.grad_clip,
                }
            )

        history = {"train_loss": [], "val_loss": []}
        for epoch in range(1, cfg.training.epochs + 1):
            train_loss = train_one_epoch(
                model, train_loader, optimizer, criterion, device, cfg.training.grad_clip
            )
            val_loss = evaluate(model, val_loader, criterion, device)
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_loss)
            print(
                f"Epoch {epoch}/{cfg.training.epochs} - Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}"
            )

            if mlflow_enabled:
                mlflow.log_metric("train_loss", train_loss, step=epoch)
                mlflow.log_metric("val_loss", val_loss, step=epoch)

        metrics = {
            "final_train_loss": history["train_loss"][-1],
            "final_val_loss": history["val_loss"][-1],
        }

        artifact_paths = save_artifacts(model, tokenizer, cfg, metrics)

        if mlflow_enabled:
            mlflow.log_metrics(metrics)
            if cfg.mlflow.log_artifacts:
                # Log saved artifacts for reproducibility and inspection
                for artifact_path in artifact_paths.values():
                    mlflow.log_artifact(str(artifact_path))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train essay scoring model")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("training/config/base.yaml"),
        help="Path to YAML configuration file",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = parse_args(sys.argv[1:])
    run_training(args.config)
