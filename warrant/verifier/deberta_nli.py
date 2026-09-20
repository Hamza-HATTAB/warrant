import time
from typing import Optional
import numpy as np
import torch
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from warrant.core.config import settings
from warrant.verifier.calibrator import TemperatureCalibrator


class NLIResult(BaseModel):
    """classification outcome of cross encoder natural language inference"""
    entailment_score: float = Field(..., description="calibrated probability of entailment")
    neutral_score: float = Field(..., description="calibrated probability of neutral relation")
    contradiction_score: float = Field(..., description="calibrated probability of contradiction")
    predicted_label: str = Field(..., description="argmax label among entailment, neutral, contradiction")
    calibrated_temperature: float = 1.0
    latency_ms: float = 0.0


class DeBERTaVerifier:
    """cross encoder natural language inference verifier using deberta v3"""

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        temperature: float = 1.0,
        max_length: int = 512,
    ):
        self.model_name = model_name or getattr(settings, "verifier_model", "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli")
        self.device = self._resolve_device(device)
        self.calibrator = TemperatureCalibrator(temperature=temperature)
        self.max_length = max_length

        self.tokenizer = None
        self.model = None
        self.label_map: dict[str, int] = {}

    def _resolve_device(self, requested_device: Optional[str]) -> str:
        """resolves target device with vram headroom check to prevent cuda oom"""
        if requested_device and requested_device != "auto":
            return requested_device

        if torch.cuda.is_available():
            try:
                free_bytes, total_bytes = torch.cuda.mem_get_info()
                free_gb = free_bytes / (1024 ** 3)
                # require at least 2.5 GB free VRAM to safely avoid collisions with local LLM
                if free_gb >= 2.5:
                    return "cuda"
            except Exception:
                pass
        return "cpu"

    def load_model(self) -> None:
        """lazy loads tokenizer and sequence classification weights"""
        if self.model is not None and self.tokenizer is not None:
            return

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self.model.to(self.device)
        self.model.eval()

        # inspect model label mapping dynamically
        id2label = getattr(self.model.config, "id2label", {})
        self.label_map = {}
        for idx, label_str in id2label.items():
            label_lower = label_str.lower()
            if "entail" in label_lower:
                self.label_map["entailment"] = int(idx)
            elif "contra" in label_lower:
                self.label_map["contradiction"] = int(idx)
            elif "neut" in label_lower:
                self.label_map["neutral"] = int(idx)

        # fallback default if id2label does not match standard patterns
        if len(self.label_map) < 3:
            self.label_map = {"entailment": 0, "neutral": 1, "contradiction": 2}

    def verify(
        self,
        premise: str,
        hypothesis: str,
    ) -> NLIResult:
        """evaluat directional entailment for candidate hypothesis against premise"""
        start_time = time.perf_counter()
        self.load_model()

        inputs = self.tokenizer(
            premise,
            hypothesis,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.inference_mode():
            outputs = self.model(**inputs)
            raw_logits = outputs.logits.detach().cpu().numpy()

        # apply temperature scaling calibration
        calibrated_probs = self.calibrator.predict_proba(raw_logits)[0]

        ent_idx = self.label_map.get("entailment", 0)
        neu_idx = self.label_map.get("neutral", 1)
        con_idx = self.label_map.get("contradiction", 2)

        p_entail = float(calibrated_probs[ent_idx])
        p_neutral = float(calibrated_probs[neu_idx])
        p_contra = float(calibrated_probs[con_idx])

        # argmax prediction
        predicted_idx = int(np.argmax(calibrated_probs))
        inv_map = {v: k for k, v in self.label_map.items()}
        predicted_label = inv_map.get(predicted_idx, "neutral")

        latency = (time.perf_counter() - start_time) * 1000.0

        return NLIResult(
            entailment_score=p_entail,
            neutral_score=p_neutral,
            contradiction_score=p_contra,
            predicted_label=predicted_label,
            calibrated_temperature=self.calibrator.temperature,
            latency_ms=latency,
        )

    def verify_batch(
        self,
        pairs: list[tuple[str, str]],
        batch_size: int = 8,
    ) -> list[NLIResult]:
        """evaluates a batch of (premise, hypothesis) pairs"""
        if not pairs:
            return []

        start_time = time.perf_counter()
        self.load_model()
        results: list[NLIResult] = []

        for i in range(0, len(pairs), batch_size):
            chunk = pairs[i : i + batch_size]
            premises = [p for p, _ in chunk]
            hypotheses = [h for _, h in chunk]

            inputs = self.tokenizer(
                premises,
                hypotheses,
                truncation=True,
                padding=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.inference_mode():
                outputs = self.model(**inputs)
                raw_logits = outputs.logits.detach().cpu().numpy()

            calibrated_probs = self.calibrator.predict_proba(raw_logits)

            ent_idx = self.label_map.get("entailment", 0)
            neu_idx = self.label_map.get("neutral", 1)
            con_idx = self.label_map.get("contradiction", 2)
            inv_map = {v: k for k, v in self.label_map.items()}

            chunk_latency = (time.perf_counter() - start_time) * 1000.0 / len(chunk)

            for probs in calibrated_probs:
                p_entail = float(probs[ent_idx])
                p_neutral = float(probs[neu_idx])
                p_contra = float(probs[con_idx])
                predicted_idx = int(np.argmax(probs))
                predicted_label = inv_map.get(predicted_idx, "neutral")

                results.append(
                    NLIResult(
                        entailment_score=p_entail,
                        neutral_score=p_neutral,
                        contradiction_score=p_contra,
                        predicted_label=predicted_label,
                        calibrated_temperature=self.calibrator.temperature,
                        latency_ms=chunk_latency,
                    )
                )

        return results
