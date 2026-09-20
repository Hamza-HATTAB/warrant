from typing import Optional
import numpy as np
from pydantic import BaseModel, Field
from scipy.optimize import minimize_scalar


class CalibrationMetrics(BaseModel):
    """evaluation metrics measuring confidence calibration error"""
    ece: float = Field(..., description="expected calibration error across bins")
    mce: float = Field(..., description="maximum calibration error")
    brier_score: float = Field(..., description="mean squared probability error")
    nll: float = Field(..., description="mean negative log likelihood")
    optimal_temperature: float = 1.0


class TemperatureCalibrator:
    """temperautre scaling calibration via nll minimization for softmax classifiers"""

    def __init__(self, temperature: float = 1.0):
        if temperature <= 0.0:
            raise ValueError(f"Temperature must be strictly positive, got {temperature}")
        self.temperature: float = float(temperature)

    def scale_logits(self, logits: np.ndarray, temp: Optional[float] = None) -> np.ndarray:
        """applies temperature division to input logits"""
        t = temp if temp is not None else self.temperature
        return logits / t

    def predict_proba(self, logits: np.ndarray, temp: Optional[float] = None) -> np.ndarray:
        """computes calibrated softmax probabilities over logits"""
        scaled = self.scale_logits(logits, temp=temp)
        # numerically stable softmax with max subtraction
        max_logits = np.max(scaled, axis=-1, keepdims=True)
        exp_logits = np.exp(scaled - max_logits)
        return exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)

    def compute_nll(self, logits: np.ndarray, labels: np.ndarray, temp: float) -> float:
        """computes negative log likelihood for a candidate temperature"""
        probs = self.predict_proba(logits, temp=temp)
        # clip probabilities to prevent log(0)
        eps = 1e-12
        probs = np.clip(probs, eps, 1.0 - eps)

        n_samples = logits.shape[0]
        if labels.ndim == 1:
            # integer class indices
            log_probs = np.log(probs[np.arange(n_samples), labels])
        else:
            # one-hot or soft labels
            log_probs = np.sum(labels * np.log(probs), axis=-1)

        return -float(np.mean(log_probs))

    def compute_ece(
        self,
        probs: np.ndarray,
        labels: np.ndarray,
        num_bins: int = 10,
    ) -> tuple[float, float]:
        """computes expected calibration error (ECE) and maximum calibration error (MCE)"""
        if probs.ndim == 2:
            confidences = np.max(probs, axis=1)
            predictions = np.argmax(probs, axis=1)
        else:
            confidences = probs
            predictions = (probs >= 0.5).astype(int)

        if labels.ndim == 2:
            true_labels = np.argmax(labels, axis=1)
        else:
            true_labels = labels

        accuracies = (predictions == true_labels).astype(float)
        n_samples = len(confidences)

        bin_boundaries = np.linspace(0.0, 1.0, num_bins + 1)
        ece = 0.0
        mce = 0.0

        for i in range(num_bins):
            bin_lower = bin_boundaries[i]
            bin_upper = bin_boundaries[i + 1]

            if i == num_bins - 1:
                mask = (confidences >= bin_lower) & (confidences <= bin_upper)
            else:
                mask = (confidences >= bin_lower) & (confidences < bin_upper)

            bin_size = np.sum(mask)
            if bin_size > 0:
                bin_acc = np.mean(accuracies[mask])
                bin_conf = np.mean(confidences[mask])
                diff = abs(bin_acc - bin_conf)
                ece += (bin_size / n_samples) * diff
                mce = max(mce, diff)

        return float(ece), float(mce)

    def evaluate(
        self,
        logits: np.ndarray,
        labels: np.ndarray,
        temp: Optional[float] = None,
        num_bins: int = 10,
    ) -> CalibrationMetrics:
        """evaluates calibration metrics on a validation split"""
        t = temp if temp is not None else self.temperature
        probs = self.predict_proba(logits, temp=t)
        nll = self.compute_nll(logits, labels, temp=t)
        ece, mce = self.compute_ece(probs, labels, num_bins=num_bins)

        # brier score calculation
        if labels.ndim == 1:
            n_classes = logits.shape[1]
            one_hot = np.eye(n_classes)[labels]
        else:
            one_hot = labels

        brier = float(np.mean(np.sum((probs - one_hot) ** 2, axis=1)))

        return CalibrationMetrics(
            ece=ece,
            mce=mce,
            brier_score=brier,
            nll=nll,
            optimal_temperature=t,
        )

    def fit(
        self,
        val_logits: np.ndarray,
        val_labels: np.ndarray,
        bounds: tuple[float, float] = (0.05, 5.0),
    ) -> CalibrationMetrics:
        """optimizes temperature parameter by minimizing NLL on validation logits"""
        res = minimize_scalar(
            fun=lambda t: self.compute_nll(val_logits, val_labels, temp=t),
            bounds=bounds,
            method="bounded",
        )

        self.temperature = float(res.x)
        return self.evaluate(val_logits, val_labels, temp=self.temperature)
