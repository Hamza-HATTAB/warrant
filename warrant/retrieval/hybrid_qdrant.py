import time
from typing import Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from fastembed import TextEmbedding, SparseTextEmbedding

from warrant.core.config import settings
from warrant.core.schema import EvidenceSpan


class HybridQdrantRetriever:
    """hybrid retreival client fusing dense BGE embeddings and sparse BM25 vectors"""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        collection_name: Optional[str] = None,
        dense_model_name: Optional[str] = None,
        sparse_model_name: str = "Qdrant/bm25",
    ):
        self.host = host or settings.qdrant_host
        self.port = port or settings.qdrant_port
        self.collection_name = collection_name or settings.qdrant_collection
        self.dense_model_name = dense_model_name or settings.embedding_model
        self.sparse_model_name = sparse_model_name

        self.client = QdrantClient(
            host=self.host,
            port=self.port,
            timeout=30.0,
            check_compatibility=False,
        )

        # CPU optimized embedding models via fastembed (ONNX runtime)
        self.dense_embedder = TextEmbedding(model_name=self.dense_model_name)
        self.sparse_embedder = SparseTextEmbedding(model_name=self.sparse_model_name)

        # BGE-Large has 1024 dims, BGE-Small has 384 dims
        self.dense_dim = 1024 if "large" in self.dense_model_name.lower() else 384

    def init_collection(self, force_recreate: bool = False) -> None:
        """creates or recreates hybrid collection in qdrant"""
        collections = [c.name for c in self.client.get_collections().collections]
        if self.collection_name in collections:
            if not force_recreate:
                return
            self.client.delete_collection(collection_name=self.collection_name)

        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config={
                "dense": models.VectorParams(
                    size=self.dense_dim,
                    distance=models.Distance.COSINE,
                )
            },
            sparse_vectors_config={
                "bm25": models.SparseVectorParams(
                    modifier=models.Modifier.IDF,
                )
            },
        )

    def index_spans(self, spans: list[EvidenceSpan], batch_size: int = 64) -> int:
        """indexes evidence spans with dense embeddings, sparse vectors, and title context"""
        self.init_collection(force_recreate=False)
        total_indexed = 0

        for i in range(0, len(spans), batch_size):
            batch = spans[i : i + batch_size]
            texts = [span.formatted_premise for span in batch]

            dense_vecs = list(self.dense_embedder.embed(texts))
            sparse_vecs = list(self.sparse_embedder.embed(texts))

            points = []
            for idx, span in enumerate(batch):
                point_id = i + idx
                sparse_obj = sparse_vecs[idx]

                points.append(
                    models.PointStruct(
                        id=point_id,
                        vector={
                            "dense": dense_vecs[idx].tolist(),
                            "bm25": models.SparseVector(
                                indices=sparse_obj.indices.tolist(),
                                values=sparse_obj.values.tolist(),
                            ),
                        },
                        payload={
                            "span_id": span.span_id,
                            "article_title": span.article_title,
                            "section_title": span.section_title,
                            "sentence_idx": span.sentence_idx,
                            "text": span.text,
                            "formatted_premise": span.formatted_premise,
                        },
                    )
                )

            self.client.upsert(collection_name=self.collection_name, points=points)
            total_indexed += len(batch)

        return total_indexed

    def search_dense(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """pure dense semantic vector search"""
        query_vector = list(self.dense_embedder.embed([query]))[0].tolist()
        results = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            using="dense",
            limit=limit,
        ).points
        return [self._format_hit(p) for p in results]

    def search_sparse(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """pure sparse BM25 lexical search"""
        sparse_obj = list(self.sparse_embedder.embed([query]))[0]
        results = self.client.query_points(
            collection_name=self.collection_name,
            query=models.SparseVector(
                indices=sparse_obj.indices.tolist(),
                values=sparse_obj.values.tolist(),
            ),
            using="bm25",
            limit=limit,
        ).points
        return [self._format_hit(p) for p in results]

    def search_hybrid_rrf(
        self,
        query: str,
        limit: int = 10,
        candidate_k: int = 25,
        rrf_k: int = 60,
    ) -> list[dict[str, Any]]:
        """fuses dense and sparse rankings using Reciprocal Rank Fusion (RRF)"""
        dense_hits = self.search_dense(query=query, limit=candidate_k)
        sparse_hits = self.search_sparse(query=query, limit=candidate_k)

        rrf_scores: dict[str, float] = {}
        payload_map: dict[str, dict[str, Any]] = {}

        # dense rank scores
        for rank, hit in enumerate(dense_hits):
            sid = hit["span_id"]
            rrf_scores[sid] = rrf_scores.get(sid, 0.0) + 1.0 / (rrf_k + rank + 1)
            payload_map[sid] = hit

        # sparse rank scores
        for rank, hit in enumerate(sparse_hits):
            sid = hit["span_id"]
            rrf_scores[sid] = rrf_scores.get(sid, 0.0) + 1.0 / (rrf_k + rank + 1)
            if sid not in payload_map:
                payload_map[sid] = hit

        # sort by fused RRF score descending
        sorted_spans = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        top_spans = sorted_spans[:limit]

        final_results = []
        for sid, score in top_spans:
            item = dict(payload_map[sid])
            item["rrf_score"] = score
            final_results.append(item)

        return final_results

    def _format_hit(self, point: Any) -> dict[str, Any]:
        hit = dict(point.payload)
        hit["score"] = getattr(point, "score", 0.0)
        return hit
