# Project Progress & State Checkpoint

Date: 2026-09-18
Project: Warrant (High-Reliability Attributed Multi-Hop Research Agent)
Author: Hamza Hattab

## Overall Project Roadmap

- [x] Phase 1: Problem Framing, HotpotQA Ingestion & Immutable State Architecture
- [ ] Phase 2: Hybrid Qdrant Retrieval (BM25 + BGE) & FlashRank CPU Reranker
- [ ] Phase 3: Structured Claim Synthesis via Local Ollama
- [ ] Phase 4: Dual-Stage Verifier (Deterministic Guard + Calibrated DeBERTa NLI)
- [ ] Phase 5: LangGraph State Machine & 3-State Abstention Contract
- [ ] Phase 6: Full-Stack App (FastAPI SSE + Next.js App Router UI)
- [ ] Phase 7: Scientific Benchmarking & Verifier Bake-Off
- [ ] Phase 8: Cloud Deployment, Live CV Link & Technical Report

---

## Phase 1 Completed Deliverables

1. **Repository & Tooling Architecture:**
   - Private Git repository initialized at `/home/hamza/AI-Learning/warrant`.
   - Astral `uv` integrated as primary package manager and runtime runner.
   - Dedicated Python 3.11 virtual environment configured at `.venv`.
   - `Makefile` configured with `uv run` targets: `install`, `test`, `lint`, `ingest`, `reproduce`.
   - `docker-compose.yml` configured for local Qdrant vector database.

2. **Core State Architecture:**
   - `warrant/core/config.py`: Pydantic settings managing model identifiers, paths, and VRAM budgets.
   - `warrant/core/schema.py`:
     - `EvidenceSpan`: Sentence-level premise representation with dynamic `[Title: X]` formatting.
     - `AtomicClaim`: Decomposed factual claims bound to explicit `cited_span_ids`.
     - `HopRecord`: Single retrieval hop recording sub-queries, retrieved spans, and latency.
     - `WarrantState`: Append-only timeline schema tracking multi-hop trajectories without memory loss.
     - `PolicyState`: 3-state enum (`FULL_PASS`, `PARTIAL_PASS`, `ABSTAIN`).

3. **Data Ingestion & Corpus Pooling:**
   - `warrant/data/span_segmenter.py`: Abbreviation-safe sentence splitting with deterministic slug IDs.
   - `warrant/data/ingest_hotpotqa.py`: Automated ingestion of 200 HotpotQA validation questions.
   - Corpus Pooled: 1,991 unique Wikipedia articles converted into 8,535 sentence spans.
   - Data Artifacts:
     - `data/hotpotqa_eval_200.json` (91 KB, tracked in Git).
     - `data/pooled_corpus_spans.jsonl` (3.7 MB, local dataset cache).

4. **Testing & Verification:**
   - Unit tests implemented in `tests/test_schema.py` and `tests/test_span_segmenter.py`.
   - Test execution via `uv run pytest -v tests/`: **5/5 tests passing in 0.02s** with 0 warnings.

5. **Theoretical Mapping & Documentation:**
   - `docs/phase_1_deep_dive.md`: Complete from-scratch technical guide.
   - Explicit mapping to HOML Chapter 2 & Appendix A (Steps 1, 2, and 3 of the 8-Step ML Checklist).
   - Explicit mapping to Agentic AI Bootcamp Section 12 (`StateSchema` and Pydantic).
   - Explicit mapping to Data Science Bootcamp Section 11 (OOP), 15 (Logging), and 51 (NLP).

---

## Git Commit Log

```
* (Pending) feat: add 200-question HotpotQA evaluation dataset and progress tracker
* 0683d0c docs: map Phase 1 to HOML 8-step checklist and local bootcamp courses
* d2d7aec docs: document Phase 1 problem framing, tree architecture, and failure modes
* e8bfc84 fix: cast numpy int32 types to standard int in HotpotQA supporting facts
* d1017b6 chore: configure Makefile to use uv runtime and runner
* 0e2c986 feat: implement HotpotQA distractor ingestion and global corpus pooling
* c0798b0 feat: implement robust sentence span segmentation and title contextualizer
* 99651fb feat: implement core Pydantic state schema, timeline structures, and unit tests
* 064d5e1 chore: initialize repository scaffolding, directory tree, and manifests
```

---

## Next Steps: Phase 2 Execution

1. Start local Qdrant container via `docker compose up -d`.
2. Implement `warrant/retrieval/hybrid_qdrant.py`:
   - Initialize Qdrant collection for 8,535 sentence spans.
   - Ingest dense embeddings (`BAAI/bge-large-en-v1.5`) and sparse BM25 payload.
   - Implement Reciprocal Rank Fusion (RRF) for sparse + dense candidate merging.
3. Implement `warrant/retrieval/flashrank_cpu.py`:
   - Cross-encoder reranker running strictly on CPU via ONNX Runtime to protect 8 GB VRAM.
4. Add retrieval benchmark tests evaluating Recall@4 and MRR on multi-hop bridge documents.
