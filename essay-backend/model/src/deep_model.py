import torch
import torch.nn as nn

class EssayBiLSTM(nn.Module):
    def __init__(self, vocab_size, embed_dim=100, hidden_dim=128, num_layers=2, dropout=0.3):
        super(EssayBiLSTM, self).__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, num_layers=num_layers,
                            bidirectional=True, batch_first=True, dropout=dropout)
        self.fc = nn.Linear(hidden_dim * 2, 1)  # *2 for bidirectional
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        embedded = self.embedding(x)
        lstm_out, _ = self.lstm(embedded)
        # Take the last hidden state (many essays are long → we use mean pooling instead)
        pooled = torch.mean(lstm_out, dim=1)
        pooled = self.dropout(pooled)
        output = self.fc(pooled)
        return output.squeeze()
