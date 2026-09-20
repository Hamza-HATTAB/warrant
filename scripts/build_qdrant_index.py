import json
import time
from pathlib import Path
from warrant.core.config import settings
from warrant.core.schema import EvidenceSpan
from warrant.retrieval.hybrid_qdrant import HybridQdrantRetriever


def build_index(batch_size: int = 128, limit: int = None) -> None:
    spans_path = settings.data_dir / "pooled_corpus_spans.jsonl"
    if not spans_path.exists():
        raise FileNotFoundError(f"pooled corpus spans not found at {spans_path}. Run ingest first.")

    print(f"loading spans from {spans_path}...")
    spans = []
    with open(spans_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if limit and idx >= limit:
                break
            if line.strip():
                spans.append(EvidenceSpan.model_validate_json(line))

    print(f"loaded {len(spans)} spans into memory")
    retriever = HybridQdrantRetriever()

    print(f"initializing qdrant collection '{settings.qdrant_collection}'...")
    start_time = time.perf_counter()
    total_indexed = retriever.index_spans(spans=spans, batch_size=batch_size)
    elapsed = time.perf_counter() - start_time

    print(f"successfully indexed {total_indexed} spans in {elapsed:.2f}s ({total_indexed/elapsed:.1f} spans/s)")


if __name__ == "__main__":
    build_index()
