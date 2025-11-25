import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import numpy as np

from src.data_loader import load_dataset
from src.dataset import Vocab, EssayDataset
from src.deep_model import EssayBiLSTM

def evaluate_model(model, data_loader, device):
    model.eval()
    preds, actuals = [], []
    with torch.no_grad():
        for essays, scores in data_loader:
            essays, scores = essays.to(device), scores.to(device)
            outputs = model(essays)
            preds.extend(outputs.cpu().numpy())
            actuals.extend(scores.cpu().numpy())
    preds = np.array(preds)
    actuals = np.array(actuals)
    rmse = np.sqrt(np.mean((preds - actuals) ** 2))
    return rmse, preds, actuals

def main():
    data_path = "data/training_set_rel3.tsv"
    model_path = "models/deep_essay_grader.pt"

    # Load validation data
    _, X_val, _, y_val = load_dataset(data_path)

    # Load checkpoint
    checkpoint = torch.load(model_path, map_location=torch.device("cpu"))
    vocab_dict = checkpoint["vocab"]

    # Rebuild vocab
    vocab = Vocab()
    vocab.word2idx = vocab_dict
    vocab.idx2word = {idx: word for word, idx in vocab_dict.items()}

    # Create validation dataset
    val_dataset = EssayDataset(X_val, y_val, vocab, max_len=300)
    val_loader = DataLoader(val_dataset, batch_size=32)

    # Rebuild model
    model = EssayBiLSTM(vocab_size=len(vocab), embed_dim=100, hidden_dim=128, num_layers=2)
    model.load_state_dict(checkpoint["model_state"])
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # Evaluate
    rmse, preds, actuals = evaluate_model(model, val_loader, device)
    print(f"Validation RMSE: {rmse:.4f}")

    # Show some sample predictions
    print("\nSample Predictions:")
    for i in range(50):
        print(f"Essay {i+1}: Predicted={preds[i]:.2f}, Actual={actuals[i]}")

if __name__ == "__main__":
    main()
