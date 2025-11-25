import torch
from torch.utils.data import Dataset
from collections import Counter
import re

def simple_tokenizer(text):
    """Very basic tokenizer: lowercase + split by non-alphabetic."""
    text = text.lower()
    tokens = re.findall(r"[a-zA-Z']+", text)
    return tokens

class Vocab:
    def __init__(self, min_freq=2):
        self.word2idx = {"<PAD>": 0, "<UNK>": 1}
        self.idx2word = {0: "<PAD>", 1: "<UNK>"}
        self.min_freq = min_freq

    def build_vocab(self, texts):
        counter = Counter()
        for text in texts:
            tokens = simple_tokenizer(text)
            counter.update(tokens)

        for word, freq in counter.items():
            if freq >= self.min_freq and word not in self.word2idx:
                idx = len(self.word2idx)
                self.word2idx[word] = idx
                self.idx2word[idx] = word

    def encode(self, text):
        tokens = simple_tokenizer(text)
        return [self.word2idx.get(tok, self.word2idx["<UNK>"]) for tok in tokens]

    def __len__(self):
        return len(self.word2idx)

class EssayDataset(Dataset):
    def __init__(self, texts, scores, vocab, max_len=300):
        self.texts = texts
        self.scores = scores
        self.vocab = vocab
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = self.texts[idx]
        score = float(self.scores[idx])

        # Encode and pad
        encoded = self.vocab.encode(text)
        if len(encoded) < self.max_len:
            encoded += [0] * (self.max_len - len(encoded))
        else:
            encoded = encoded[:self.max_len]

        return torch.tensor(encoded, dtype=torch.long), torch.tensor(score, dtype=torch.float)
