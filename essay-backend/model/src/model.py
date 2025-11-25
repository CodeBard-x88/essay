from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error
import numpy as np

class EssayGrader:
    def __init__(self):
        self.model = LinearRegression()

    def train(self, X_train, y_train):
        """Train the regression model on essay features."""
        self.model.fit(X_train, y_train)

    def predict(self, X):
        """Predict scores for given essay features."""
        return self.model.predict(X)

    def evaluate(self, X_test, y_test):
        """Evaluate model performance using RMSE."""
        preds = self.predict(X_test)
        rmse = np.sqrt(mean_squared_error(y_test, preds))
        return rmse, preds
