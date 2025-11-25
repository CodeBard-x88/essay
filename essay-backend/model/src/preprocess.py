from sklearn.feature_extraction.text import TfidfVectorizer

class Preprocessor:
    def __init__(self, max_features: int = 10000, ngram_range=(1, 2)):
        """
        Preprocessor that converts raw essay text into TF-IDF features.
        - max_features: maximum number of vocabulary terms
        - ngram_range: n-grams to include (default = unigrams + bigrams)
        """
        self.vectorizer = TfidfVectorizer(max_features=max_features, ngram_range=ngram_range)

    def fit_transform(self, texts):
        """Fit TF-IDF on training data and transform it into feature vectors."""
        return self.vectorizer.fit_transform(texts)

    def transform(self, texts):
        """Transform new/unseen text into TF-IDF features using trained vocabulary."""
        return self.vectorizer.transform(texts)
