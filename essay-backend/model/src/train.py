import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from src.data_loader import load_dataset
from src.dataset import Vocab, EssayDataset
from src.deep_model import EssayBiLSTM

def train_model(model, train_loader, val_loader, device, epochs=5, lr=1e-3):
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    model.to(device)

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for essays, scores in train_loader:
            essays, scores = essays.to(device), scores.to(device)

            optimizer.zero_grad()
            outputs = model(essays)
            loss = criterion(outputs, scores)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        avg_train_loss = total_loss / len(train_loader)

        # Validation
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for essays, scores in val_loader:
                essays, scores = essays.to(device), scores.to(device)
                outputs = model(essays)
                loss = criterion(outputs, scores)
                val_loss += loss.item()

        avg_val_loss = val_loss / len(val_loader)
        print(f"Epoch {epoch+1}/{epochs} | Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f}")

    return model

def main():
    data_path = "data/training_set_rel3.tsv"
    model_path = "models/deep_essay_grader.pt"

    # 1. Load dataset
    print("Loading dataset...")
    X_train, X_val, y_train, y_val = load_dataset(data_path)

    # 2. Build vocab
    print("Building vocabulary...")
    vocab = Vocab(min_freq=2)
    vocab.build_vocab(X_train)

    # 3. Create datasets
    train_dataset = EssayDataset(X_train, y_train, vocab, max_len=300)
    val_dataset = EssayDataset(X_val, y_val, vocab, max_len=300)

    # 4. DataLoaders
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32)

    # 5. Initialize model
    model = EssayBiLSTM(vocab_size=len(vocab), embed_dim=100, hidden_dim=128, num_layers=2)

    # 6. Train
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = train_model(model, train_loader, val_loader, device, epochs=5, lr=1e-3)

    # 7. Save model + vocab
    os.makedirs("models", exist_ok=True)
    torch.save({"model_state": model.state_dict(), "vocab": vocab.word2idx}, model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    main()
