from unittest.mock import AsyncMock, MagicMock
import pytest

from warrant.core.schema import (
    AtomicClaim,
    EvidenceSpan,
    HopRecord,
    PolicyState,
    WarrantState,
)
from warrant.graph.builder import build_warrant_graph
from warrant.graph.nodes import GraphNodeHandler
from warrant.graph.runner import WarrantGraphRunner
from warrant.graph.state import (
    GraphState,
    create_initial_state,
    to_warrant_state,
)

# test suit for langgraph state machine and 3-state abstention contract


@pytest.fixture
def sample_spans() -> list[EvidenceSpan]:
    return [
        EvidenceSpan(
            span_id="art_1",
            article_title="Arthur's Magazine",
            sentence_idx=0,
            text="Arthur's Magazine was founded in Philadelphia in 1844 by T. S. Arthur.",
        ),
        EvidenceSpan(
            span_id="art_2",
            article_title="Arthur's Magazine",
            sentence_idx=1,
            text="The magazine merged with Godey's Lady's Book in 1846.",
        ),
    ]


def test_graph_state_conversion():
    state = create_initial_state("When was the magazine founded?")
    assert state["query"] == "When was the magazine founded?"
    assert state["current_hop"] == 0
    assert state["policy"] == PolicyState.ABSTAIN
    assert state["next_sub_query"] is None

    warrant_state = to_warrant_state(state)
    assert isinstance(warrant_state, WarrantState)
    assert warrant_state.query == state["query"]
    assert warrant_state.policy == PolicyState.ABSTAIN


@pytest.mark.asyncio
async def test_graph_full_pass_execution(sample_spans):
    mock_retriever = MagicMock()
    mock_reranker = MagicMock()
    mock_synthesizer = MagicMock()
    mock_verifier = MagicMock()

    mock_retriever.search_hybrid_rrf.return_value = sample_spans
    mock_reranker.rerank.return_value = (sample_spans, 4.2)

    claim_1 = AtomicClaim(
        claim_id="c1",
        text="Arthur's Magazine was founded in 1844.",
        cited_span_ids=["art_1"],
        is_verified=True,
        guard_pass=True,
        nli_entailment_score=0.96,
    )
    claim_2 = AtomicClaim(
        claim_id="c2",
        text="Arthur's Magazine merged with Godey's Lady's Book in 1846.",
        cited_span_ids=["art_2"],
        is_verified=True,
        guard_pass=True,
        nli_entailment_score=0.92,
    )

    mock_synthesizer.synthesize = AsyncMock(return_value=[claim_1, claim_2])
    mock_verifier.verify_claims.return_value = [claim_1, claim_2]

    handler = GraphNodeHandler(
        retriever=mock_retriever,
        reranker=mock_reranker,
        synthesizer=mock_synthesizer,
        verifier=mock_verifier,
        max_hops=2,
    )

    runner = WarrantGraphRunner(node_handler=handler)
    res = await runner.run("When was Arthur's Magazine founded and when did it merge?")

    assert res.policy == PolicyState.FULL_PASS
    assert len(res.claims) == 2
    assert len(res.dropped_claims) == 0
    assert "1844" in res.final_answer
    assert "1846" in res.final_answer
    assert "[art_1]" in res.final_answer
    assert "[art_2]" in res.final_answer
    assert res.abstention_diagnostic is None
    assert len(res.hops) == 1


@pytest.mark.asyncio
async def test_graph_partial_pass_contract_with_retries(sample_spans):
    mock_retriever = MagicMock()
    mock_reranker = MagicMock()
    mock_synthesizer = MagicMock()
    mock_verifier = MagicMock()

    mock_retriever.search_hybrid_rrf.return_value = sample_spans
    mock_reranker.rerank.return_value = (sample_spans, 3.5)

    valid_claim = AtomicClaim(
        claim_id="c1",
        text="Arthur's Magazine was founded in 1844.",
        cited_span_ids=["art_1"],
        is_verified=True,
        guard_pass=True,
        nli_entailment_score=0.95,
    )
    invalid_claim = AtomicClaim(
        claim_id="c2",
        text="Arthur's Magazine was sold for 10 million dollars in 1900.",
        cited_span_ids=["art_1"],
        is_verified=False,
        guard_pass=False,
        nli_entailment_score=0.0,
        rejection_reason="Deterministic guard failure: ungrounded items ['number:1900']",
        extracted_numbers=["1900"],
    )

    # on both hops, synthesizer returns the same mix (simulating persistent unverified claim)
    mock_synthesizer.synthesize = AsyncMock(return_value=[valid_claim, invalid_claim])
    mock_verifier.verify_claims.return_value = [valid_claim, invalid_claim]

    handler = GraphNodeHandler(
        retriever=mock_retriever,
        reranker=mock_reranker,
        synthesizer=mock_synthesizer,
        verifier=mock_verifier,
        max_hops=2,
    )

    runner = WarrantGraphRunner(node_handler=handler)
    res = await runner.run("Detailed financial history of Arthur's Magazine.")

    assert res.policy == PolicyState.PARTIAL_PASS
    # surviving verified claims retained
    assert len(res.claims) == 1
    assert res.claims[0].claim_id == "c1"
    # unverified claims dropped
    assert len(res.dropped_claims) >= 1
    assert any(c.claim_id == "c2" for c in res.dropped_claims)
    # answer mentions verified claim and includes attribution disclaimer
    assert "Arthur's Magazine was founded in 1844." in res.final_answer
    assert "Warrant Attribution Notice" in res.final_answer
    assert "omitted due to lack of verified evidence" in res.final_answer
    # retried up to max_hops (2)
    assert len(res.hops) == 2


@pytest.mark.asyncio
async def test_graph_strict_abstention_contract(sample_spans):
    mock_retriever = MagicMock()
    mock_reranker = MagicMock()
    mock_synthesizer = MagicMock()
    mock_verifier = MagicMock()

    mock_retriever.search_hybrid_rrf.return_value = sample_spans
    mock_reranker.rerank.return_value = (sample_spans, 2.0)

    # all claims fail verification
    hallucinated_claim = AtomicClaim(
        claim_id="c_bad",
        text="The magazine was founded on Mars by extraterrestrials.",
        cited_span_ids=["art_1"],
        is_verified=False,
        guard_pass=False,
        nli_entailment_score=0.0,
        rejection_reason="Deterministic guard failure: ungrounded items ['entity:Mars']",
        extracted_entities=["Mars"],
    )

    mock_synthesizer.synthesize = AsyncMock(return_value=[hallucinated_claim])
    mock_verifier.verify_claims.return_value = [hallucinated_claim]

    handler = GraphNodeHandler(
        retriever=mock_retriever,
        reranker=mock_reranker,
        synthesizer=mock_synthesizer,
        verifier=mock_verifier,
        max_hops=2,
    )

    runner = WarrantGraphRunner(node_handler=handler)
    res = await runner.run("Was the magazine founded on Mars?")

    assert res.policy == PolicyState.ABSTAIN
    assert res.final_answer is None
    assert len(res.claims) == 0
    assert len(res.dropped_claims) >= 1
    assert res.abstention_diagnostic is not None
    assert "WARRANT Abstention Contract Enforced" in res.abstention_diagnostic
    assert "Zero candidate claims satisfied the calibrated verification threshold" in res.abstention_diagnostic
    assert len(res.hops) == 2


def test_graph_bounded_retries_termination_sync(sample_spans):
    mock_retriever = MagicMock()
    mock_reranker = MagicMock()
    mock_synthesizer = MagicMock()
    mock_verifier = MagicMock()

    mock_retriever.search_hybrid_rrf.return_value = sample_spans
    mock_reranker.rerank.return_value = (sample_spans, 1.5)

    bad_claim = AtomicClaim(
        claim_id="c_fail",
        text="Unverified proposition.",
        cited_span_ids=["art_1"],
        is_verified=False,
        guard_pass=False,
        nli_entailment_score=0.10,
        rejection_reason="Below threshold",
    )

    mock_synthesizer.synthesize = AsyncMock(return_value=[bad_claim])
    mock_verifier.verify_claims.return_value = [bad_claim]

    # test with max_hops = 3
    handler = GraphNodeHandler(
        retriever=mock_retriever,
        reranker=mock_reranker,
        synthesizer=mock_synthesizer,
        verifier=mock_verifier,
        max_hops=3,
    )

    runner = WarrantGraphRunner(node_handler=handler)
    res = runner.run_sync("Test query requiring bounded termination")

    assert res.policy == PolicyState.ABSTAIN
    assert len(res.hops) == 3
    assert res.total_latency_ms > 0.0


@pytest.mark.asyncio
async def test_graph_streaming_events(sample_spans):
    mock_retriever = MagicMock()
    mock_reranker = MagicMock()
    mock_synthesizer = MagicMock()
    mock_verifier = MagicMock()

    mock_retriever.search_hybrid_rrf.return_value = sample_spans
    mock_reranker.rerank.return_value = (sample_spans, 1.0)

    claim = AtomicClaim(
        claim_id="c1",
        text="Valid proposition.",
        cited_span_ids=["art_1"],
        is_verified=True,
        guard_pass=True,
        nli_entailment_score=0.98,
    )
    mock_synthesizer.synthesize = AsyncMock(return_value=[claim])
    mock_verifier.verify_claims.return_value = [claim]

    handler = GraphNodeHandler(
        retriever=mock_retriever,
        reranker=mock_reranker,
        synthesizer=mock_synthesizer,
        verifier=mock_verifier,
        max_hops=1,
    )

    runner = WarrantGraphRunner(node_handler=handler)
    node_names = []
    async for event in runner.stream_events("Stream test query"):
        node_names.extend(event.keys())

    assert "retrieve_hop" in node_names
    assert "synthesize_claims" in node_names
    assert "verify_claims" in node_names
    assert "evaluate_policy" in node_names
    assert "assemble_answer" in node_names
