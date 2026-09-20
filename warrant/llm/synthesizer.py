from typing import Optional
from warrant.core.schema import EvidenceSpan, AtomicClaim
from warrant.llm.client import OllamaClient, SynthesisResponse
from warrant.llm.prompts import build_synthesis_prompt


class ClaimSynthesizer:
    """synthesizes decomposed atomic claims from multi-hop evidence spans"""

    def __init__(self, client: Optional[OllamaClient] = None):
        self.client = client or OllamaClient()

    def synthesize(
        self,
        query: str,
        evidence_spans: list[EvidenceSpan],
    ) -> tuple[SynthesisResponse, list[AtomicClaim]]:
        """generates structured claims and maps them into core AtomicClaim objects"""
        system_prompt, user_prompt = build_synthesis_prompt(query, evidence_spans)

        response = self.client.generate_structured_sync(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=SynthesisResponse,
        )

        valid_span_ids = {s.span_id for s in evidence_spans}
        atomic_claims: list[AtomicClaim] = []

        for idx, sc in enumerate(response.claims):
            # filter out any halluncinated span ids not present in retrieval context
            verified_span_ids = [sid for sid in sc.cited_span_ids if sid in valid_span_ids]

            atomic_claim = AtomicClaim(
                claim_id=sc.claim_id or f"claim_{idx:03d}",
                text=sc.claim_text.strip(),
                cited_span_ids=verified_span_ids,
                is_verified=False,
            )
            atomic_claims.append(atomic_claim)

        return response, atomic_claims

    @staticmethod
    def resolve_multi_span_premise(
        claim: AtomicClaim,
        evidence_pool: dict[str, EvidenceSpan],
        max_spans: int = 3,
    ) -> str:
        """concatenates up to max_spans formatted premise spans for multi-hop NLI verification"""
        valid_premises = []
        for sid in claim.cited_span_ids[:max_spans]:
            if sid in evidence_pool:
                valid_premises.append(evidence_pool[sid].formatted_premise)

        if not valid_premises:
            return ""

        # join premise sentences with newline delimiter
        return "\n".join(valid_premises)
