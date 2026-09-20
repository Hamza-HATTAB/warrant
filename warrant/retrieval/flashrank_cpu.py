import time
from typing import Any, Optional
from flashrank import Ranker, RerankRequest

from warrant.core.config import settings
from warrant.core.schema import EvidenceSpan


class FlashRankCPUReranker:
    """cross-encoder reranker running strictly on CPU via ONNX runtime"""

    def __init__(self, model_name: str = "ms-marco-MiniLM-L-12-v2"):
        self.model_name = model_name
        cache_dir = str(settings.cache_dir / "flashrank")
        # cpu execution leaves 100% of GPU memory free for generator and verifier
        self.ranker = Ranker(model_name=self.model_name, cache_dir=cache_dir)

    def rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int = 4,
    ) -> tuple[list[dict[str, Any]], float]:
        """reranks candidate spans and measures cross-encoder latency"""
        if not candidates:
            return [], 0.0

        start_time = time.perf_counter()

        # format passges for flashrank request
        passages = []
        for idx, item in enumerate(candidates):
            passages.append(
                {
                    "id": item.get("span_id", str(idx)),
                    "text": item.get("formatted_premise", item.get("text", "")),
                    "meta": item,
                }
            )

        rerank_request = RerankRequest(query=query, passages=passages)
        results = self.ranker.rerank(rerank_request)

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        reranked_output = []
        for hit in results[:top_k]:
            meta = dict(hit.get("meta", {}))
            meta["cross_encoder_score"] = float(hit.get("score", 0.0))
            reranked_output.append(meta)

        return reranked_output, latency_ms
