"""Evaluation script for the essay grading model."""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import torch
import yaml
from torch import nn
from torch.utils.data import DataLoader, Dataset


@dataclass
class Config:
    experiment_name: str
    data: Dict
    model: Dict
    training: Dict
    artifacts: Dict

    @classmethod
    def from_yaml(cls, path: Path) -> "Config":
        with path.open("r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        return cls(
            experiment_name=cfg.get("experiment_name", "experiment"),
            data=cfg.get("data", {}),
            model=cfg.get("model", {}),
            training=cfg.get("training", {}),
            artifacts=cfg.get("artifacts", {}),
        )


class SimpleTokenizer:
    """Tokenizer counterpart used during training."""

    def __init__(self, unk_token: str = "<unk>", pad_token: str = "<pad>", max_vocab_size: int = 20000):
        self.unk_token = unk_token
        self.pad_token = pad_token
        self.max_vocab_size = max_vocab_size
        self.itos: List[str] = []
        self.stoi: Dict[str, int] = {}

    @property
    def pad_token_id(self) -> int:
        return self.stoi.get(self.pad_token, 0)

    def encode(self, text: str) -> List[int]:
        return [self.stoi.get(tok, self.stoi.get(self.unk_token, 1)) for tok in text.split()]

    @classmethod
    def load(cls, path: Path) -> "SimpleTokenizer":
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        tokenizer = cls(
            unk_token=payload.get("unk_token", "<unk>"),
            pad_token=payload.get("pad_token", "<pad>"),
            max_vocab_size=int(payload.get("max_vocab_size", 20000)),
        )
        tokenizer.itos = payload.get("itos", [])
        tokenizer.stoi = {tok: idx for idx, tok in enumerate(tokenizer.itos)}
        return tokenizer


class EssayDataset(Dataset):
    def __init__(self, texts: List[str], labels: List[float], tokenizer: SimpleTokenizer):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> Tuple[List[int], float]:
        tokens = self.tokenizer.encode(self.texts[idx])
        label = float(self.labels[idx])
        return tokens, label


def collate_batch(batch: List[Tuple[List[int], float]], pad_token_id: int):
    token_lists, labels = zip(*batch)
    lengths = torch.tensor([len(t) for t in token_lists], dtype=torch.long)
    max_len = max(lengths).item() if lengths.numel() > 0 else 0

    padded = torch.full((len(token_lists), max_len), fill_value=pad_token_id, dtype=torch.long)
    for i, tokens in enumerate(token_lists):
        if tokens:
            padded[i, : len(tokens)] = torch.tensor(tokens, dtype=torch.long)

    label_tensor = torch.tensor(labels, dtype=torch.float)
    return padded, lengths, label_tensor


class LSTMEssayRegressor(nn.Module):
    def __init__(self, vocab_size: int, embedding_dim: int, hidden_dim: int, num_layers: int, dropout: float, padding_idx: int):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embedding_dim, padding_idx=padding_idx)
        self.lstm = nn.LSTM(
            input_size=embedding_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.regressor = nn.Linear(hidden_dim, 1)

    def forward(self, input_ids: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        embedded = self.embedding(input_ids)
        packed = torch.nn.utils.rnn.pack_padded_sequence(embedded, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, (hidden, _) = self.lstm(packed)
        last_hidden = hidden[-1]
        output = self.regressor(last_hidden)
        return output.squeeze(1)


def load_split(config: Config) -> pd.DataFrame:
    val_path = Path(config.data.get("val_path", "model/training/data/val.csv"))
    if not val_path.exists():
        raise FileNotFoundError("Validation split not found. Run data_prep.py first.")
    return pd.read_csv(val_path)


def load_artifacts(config: Config) -> Tuple[SimpleTokenizer, Dict]:
    artifacts_dir = Path(config.artifacts.get("dir", "model/training/artifacts"))
    model_path = artifacts_dir / config.artifacts.get("model_filename", "essay_regressor.pt")
    tokenizer_path = artifacts_dir / config.artifacts.get("tokenizer_filename", "tokenizer.json")

    if not model_path.exists() or not tokenizer_path.exists():
        raise FileNotFoundError("Artifacts missing. Train the model before evaluation.")

    tokenizer = SimpleTokenizer.load(tokenizer_path)
    state_dict = torch.load(model_path, map_location="cpu")
    return tokenizer, state_dict


def compute_metrics(preds: List[float], labels: List[float]) -> Dict[str, float]:
    preds_arr = np.array(preds)
    labels_arr = np.array(labels)
    mse = float(np.mean((preds_arr - labels_arr) ** 2))
    mae = float(np.mean(np.abs(preds_arr - labels_arr)))
    return {"mse": mse, "mae": mae}


def evaluate_model(config: Config) -> Dict[str, float]:
    val_df = load_split(config)
    text_col = config.data.get("text_column", "essay")
    label_col = config.data.get("label_column", "score")

    tokenizer, state_dict = load_artifacts(config)
    vocab_size = max(1, len(tokenizer.itos))
    model = LSTMEssayRegressor(
        vocab_size=vocab_size,
        embedding_dim=int(config.model.get("embedding_dim", 128)),
        hidden_dim=int(config.model.get("hidden_dim", 256)),
        num_layers=int(config.model.get("num_layers", 2)),
        dropout=float(config.model.get("dropout", 0.3)),
        padding_idx=int(config.model.get("padding_idx", 0)),
    )

    model.load_state_dict(state_dict)

    val_dataset = EssayDataset(val_df[text_col].tolist(), val_df[label_col].tolist(), tokenizer)
    dataloader = DataLoader(
        val_dataset,
        batch_size=int(config.training.get("batch_size", 32)),
        shuffle=False,
        collate_fn=lambda batch: collate_batch(batch, tokenizer.pad_token_id),
    )

    device = torch.device(config.training.get("device", "cpu"))
    model.to(device)
    model.eval()

    preds: List[float] = []
    labels: List[float] = []
    with torch.no_grad():
        for batch in dataloader:
            input_ids, lengths, label_tensor = [x.to(device) for x in batch]
            outputs = model(input_ids, lengths)
            preds.extend(outputs.cpu().numpy().tolist())
            labels.extend(label_tensor.cpu().numpy().tolist())

    metrics = compute_metrics(preds, labels)
    artifacts_dir = Path(config.artifacts.get("dir", "model/training/artifacts"))
    metrics_path = artifacts_dir / config.artifacts.get("metrics_filename", "metrics.json")
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("Evaluation metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate the trained essay model")
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
    evaluate_model(config)


if __name__ == "__main__":
    main()
