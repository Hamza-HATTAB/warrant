import pytest
from warrant.core.schema import EvidenceSpan
from warrant.retrieval.flashrank_cpu import FlashRankCPUReranker
from warrant.retrieval.hybrid_qdrant import HybridQdrantRetriever


def test_flashrank_cpu_reranking():
    reranker = FlashRankCPUReranker()

    query = "Who directed Inception?"
    candidtes = [
        {
            "span_id": "span_01",
            "text": "Inception is a 2010 film written and directed by Christopher Nolan.",
            "formatted_premise": "[Title: Inception] Inception is a 2010 film written and directed by Christopher Nolan.",
        },
        {
            "span_id": "span_02",
            "text": "Scott Derrickson is an American film director born in Colorado.",
            "formatted_premise": "[Title: Scott Derrickson] Scott Derrickson is an American film director born in Colorado.",
        },
        {
            "span_id": "span_03",
            "text": "London is the capital and largest city of England and the United Kingdom.",
            "formatted_premise": "[Title: London] London is the capital and largest city of England and the United Kingdom.",
        },
    ]

    reranked, latency_ms = reranker.rerank(query=query, candidates=candidtes, top_k=2)

    assert len(reranked) == 2
    assert reranked[0]["span_id"] == "span_01"
    assert "cross_encoder_score" in reranked[0]
    assert latency_ms > 0.0


def test_qdrant_hybrid_integration():
    # integration test against local dockerized qdrant instance
    retriever = HybridQdrantRetriever(
        collection_name="warrant_test_integration",
        dense_model_name="BAAI/bge-small-en-v1.5",  # fast loading for integration tests
    )

    test_spans = [
        EvidenceSpan(
            span_id="test_01",
            article_title="Inception",
            sentence_idx=0,
            text="Inception is a science fiction film directed by Christopher Nolan.",
        ),
        EvidenceSpan(
            span_id="test_02",
            article_title="Christopher Nolan",
            sentence_idx=0,
            text="Christopher Nolan was born in Westminster, London on July 30, 1970.",
        ),
        EvidenceSpan(
            span_id="test_03",
            article_title="Ed Wood",
            sentence_idx=0,
            text="Edward Davis Wood Jr. was an American filmmaker and actor.",
        ),
    ]

    # index spans
    indexed_count = retriever.index_spans(spans=test_spans, batch_size=3)
    assert indexed_count == 3

    # dense search test
    dense_results = retriever.search_dense(query="Who directed Inception?", limit=2)
    assert len(dense_results) > 0
    assert dense_results[0]["span_id"] == "test_01"

    # sparse BM25 search test
    sparse_results = retriever.search_sparse(query="Edward Davis Wood", limit=2)
    assert len(sparse_results) > 0
    assert sparse_results[0]["span_id"] == "test_03"

    # hybrid RRF fusion test
    hybrid_results = retriever.search_hybrid_rrf(query="Where was Christopher Nolan born?", limit=2)
    assert len(hybrid_results) > 0
    assert hybrid_results[0]["span_id"] == "test_02"
    assert "rrf_score" in hybrid_results[0]

    # cleanup
    retriever.client.delete_collection("warrant_test_integration")
