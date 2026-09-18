from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, computed_field


class PolicyState(str, Enum):
    FULL_PASS = "FULL_PASS"
    PARTIAL_PASS = "PARTIAL_PASS"
    ABSTAIN = "ABSTAIN"


class EvidenceSpan(BaseModel):
    """sentence level evidence span with title context"""
    span_id: str
    article_title: str
    section_title: str = "Lead"
    sentence_idx: int
    text: str

    @computed_field
    @property
    def formatted_premise(self) -> str:
        """prepends title to prevent pronoun and coreference resolution errors"""
        return f"[Title: {self.article_title}] {self.text.strip()}"


class AtomicClaim(BaseModel):
    """single factual assertion tied to cited span identifiers"""
    claim_id: str
    text: str
    cited_span_ids: list[str] = Field(default_factory=list)
    extracted_entities: list[str] = Field(default_factory=list)
    extracted_numbers: list[str] = Field(default_factory=list)
    guard_pass: Optional[bool] = None
    nli_entailment_score: Optional[float] = None
    is_verified: bool = False
    rejection_reason: Optional[str] = None


class HopRecord(BaseModel):
    """record of single retrieval hop in append only timeline"""
    hop_idx: int
    sub_query: str
    retrieved_span_ids: list[str] = Field(default_factory=list)
    latency_ms: float = 0.0


class WarrantState(BaseModel):
    """immutable agent state tracking query hops and verifcation status"""
    query: str
    hops: list[HopRecord] = Field(default_factory=list)
    evidence_pool: dict[str, EvidenceSpan] = Field(default_factory=dict)
    claims: list[AtomicClaim] = Field(default_factory=list)
    policy: PolicyState = PolicyState.ABSTAIN
    final_answer: Optional[str] = None
    dropped_claims: list[AtomicClaim] = Field(default_factory=list)
    abstention_diagnostic: Optional[str] = None
    total_latency_ms: float = 0.0

    def add_hop(self, hop: HopRecord) -> None:
        self.hops.append(hop)

    def add_spans(self, spans: list[EvidenceSpan]) -> None:
        for span in spans:
            if span.span_id not in self.evidence_pool:
                self.evidence_pool[span.span_id] = span
