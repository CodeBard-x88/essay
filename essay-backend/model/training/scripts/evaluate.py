"""
Evaluation script for the essay scoring model.

Loads saved artifacts, runs validation inference, and reports metrics.
Ready for integration with experiment tracking (e.g., MLflow) by
wrapping metric logging where indicated.
"""

from __future__ import annotations

import argparse
import contextlib
import json
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


@dataclass
class DatasetConfig:
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
    device: str
    seed: int


@dataclass
class ArtifactConfig:
    output_dir: Path
    model_filename: str
    tokenizer_filename: str
    metrics_filename: str
    evaluation_metrics_filename: str
    evaluation_report_filename: str


@dataclass
class MLflowConfig:
    tracking_uri: str
    experiment_name: str
    run_name: str
    log_artifacts: bool = True


@dataclass
class Config:
    data: DatasetConfig
    model: ModelConfig
    training: TrainingConfig
    artifacts: ArtifactConfig
    mlflow: Optional[MLflowConfig]


class SimpleTokenizer:
    """
    Minimal tokenizer mirroring the training-time placeholder.

    TODO: Swap with your production tokenizer when available.
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

    def encode(self, text: str) -> List[int]:
        tokens = text.split()
        ids = [self.word_index.get(token, self.unk_id) for token in tokens]
        return ids[: self.max_seq_len]

    @classmethod
    def from_file(cls, path: Path) -> "SimpleTokenizer":
        with path.open("r") as f:
            data = json.load(f)
        tokenizer = cls(
            max_vocab_size=int(data.get("max_vocab_size", 0)),
            max_seq_len=int(data.get("max_seq_len", 0)),
        )
        tokenizer.word_index = {k: int(v) for k, v in data.get("word_index", {}).items()}
        tokenizer.index_word = {idx: token for token, idx in tokenizer.word_index.items()}
        tokenizer.pad_id = int(data.get("pad_id", 0))
        tokenizer.unk_id = int(data.get("unk_id", 1))
        return tokenizer


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


def build_dataloader(dataset: EssayDataset, batch_size: int, pad_id: int, max_seq_len: int) -> DataLoader:
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=lambda batch: collate_batch(batch, pad_id, max_seq_len),
    )


class TextRegressor(nn.Module):
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


def set_seed(seed: int) -> None:
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
        data=DatasetConfig(
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
            device=str(training_cfg.get("device", "cpu")),
            seed=int(training_cfg.get("seed", 42)),
        ),
        artifacts=ArtifactConfig(
            output_dir=Path(artifact_cfg.get("output_dir", "training/artifacts")),
            model_filename=artifact_cfg.get("model_filename", "model.pt"),
            tokenizer_filename=artifact_cfg.get("tokenizer_filename", "tokenizer.json"),
            metrics_filename=artifact_cfg.get("metrics_filename", "metrics.json"),
            evaluation_metrics_filename=artifact_cfg.get(
                "evaluation_metrics_filename", "eval_metrics.json"
            ),
            evaluation_report_filename=artifact_cfg.get(
                "evaluation_report_filename", "evaluation_report.txt"
            ),
        ),
        mlflow=mlflow_config,
    )


def compute_metrics(preds: np.ndarray, labels: np.ndarray) -> Dict[str, float]:
    mse = float(np.mean((preds - labels) ** 2))
    mae = float(np.mean(np.abs(preds - labels)))
    rmse = float(np.sqrt(mse))
    return {"mse": mse, "mae": mae, "rmse": rmse}


def run_evaluation(config_path: Path) -> None:
    cfg = load_config(config_path)
    set_seed(cfg.training.seed)
    device = torch.device(cfg.training.device)

    mlflow_enabled = mlflow is not None and cfg.mlflow is not None
    if mlflow_enabled:
        mlflow.set_tracking_uri(cfg.mlflow.tracking_uri)
        mlflow.set_experiment(cfg.mlflow.experiment_name)

    run_context = (
        mlflow.start_run(run_name=f"{cfg.mlflow.run_name}-eval", nested=True)
        if mlflow_enabled
        else contextlib.nullcontext()
    )

    with run_context:
        # Load artifacts
        tokenizer_path = cfg.artifacts.output_dir / cfg.artifacts.tokenizer_filename
        model_path = cfg.artifacts.output_dir / cfg.artifacts.model_filename
        tokenizer = SimpleTokenizer.from_file(tokenizer_path)

        vocab_size = len(tokenizer.word_index)
        model = TextRegressor(vocab_size=vocab_size, cfg=cfg.model, pad_id=tokenizer.pad_id)
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.to(device)
        model.eval()

        # Load validation data
        val_df = pd.read_csv(cfg.data.processed_val_path)
        val_dataset = EssayDataset(
            texts=val_df[cfg.data.text_column].tolist(),
            labels=val_df[cfg.data.label_column].tolist(),
            tokenizer=tokenizer,
        )
        val_loader = build_dataloader(
            val_dataset, cfg.training.batch_size, tokenizer.pad_id, cfg.data.max_seq_len
        )

        preds_list: List[float] = []
        labels_list: List[float] = []

        with torch.no_grad():
            for batch_inputs, batch_labels in val_loader:
                batch_inputs = batch_inputs.to(device)
                batch_labels = batch_labels.to(device)
                outputs = model(batch_inputs)
                preds_list.append(outputs.cpu().numpy())
                labels_list.append(batch_labels.cpu().numpy())

        preds = np.concatenate(preds_list)
        labels = np.concatenate(labels_list)
        metrics = compute_metrics(preds, labels)

        cfg.artifacts.output_dir.mkdir(parents=True, exist_ok=True)
        metrics_path = (
            cfg.artifacts.output_dir / cfg.artifacts.evaluation_metrics_filename
        )
        report_path = (
            cfg.artifacts.output_dir / cfg.artifacts.evaluation_report_filename
        )
        with metrics_path.open("w") as f:
            json.dump(metrics, f, indent=2)
        with report_path.open("w") as report_file:
            report_file.write("Evaluation Report\n")
            report_file.write(json.dumps(metrics, indent=2))

        # Optional MLflow logging for evaluation
        if mlflow_enabled:
            mlflow.log_metrics({f"eval_{k}": v for k, v in metrics.items()})
            if cfg.mlflow.log_artifacts:
                mlflow.log_artifact(str(metrics_path))
                mlflow.log_artifact(str(report_path))

        print(json.dumps(metrics, indent=2))


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate essay scoring model")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("training/config/base.yaml"),
        help="Path to YAML configuration file",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = parse_args(sys.argv[1:])
    run_evaluation(args.config)
