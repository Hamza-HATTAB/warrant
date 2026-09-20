from typing import Optional, TypedDict
from warrant.core.schema import (
    AtomicClaim,
    EvidenceSpan,
    HopRecord,
    PolicyState,
    WarrantState,
)

# graph state definiton for multi-hop verification lifecycle


class GraphState(TypedDict):
    """mutable graph state passed across langgraph nodes"""
    query: str
    hops: list[HopRecord]
    evidence_pool: dict[str, EvidenceSpan]
    claims: list[AtomicClaim]
    policy: PolicyState
    final_answer: Optional[str]
    dropped_claims: list[AtomicClaim]
    abstention_diagnostic: Optional[str]
    total_latency_ms: float
    current_hop: int
    retry_count: int
    next_sub_query: Optional[str]


def create_initial_state(query: str) -> GraphState:
    """constructs clean initial state for fresh query execution"""
    return GraphState(
        query=query.strip(),
        hops=[],
        evidence_pool={},
        claims=[],
        policy=PolicyState.ABSTAIN,
        final_answer=None,
        dropped_claims=[],
        abstention_diagnostic=None,
        total_latency_ms=0.0,
        current_hop=0,
        retry_count=0,
        next_sub_query=None,
    )


def to_warrant_state(state: GraphState) -> WarrantState:
    """converts internal graph state into public warrant state schema"""
    return WarrantState(
        query=state["query"],
        hops=list(state["hops"]),
        evidence_pool=dict(state["evidence_pool"]),
        claims=list(state["claims"]),
        policy=state["policy"],
        final_answer=state["final_answer"],
        dropped_claims=list(state["dropped_claims"]),
        abstention_diagnostic=state["abstention_diagnostic"],
        total_latency_ms=state["total_latency_ms"],
    )
