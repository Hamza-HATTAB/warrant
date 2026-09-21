# WARRANT: Attributed Multi-Hop Research Agent

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2.13-black.svg)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal.svg)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2.34-orange.svg)](https://langchain-ai.github.io/langgraph)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Technical Report](https://img.shields.io/badge/Technical_Report-TECHNICAL__REPORT.md-purple.svg)](TECHNICAL_REPORT.md)

WARRANT is an enterprise-grade attributed multi-hop research agent designed to eliminate citation decoration and semantic hallucination in retrieval-augmented generation (RAG).

Standard RAG architectures suffer from citation decoration: models cite entire document chunks, but the underlying text fails to logically entail the emitted assertions. WARRANT solves this failure mode by decomposing answers into atomic claims, resolving multi-hop premises across disparate documents, and applying a dual-stage verification engine (sub-millisecond deterministic guards and temperature-calibrated DeBERTa-v3 NLI) under a strict 3-state abstention contract: `FULL_PASS`, `PARTIAL_PASS`, or `ABSTAIN`.

---

## Live Interactive Demonstrations & Technical Whitepaper

- **Production UI**: [https://warrant-hamza-riadh-s-projects.vercel.app](https://warrant-hamza-riadh-s-projects.vercel.app)
  - Hosted on Vercel with standalone interactive trajectory simulation, visual DAG timeline, claim-level attribution matrices, and dynamic evidence hover linking.
  - Supports live remote connection to local GPU compute via zero-trust Cloudflare HTTPS tunnels.
- **Formal Technical Whitepaper**: [TECHNICAL_REPORT.md](TECHNICAL_REPORT.md)
  - Publication-grade engineering report covering mathematical formulations of temperature calibration, empirical HotpotQA bake-off metrics, and 8 GB consumer GPU memory economics.

---

## System Architecture

```
                                 [ User Query ]
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │   LangGraph State Machine     │
                        │   (Cyclic Router, Max 2 Hops) │
                        └───────────────┬───────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
       [ Hop 1: Anchor Retrieval ]                   [ Hop 2: Bridged Retrieval ]
       Qdrant Dense (BGE-Large)                      Qdrant Dense (BGE-Large)
       + Sparse BM25 (RRF k=60)                      + Sparse BM25 (RRF k=60)
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        │
                                        ▼
                         [ FlashRank CPU Cross-Encoder ]
                         (MiniLM Reranking Top-3 Spans)
                                        │
                                        ▼
                      [ Gemma 3 12B Unified Synthesis ]
                      (Local RTX 4060 GPU · Q4_K_M GGUF)
                      Structured Atomic Claim Decomposition
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │    Dual-Stage Verification Engine       │
                   ├─────────────────────────────────────────┤
                   │ Stage 1: Deterministic Guard (<1ms)     │
                   │ Regex dates, numerals, named entities   │
                   │                                         │
                   │ Stage 2: Calibrated DeBERTa-v3 NLI      │
                   │ Directional entailment (tau >= 0.82)    │
                   │ Multi-threaded CPU (0 MB GPU VRAM)      │
                   └────────────────────┬────────────────────┘
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │     3-State Policy Contract Verdict     │
                   ├─────────────────────────────────────────┤
                   │ FULL_PASS: 100% claims verified         │
                   │ PARTIAL_PASS: Prunes ungrounded claims  │
                   │ ABSTAIN: Zero-hallucination refusal     │
                   └─────────────────────────────────────────┘
```

---

## Empirical Verifier Bake-Off Benchmark

WARRANT was empirically evaluated against the 200-question HotpotQA multi-hop validation benchmark (`benchmarks/bake_off_benchmark.py`), comparing Naive RAG, LLM-as-a-Judge, and the WARRANT Hybrid Verifier:

| Method | Hallucination Rate (%) | Precision (%) | F1 Score | Verification Latency | GPU VRAM Contention |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Naive RAG (Baseline)** | 50.0% | 50.0% | 66.7% | 0.0 ms | 0 MB |
| **LLM-as-a-Judge (Prompted 12B)** | 37.5% | 62.5% | 76.9% | 4,420.0 ms | 12,288 MB |
| **WARRANT Hybrid Verifier** | **0.0%** | **100.0%** | **88.9%** | **461.9 ms (CPU)** | **0 MB** |

### Key Findings
1. **Zero Hallucinations**: WARRANT achieved a 0.0% hallucination rate across all tested claims, intercepting fine-grained numeral mutations (e.g. 1844 vs 1845) that bypassed prompted generative judges.
2. **9.5x Lower Latency**: Cross-encoder classification on 8 CPU threads executed in 462ms, compared to 4,420ms for the secondary generative pass.
3. **Zero GPU VRAM Overhead**: Offloading DeBERTa-v3 NLI to CPU threads preserved 100% of the 8 GB GPU VRAM for Gemma 3 12B Unified inference, preventing out-of-memory (OOM) driver crashes.

---

## Hardware Profile (8 GB VRAM Budget)

WARRANT is specifically architected to co-exist on a single developer workstation with an NVIDIA RTX 4060 (8 GB VRAM):

- **Synthesis LLM**: Gemma 3 12B Unified (`gemma3:12b` in Ollama, Q4_K_M GGUF, 7.36 GB active memory).
- **Dense Retriever**: `BAAI/bge-large-en-v1.5` (1024-dimensional embeddings via Qdrant).
- **Cross-Encoder Reranker**: FlashRank MiniLM running on ONNX Runtime CPU (0 MB GPU VRAM).
- **NLI Verifier**: `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` running on PyTorch CPU threads (0 MB GPU VRAM).
- **Active GPU Headroom**: Maintained with over 700 MB of VRAM headroom to accommodate KV-cache expansion during multi-hop context accumulation.

---

## Repository Structure

```
warrant/
├── warrant/
│   ├── core/               # State schema, settings, and Pydantic error models
│   ├── data/               # HotpotQA ingestion and sentence-span segmenter
│   ├── retrieval/          # Hybrid Qdrant vector search and FlashRank CPU reranker
│   ├── synthesis/          # Gemma 3 12B Ollama client and claim decomposition
│   ├── verifier/           # Deterministic guards, calibrator, and DeBERTa NLI
│   ├── graph/              # LangGraph state machine, nodes, and cyclic router
│   └── api/                # FastAPI backend with Server-Sent Events (SSE) streaming
├── frontend/               # Next.js 14 App Router UI (Meykiio 07+09 design system)
│   ├── app/                # Layout, globals.css, and main studio page
│   ├── components/         # Navbar, QueryBar, Stepper, Studio, and Modals
│   └── lib/                # SSE client, TypeScript contracts, and preset trajectories
├── tests/                  # 37+ automated unit, integration, and adversarial tests
├── benchmarks/             # Verifier bake-off runner and empirical evaluation scripts
├── scripts/                # Zero-trust Cloudflare tunnel daemon
├── Makefile                # Automation targets
└── pyproject.toml          # Python dependency manifest
```

---

## Quickstart & Commands

### Prerequisites
- Python 3.11+ with Astral `uv`
- Node.js 18+ and npm
- Docker (for Qdrant)
- Ollama running `gemma3:12b` (`ollama run gemma3:12b`)

### 1. Installation
```bash
# Clone repository
git clone https://github.com/Hamza-HATTAB/warrant.git
cd warrant

# Install Python virtual environment & dependencies
make install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Run Automated Test Suite
```bash
# Run all 37 unit, integration, and adversarial tests
make test

# Run adversarial and stress tests specifically
make test-adversarial
```

### 3. Run Benchmark Reproduction
```bash
# Reproduce the 3-way Verifier Bake-Off benchmark
make reproduce
```

### 4. Run Development Servers
```bash
# Terminal 1: Launch FastAPI SSE backend (port 8000)
make run-api

# Terminal 2: Launch Next.js 14 frontend (port 3000)
make run-frontend
```

### 5. Launch Live Zero-Trust Tunnel for Remote Deployment
```bash
# Launches an encrypted public HTTPS tunnel to your local RTX 4060 GPU
make tunnel
```

---

## 3-State Abstention Contract

Unlike naive RAG systems that force answers when ungrounded, WARRANT enforces a mathematical 3-state output guarantee:

1. **`FULL_PASS`**: 100% of synthetic claims pass Stage 1 Deterministic Guard and exceed calibrated DeBERTa NLI threshold ($\tau \ge 0.82$). The response is assembled with verified claim attribution tags.
2. **`PARTIAL_PASS`**: At least one claim is verified, but ungrounded claims are detected. WARRANT prunes non-entailed claims and safely delivers the verified core with an explicit audit notice.
3. **`ABSTAIN`**: Zero valid supporting spans retrieved, or all claims fail attribution. WARRANT outputs a structured refusal rather than fabricating ungrounded information.

---

## Author & Contact

**Hamza Hattab**  
Applied AI Engineer & Machine Learning Specialist  
GitHub: [https://github.com/Hamza-HATTAB](https://github.com/Hamza-HATTAB)
