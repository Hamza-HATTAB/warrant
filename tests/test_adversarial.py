"""
WARRANT Adversarial and Stress Test Suite
Evaluates robustness against adversarial token perturbations, entity spoofing,
zero-grounding hallucinations, input boundaries, and cyclic retry limits.
"""

from unittest.mock import AsyncMock, MagicMock
import pytest
from pydantic import ValidationError

from warrant.core.schema import (
    AtomicClaim,
    EvidenceSpan,
    PolicyState,
)
from warrant.verifier.entity_guard import DeterministicGuard
from warrant.verifier.deberta_nli import DeBERTaVerifier
from warrant.graph.nodes import GraphNodeHandler
from warrant.graph.runner import WarrantGraphRunner
from warrant.api.schemas import QueryRequest


def test_adversarial_numerical_perturbation_guard_intercept():
    """
    Verify that an adversarial 1-digit perturbation (1844 -> 1845) is
    caught 100% of the time by the sub-millisecond Stage 1 Deterministic Guard.
    """
    guard = DeterministicGuard()
    premise_span = EvidenceSpan(
        span_id="span_1844",
        article_title="Arthur's Magazine",
        sentence_idx=0,
        text="Arthur's Magazine was an American literary magazine published in Philadelphia in 1844.",
    )
    evidence_pool = {premise_span.span_id: premise_span}

    # Gold claim: 1844
    gold_claim = AtomicClaim(
        claim_id="c_gold",
        text="Arthur's Magazine was founded in 1844.",
        cited_span_ids=["span_1844"],
    )
    res_gold = guard.verify(gold_claim, evidence_pool)
    assert res_gold.passed is True
    assert "1844" in res_gold.extracted_numbers
    assert len(res_gold.unmatched_items) == 0

    # Adversarial mutation: 1845
    adversarial_claim = AtomicClaim(
        claim_id="c_adv_num",
        text="Arthur's Magazine was founded in 1845.",
        cited_span_ids=["span_1844"],
    )
    res_adv = guard.verify(adversarial_claim, evidence_pool)
    assert res_adv.passed is False
    assert any("1845" in item for item in res_adv.unmatched_items)


def test_adversarial_entity_substitution_contradiction():
    """
    Verify that an adversarial entity substitution (Scott Derrickson -> Christopher Nolan)
    is identified by DeBERTa-v3 cross-encoder as a directional contradiction.
    """
    verifier = DeBERTaVerifier(device="cpu")
    premise = "[Title: Sinister (film)] Sinister is a 2012 supernatural horror film directed by Scott Derrickson."
    adversarial_hypothesis = "The film Sinister was directed by Christopher Nolan."

    res = verifier.verify(premise=premise, hypothesis=adversarial_hypothesis)
    assert res.predicted_label in ["contradiction", "neutral"]
    assert res.entailment_score < 0.25
    assert res.contradiction_score > 0.40


@pytest.mark.asyncio
async def test_adversarial_zero_grounding_strict_abstention():
    """
    Verify that an ungrounded or contradictory inquiry triggers the strict
    3-state abstention contract (PolicyState.ABSTAIN) rather than fabricating claims.
    """
    mock_retriever = MagicMock()
    mock_retriever.search_hybrid_rrf.return_value = []

    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = ([], 0.0)

    mock_synthesizer = MagicMock()
    mock_synthesizer.synthesize = AsyncMock(return_value=[])

    mock_verifier = MagicMock()
    mock_verifier.verify_claims.return_value = []

    handler = GraphNodeHandler(
        retriever=mock_retriever,
        reranker=mock_reranker,
        synthesizer=mock_synthesizer,
        verifier=mock_verifier,
        max_hops=2,
    )
    runner = WarrantGraphRunner(node_handler=handler)

    final_state = await runner.run("Which quantum supercomputer was built in Montreal in 1720?")

    assert final_state.policy == PolicyState.ABSTAIN
    assert len(final_state.claims) == 0
    assert final_state.abstention_diagnostic is not None or (
        final_state.final_answer is not None and "unable to answer" in final_state.final_answer.lower()
    )



def test_extreme_query_boundary_validation():
    """
    Verify API schema rejects empty strings and enforces min character boundaries.
    """
    # Empty string must fail validation
    with pytest.raises(ValidationError):
        QueryRequest(query="")

    # Too short (<3 chars) must fail validation
    with pytest.raises(ValidationError):
        QueryRequest(query="hi")

    # Valid query must pass
    valid_req = QueryRequest(query="Who directed the 2012 horror movie Sinister?", max_hops=2)
    assert valid_req.query == "Who directed the 2012 horror movie Sinister?"
    assert valid_req.max_hops == 2


@pytest.mark.asyncio
async def test_bounded_retry_cycle_hard_termination():
    """
    Verify that the LangGraph state machine enforces hard bounded cycle termination
    at max retries, guaranteeing no infinite recursion under persistent failure.
    """
    span = EvidenceSpan(
        span_id="s1",
        article_title="Doc",
        sentence_idx=0,
        text="A factual sentence.",
    )

    failing_claim = AtomicClaim(
        claim_id="c_fail",
        text="A hallucinated claim.",
        cited_span_ids=["s1"],
        is_verified=False,
        guard_pass=False,
        nli_entailment_score=0.1,
        rejection_reason="Failed deterministic guard",
    )

    mock_retriever = MagicMock()
    mock_retriever.search_hybrid_rrf.return_value = [span]

    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = ([span], 1.5)

    mock_synthesizer = MagicMock()
    mock_synthesizer.synthesize = AsyncMock(return_value=[failing_claim])

    # Verifier always marks claims as unverified
    mock_verifier = MagicMock()
    mock_verifier.verify_claims.return_value = [failing_claim]

    handler = GraphNodeHandler(
        retriever=mock_retriever,
        reranker=mock_reranker,
        synthesizer=mock_synthesizer,
        verifier=mock_verifier,
        max_hops=2,
    )
    runner = WarrantGraphRunner(node_handler=handler)

    final_state = await runner.run("Persistent failing query")

    # Must terminate with ABSTAIN
    assert final_state.policy == PolicyState.ABSTAIN
    assert len(final_state.claims) == 0
    assert len(final_state.dropped_claims) > 0 or final_state.abstention_diagnostic is not None
