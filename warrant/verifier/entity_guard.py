import re
import time
from typing import Optional
from pydantic import BaseModel, Field

from warrant.core.schema import AtomicClaim, EvidenceSpan

try:
    import spacy
    _NLP = spacy.load("en_core_web_sm")
except Exception:
    _NLP = None


class GuardResult(BaseModel):
    """evaluation result of deterministic token containment guard"""
    passed: bool
    extracted_entities: list[str] = Field(default_factory=list)
    extracted_numbers: list[str] = Field(default_factory=list)
    unmatched_items: list[str] = Field(default_factory=list)
    failure_reason: Optional[str] = None
    latency_ms: float = 0.0


class DeterministicGuard:
    """deterministic entity and number containment guard for fail-fast attribution"""

    def __init__(self, use_spacy: bool = True):
        self.use_spacy = use_spacy and (_NLP is not None)
        self._year_pattern = re.compile(r"\b(?:1[0-9]{3}|20[0-9]{2})\b")
        self._number_pattern = re.compile(r"\b\d+(?:[.,]\d+)?\b")
        self._cap_words_pattern = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b")

    def extract_numbers_and_dates(self, text: str) -> list[str]:
        """extract numeric literals and year patterns from text"""
        numbers = self._number_pattern.findall(text)
        # deduplicate while preserving discovery order
        seen = set()
        unique_numbers = []
        for num in numbers:
            cleaned = num.strip()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                unique_numbers.append(cleaned)
        return unique_numbers

    def extract_entities(self, text: str) -> list[str]:
        """extrat named entities and proper noun phrases for attribution grounding"""
        entities = []
        seen = set()

        if self.use_spacy and _NLP is not None:
            doc = _NLP(text)
            for ent in doc.ents:
                if ent.label_ in {"PERSON", "ORG", "GPE", "LOC", "EVENT", "WORK_OF_ART", "NORP"}:
                    cleaned = ent.text.strip()
                    if cleaned and cleaned.lower() not in seen:
                        seen.add(cleaned.lower())
                        entities.append(cleaned)

        if not entities:
            # fallback to capitalized multi-word sequences
            for match in self._cap_words_pattern.finditer(text):
                phrase = match.group(0).strip()
                # filter common sentence starters
                if phrase.lower() not in {"the", "a", "an", "this", "that", "these", "those", "in", "on", "at"}:
                    if phrase.lower() not in seen:
                        seen.add(phrase.lower())
                        entities.append(phrase)

        return entities

    def verify(
        self,
        claim: AtomicClaim,
        evidence_pool: dict[str, EvidenceSpan],
    ) -> GuardResult:
        """verifies that all entities and numbers in claim are strictly grounded in cited spans"""
        start_time = time.perf_counter()

        # collect premise text from cited spans
        cited_spans = [
            evidence_pool[sid]
            for sid in claim.cited_span_ids
            if sid in evidence_pool
        ]

        if not cited_spans:
            latency = (time.perf_counter() - start_time) * 1000.0
            return GuardResult(
                passed=False,
                unmatched_items=["MISSING_CITED_SPANS"],
                failure_reason="Claim cites zero valid spans from evidence pool",
                latency_ms=latency,
            )

        # build combined premise text with title context
        combined_premises = " ".join(span.formatted_premise for span in cited_spans).lower()

        # extract entities and numerical tokens from candidate claim
        claim_entities = self.extract_entities(claim.text)
        claim_numbers = self.extract_numbers_and_dates(claim.text)

        unmatched = []

        # 1. verify numbers and dates (strict containment)
        for num in claim_numbers:
            if num.lower() not in combined_premises:
                unmatched.append(f"number:{num}")

        # 2. verify named entities (token-level fuzzy or substring containment)
        for ent in claim_entities:
            ent_lower = ent.lower()
            if ent_lower not in combined_premises:
                # check if any primary token of entity is missing
                tokens = [t for t in ent_lower.split() if len(t) > 2]
                if not any(token in combined_premises for token in tokens):
                    unmatched.append(f"entity:{ent}")

        latency = (time.perf_counter() - start_time) * 1000.0

        if unmatched:
            return GuardResult(
                passed=False,
                extracted_entities=claim_entities,
                extracted_numbers=claim_numbers,
                unmatched_items=unmatched,
                failure_reason=f"Deterministic guard failure: ungrounded items {unmatched} not found in cited spans",
                latency_ms=latency,
            )

        return GuardResult(
            passed=True,
            extracted_entities=claim_entities,
            extracted_numbers=claim_numbers,
            unmatched_items=[],
            failure_reason=None,
            latency_ms=latency,
        )
