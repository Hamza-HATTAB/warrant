import json
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
import pytest

from warrant.api.server import app, get_runner
from warrant.core.schema import (
    AtomicClaim,
    EvidenceSpan,
    HopRecord,
    PolicyState,
    WarrantState,
)
from warrant.graph.nodes import GraphNodeHandler
from warrant.graph.runner import WarrantGraphRunner

# api integration test suit for rest endpoints and sse streaming


@pytest.fixture
def mock_runner():
    mock_retriever = MagicMock()
    mock_reranker = MagicMock()
    mock_synthesizer = MagicMock()
    mock_verifier = MagicMock()

    span = EvidenceSpan(
        span_id="span_1",
        article_title="Arthur's Magazine",
        sentence_idx=0,
        text="Arthur's Magazine was published in Philadelphia.",
    )
    mock_retriever.search_hybrid_rrf.return_value = [span]
    mock_reranker.rerank.return_value = ([span], 2.5)

    claim = AtomicClaim(
        claim_id="c1",
        text="Arthur's Magazine was published in Philadelphia.",
        cited_span_ids=["span_1"],
        is_verified=True,
        guard_pass=True,
        nli_entailment_score=0.97,
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
    return WarrantGraphRunner(node_handler=handler)


@pytest.fixture
def client(mock_runner):
    import warrant.api.server as srv
    srv._runner = mock_runner
    with TestClient(app) as test_client:
        yield test_client
    srv._runner = None


def test_api_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "gemma3:12b" in data["generator_model"]
    assert "DeBERTa" in data["verifier_model"]
    assert isinstance(data["loaded_models"], list)


def test_api_presets(client):
    response = client.get("/api/presets")
    assert response.status_code == 200
    presets = response.json()
    assert len(presets) == 4
    assert presets[0]["expected_policy"] == "FULL_PASS"
    assert presets[2]["expected_policy"] == "PARTIAL_PASS"
    assert presets[3]["expected_policy"] == "ABSTAIN"


def test_api_query_post(client):
    payload = {"query": "When was Arthur's Magazine published?"}
    response = client.post("/api/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == payload["query"]
    assert data["policy"] == "FULL_PASS"
    assert "Arthur's Magazine was published in Philadelphia." in data["final_answer"]
    assert len(data["claims"]) == 1
    assert data["claims"][0]["is_verified"] is True


def test_api_query_validation_error(client):
    # query too short (< 3 chars)
    response = client.post("/api/query", json={"query": "ab"})
    assert response.status_code == 422


def test_api_sse_stream(client):
    query = "Where was the magazine published?"
    with client.stream("GET", f"/api/stream?query={query}") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        events = []
        for line in response.iter_lines():
            if line.startswith("event:"):
                events.append(line.replace("event:", "").strip())

        assert "query_started" in events
        assert "complete" in events
