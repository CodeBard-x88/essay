import pandas as pd
import re
from sklearn.model_selection import train_test_split

def clean_essay(text: str) -> str:
    """Clean essay text by removing placeholders and special tokens."""
    if not isinstance(text, str):
        return ""
    # Remove placeholders like @CAPS1, @LOCATION1, etc.
    text = re.sub(r"@\w+", "", text)
    # Remove multiple spaces
    text = re.sub(r"\s+", " ", text).strip()
    return text

def load_dataset(file_path: str, test_size: float = 0.2, random_state: int = 42):
    """Load dataset and split into train/test sets."""
    df = pd.read_csv(file_path, sep="\t", encoding="ISO-8859-1")
    df["essay"] = df["essay"].apply(clean_essay)
    
    essays = df["essay"].values
    scores = df["domain1_score"].values
    
    X_train, X_val, y_train, y_val = train_test_split(
        essays, scores, test_size=test_size, random_state=random_state
    )
    return X_train, X_val, y_train, y_val
