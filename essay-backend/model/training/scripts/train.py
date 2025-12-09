"""Training pipeline for the essay grading model.

This script is intentionally modular and well-documented so the tokenizer
and model can be swapped with production-ready components later.
"""
from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import torch
import yaml
from torch import nn
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence
from torch.utils.data import DataLoader, Dataset


# -----------------------------
# Configuration utilities
# -----------------------------


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


# -----------------------------
# Reproducibility
# -----------------------------


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.use_deterministic_algorithms(False)


# -----------------------------
# Tokenizer (placeholder)
# -----------------------------


class SimpleTokenizer:
    """Whitespace tokenizer with frequency-based vocabulary.

    TODO: Replace with domain-specific tokenizer (e.g., SentencePiece, HF tokenizer).
    """

    def __init__(self, unk_token: str = "<unk>", pad_token: str = "<pad>", max_vocab_size: int = 20000):
        self.unk_token = unk_token
        self.pad_token = pad_token
        self.max_vocab_size = max_vocab_size
        self.stoi: Dict[str, int] = {}
        self.itos: List[str] = []

    def fit(self, texts: List[str]) -> None:
        frequency: Dict[str, int] = {}
        for text in texts:
            for token in text.split():
                frequency[token] = frequency.get(token, 0) + 1

        sorted_tokens = sorted(frequency.items(), key=lambda x: x[1], reverse=True)
        vocab_tokens = [self.pad_token, self.unk_token]
        vocab_tokens.extend([tok for tok, _ in sorted_tokens[: self.max_vocab_size - len(vocab_tokens)]])

        self.stoi = {tok: idx for idx, tok in enumerate(vocab_tokens)}
        self.itos = vocab_tokens

    @property
    def pad_token_id(self) -> int:
        return self.stoi.get(self.pad_token, 0)

    def encode(self, text: str) -> List[int]:
        if not self.stoi:
            raise ValueError("Tokenizer vocabulary is empty. Call fit() first.")
        return [self.stoi.get(tok, self.stoi[self.unk_token]) for tok in text.split()]

    def save(self, path: Path) -> None:
        payload = {
            "unk_token": self.unk_token,
            "pad_token": self.pad_token,
            "max_vocab_size": self.max_vocab_size,
            "itos": self.itos,
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

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


# -----------------------------
# Dataset and DataLoader
# -----------------------------


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


def collate_batch(batch: List[Tuple[List[int], float]], pad_token_id: int) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    token_lists, labels = zip(*batch)
    lengths = torch.tensor([len(t) for t in token_lists], dtype=torch.long)
    max_len = max(lengths).item() if lengths.numel() > 0 else 0

    padded = torch.full((len(token_lists), max_len), fill_value=pad_token_id, dtype=torch.long)
    for i, tokens in enumerate(token_lists):
        if tokens:
            padded[i, : len(tokens)] = torch.tensor(tokens, dtype=torch.long)

    label_tensor = torch.tensor(labels, dtype=torch.float)
    return padded, lengths, label_tensor


# -----------------------------
# Model (placeholder)
# -----------------------------


class LSTMEssayRegressor(nn.Module):
    """Simple LSTM-based regressor.

    TODO: Replace with production-grade model architecture.
    """

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
        packed = pack_padded_sequence(embedded, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, (hidden, _) = self.lstm(packed)
        last_hidden = hidden[-1]
        output = self.regressor(last_hidden)
        return output.squeeze(1)


# -----------------------------
# Training utilities
# -----------------------------


def load_splits(config: Config) -> Tuple[pd.DataFrame, pd.DataFrame]:
    train_path = Path(config.data.get("train_path", "model/training/data/train.csv"))
    val_path = Path(config.data.get("val_path", "model/training/data/val.csv"))
    if not train_path.exists() or not val_path.exists():
        raise FileNotFoundError("Processed train/val splits not found. Run data_prep.py first.")
    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    return train_df, val_df


def build_tokenizer(train_texts: List[str], model_cfg: Dict) -> SimpleTokenizer:
    tokenizer = SimpleTokenizer(max_vocab_size=int(model_cfg.get("max_vocab_size", 20000)))
    tokenizer.fit(train_texts)
    return tokenizer


def create_dataloaders(config: Config, tokenizer: SimpleTokenizer, train_df: pd.DataFrame, val_df: pd.DataFrame) -> Tuple[DataLoader, DataLoader]:
    text_col = config.data.get("text_column", "essay")
    label_col = config.data.get("label_column", "score")

    train_dataset = EssayDataset(train_df[text_col].tolist(), train_df[label_col].tolist(), tokenizer)
    val_dataset = EssayDataset(val_df[text_col].tolist(), val_df[label_col].tolist(), tokenizer)

    batch_size = int(config.training.get("batch_size", 32))
    pad_id = tokenizer.pad_token_id

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=lambda batch: collate_batch(batch, pad_id),
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=lambda batch: collate_batch(batch, pad_id),
    )

    return train_loader, val_loader


def train_epoch(model: nn.Module, dataloader: DataLoader, criterion: nn.Module, optimizer: torch.optim.Optimizer, device: torch.device) -> float:
    model.train()
    total_loss = 0.0
    for batch in dataloader:
        input_ids, lengths, labels = [x.to(device) for x in batch]
        optimizer.zero_grad()
        outputs = model(input_ids, lengths)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * labels.size(0)
    return total_loss / max(1, len(dataloader.dataset))


def evaluate(model: nn.Module, dataloader: DataLoader, criterion: nn.Module, device: torch.device) -> float:
    model.eval()
    total_loss = 0.0
    with torch.no_grad():
        for batch in dataloader:
            input_ids, lengths, labels = [x.to(device) for x in batch]
            outputs = model(input_ids, lengths)
            loss = criterion(outputs, labels)
            total_loss += loss.item() * labels.size(0)
    return total_loss / max(1, len(dataloader.dataset))


def save_artifacts(config: Config, model: nn.Module, tokenizer: SimpleTokenizer, metrics: Dict[str, List[float]]) -> None:
    artifacts_dir = Path(config.artifacts.get("dir", "model/training/artifacts"))
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    model_path = artifacts_dir / config.artifacts.get("model_filename", "essay_regressor.pt")
    torch.save(model.state_dict(), model_path)

    tokenizer_path = artifacts_dir / config.artifacts.get("tokenizer_filename", "tokenizer.json")
    tokenizer.save(tokenizer_path)

    metrics_path = artifacts_dir / config.artifacts.get("metrics_filename", "metrics.json")
    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"Saved model to {model_path}")
    print(f"Saved tokenizer to {tokenizer_path}")
    print(f"Saved metrics to {metrics_path}")


# -----------------------------
# Main entrypoint
# -----------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train essay grading model")
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
    set_seed(int(config.training.get("seed", 42)))

    train_df, val_df = load_splits(config)

    text_col = config.data.get("text_column", "essay")
    tokenizer = build_tokenizer(train_df[text_col].tolist(), config.model)

    train_loader, val_loader = create_dataloaders(config, tokenizer, train_df, val_df)

    device = torch.device(config.training.get("device", "cpu"))
    vocab_size = len(tokenizer.itos)
    model = LSTMEssayRegressor(
        vocab_size=vocab_size,
        embedding_dim=int(config.model.get("embedding_dim", 128)),
        hidden_dim=int(config.model.get("hidden_dim", 256)),
        num_layers=int(config.model.get("num_layers", 2)),
        dropout=float(config.model.get("dropout", 0.3)),
        padding_idx=int(config.model.get("padding_idx", 0)),
    ).to(device)

    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=float(config.training.get("lr", 1e-3)),
        weight_decay=float(config.training.get("weight_decay", 0.0)),
    )

    num_epochs = int(config.training.get("epochs", 5))
    history = {"train_loss": [], "val_loss": []}

    for epoch in range(1, num_epochs + 1):
        train_loss = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss = evaluate(model, val_loader, criterion, device)

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)

        print(f"Epoch {epoch}/{num_epochs} - Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")

    save_artifacts(config, model, tokenizer, history)


if __name__ == "__main__":
    main()
