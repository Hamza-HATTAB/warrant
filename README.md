# Warrant: Attributed Multi-Hop Research Agent

Warrant is an enterprise research agent designed to enforce claim-level factual attribution and calibrated abstention contracts. 

Standard retrieval-augmented generation systems suffer from citation decoration: models cite entire document chunks, but the underlying text fails to entail the emitted assertions. Warrant addresses this failure mode by decomposing answers into atomic claims, resolving multi-hop premises, and applying a dual-stage verifier (deterministic regex/NER guard and calibrated DeBERTa-v3 NLI) under a 3-state output policy: FULL_PASS, PARTIAL_PASS, or ABSTAIN.

## Architecture

```
User Query
    │
    ▼
Hybrid Retrieval (Qdrant BM25 + BGE-Large-v1.5)
    │
    ▼
Cross-Encoder Reranking (FlashRank CPU ONNX)
    │
    ▼
Atomic Claim Synthesis (Local LLM via Ollama)
    │
    ▼
Stage 1: Deterministic Guard (spaCy NER + Regex)
    │
    ├── [Fail] ──> Cyclic Fallback / Query Rewrite (Max 2 Hops)
    │
    ▼ [Pass]
Stage 2: Calibrated NLI Verifier (DeBERTa-v3 cross-encoder)
    │
    ▼
Decision Policy
    ├── FULL_PASS: 100% claims verified
    ├── PARTIAL_PASS: Prunes unverified assertions, emits supported subset
    └── ABSTAIN: Rejection with structured failure diagnostics
```

## System Requirements and Hardware Profile

The system is configured to run on a local workstation with an 8 GB VRAM budget (NVIDIA RTX 4060):
- Generator: qwen2.5:7b-instruct-q4_K_M (4.6 GB active VRAM) or gemma-3:12b.
- Verifier: DeBERTa-v3-large (~0.9 GB VRAM or CPU ONNX).
- Reranker: FlashRank MiniLM on CPU (0 MB VRAM).
- Total active VRAM footprint is maintained below 6.5 GB to preserve headroom for KV-cache during multi-hop context expansion.

## Directory Layout

```
warrant/
├── warrant/
│   ├── core/         # State schema, settings and error definitions
│   ├── data/         # Ingestion, span segmentation and corpus pooling
│   ├── retrieval/    # Hybrid vector search and CPU reranker
│   ├── llm/          # Local Ollama client and schema extraction
│   ├── verifier/     # Deterministic entity guard and calibrated NLI
│   ├── graph/        # LangGraph state machine and cyclic router
│   └── api/          # FastAPI async backend with SSE streaming
├── tests/            # Pytest test suite
├── benchmarks/       # Bake-off runner, gold annotations and metric scripts
├── docker/           # Container definitions
├── Makefile          # Automation targets
└── pyproject.toml    # Depedency manifest
```

## Quickstart

```bash
make install
make test
```
