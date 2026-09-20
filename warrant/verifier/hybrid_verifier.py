from typing import Optional
from warrant.core.config import settings
from warrant.core.schema import AtomicClaim, EvidenceSpan
from warrant.verifier.deberta_nli import DeBERTaVerifier
from warrant.verifier.entity_guard import DeterministicGuard


class HybridVerifier:
    """dual stage verifcation pipeline with fail-fast short circuit and calibrated nli"""

    def __init__(
        self,
        guard: Optional[DeterministicGuard] = None,
        nli_verifier: Optional[DeBERTaVerifier] = None,
        verification_threshold: Optional[float] = None,
    ):
        self.guard = guard or DeterministicGuard()
        self.nli_verifier = nli_verifier or DeBERTaVerifier()
        self.verification_threshold = (
            verification_threshold
            if verification_threshold is not None
            else getattr(settings, "verification_threshold", 0.82)
        )

    def _assemble_premise(
        self,
        claim: AtomicClaim,
        evidence_pool: dict[str, EvidenceSpan],
    ) -> str:
        """concatenates formatted premises of all valid cited evidence spans"""
        cited_spans = [
            evidence_pool[sid]
            for sid in claim.cited_span_ids
            if sid in evidence_pool
        ]
        return " ".join(span.formatted_premise for span in cited_spans)

    def verify_claim(
        self,
        claim: AtomicClaim,
        evidence_pool: dict[str, EvidenceSpan],
    ) -> AtomicClaim:
        """evaluates single claim through deterministic guard and calibrated nli"""
        # stage 1: deterministic guard (fail-fast <1ms)
        guard_res = self.guard.verify(claim, evidence_pool)
        claim.guard_pass = guard_res.passed
        claim.extracted_entities = guard_res.extracted_entities
        claim.extracted_numbers = guard_res.extracted_numbers

        if not guard_res.passed:
            claim.is_verified = False
            claim.nli_entailment_score = 0.0
            claim.rejection_reason = guard_res.failure_reason
            return claim

        # stage 2: directional nli cross-encoder
        premise_text = self._assemble_premise(claim, evidence_pool)
        nli_res = self.nli_verifier.verify(premise=premise_text, hypothesis=claim.text)
        claim.nli_entailment_score = nli_res.entailment_score

        if nli_res.entailment_score >= self.verification_threshold:
            claim.is_verified = True
            claim.rejection_reason = None
        elif nli_res.contradiction_score > 0.5:
            claim.is_verified = False
            claim.rejection_reason = (
                f"NLI contradiction detected (score: {nli_res.contradiction_score:.3f})"
            )
        else:
            claim.is_verified = False
            claim.rejection_reason = (
                f"NLI entailment score ({nli_res.entailment_score:.3f}) "
                f"below threshold ({self.verification_threshold:.3f})"
            )

        return claim

    def verify_claims(
        self,
        claims: list[AtomicClaim],
        evidence_pool: dict[str, EvidenceSpan],
    ) -> list[AtomicClaim]:
        """evaluates multiple claims, batching stage 2 for claims passing stage 1"""
        if not claims:
            return []

        pending_nli: list[tuple[int, str, str]] = []  # (claim_index, premise, hypothesis)

        # run stage 1 across all claims
        for idx, claim in enumerate(claims):
            guard_res = self.guard.verify(claim, evidence_pool)
            claim.guard_pass = guard_res.passed
            claim.extracted_entities = guard_res.extracted_entities
            claim.extracted_numbers = guard_res.extracted_numbers

            if not guard_res.passed:
                claim.is_verified = False
                claim.nli_entailment_score = 0.0
                claim.rejection_reason = guard_res.failure_reason
            else:
                premise_text = self._assemble_premise(claim, evidence_pool)
                pending_nli.append((idx, premise_text, claim.text))

        # run batched stage 2 on claims that passed stage 1
        if pending_nli:
            pairs = [(premise, hypothesis) for _, premise, hypothesis in pending_nli]
            nli_results = self.nli_verifier.verify_batch(pairs)

            for (idx, _, _), nli_res in zip(pending_nli, nli_results):
                claim = claims[idx]
                claim.nli_entailment_score = nli_res.entailment_score

                if nli_res.entailment_score >= self.verification_threshold:
                    claim.is_verified = True
                    claim.rejection_reason = None
                elif nli_res.contradiction_score > 0.5:
                    claim.is_verified = False
                    claim.rejection_reason = (
                        f"NLI contradiction detected (score: {nli_res.contradiction_score:.3f})"
                    )
                else:
                    claim.is_verified = False
                    claim.rejection_reason = (
                        f"NLI entailment score ({nli_res.entailment_score:.3f}) "
                        f"below threshold ({self.verification_threshold:.3f})"
                    )

        return claims
