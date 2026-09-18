# Phase 1 Deep Dive: Problem Framing, Data Pipeline, and Immutable State Architecture

This document provides a complete, first-principles explanation of Phase 1 of Warrant. It covers the motivation, the tree-based architectural breakdown, all failure modes and edge cases, and the mapping to your course materials.

---

## 1. The Core Motivation: The Citation Decoration Trap

In standard industry RAG pipelines, an enterprise prompt typically says:
> "Answer the user question based on the retrieved documents. Cite your sources."

The LLM emits an answer like:
> "Christopher Nolan was born in 1970 in London and won an Academy Award for Best Director in 2011 for Inception. [Source: Doc 1]"

If you inspect the actual source text in Doc 1, you will discover:
1. Nolan was indeed born in London in 1970.
2. Nolan did direct Inception in 2010.
3. But Nolan did not win Best Director in 2011 (Tom Hooper won for The King's Speech; Nolan won his first Best Director Oscar in 2024 for Oppenheimer).

The LLM cited the entire document chunk, but 30% of the sentence was a hallucination. The citation is decorative, not verifiable.

Warrant replaces this with an attribution and abstention contract:
- The agent cannot output ungrounded free text.
- Generation is decomposed into atomic claims.
- Each claim must cite explicit sentence-level span IDs.
- A dual-stage verifier independently verifies each claim against cited evidence.
- A 3-state policy decides whether to pass, prune, or abstain.

---

## 2. Tree-Based Architectural Breakdown of Phase 1

```
WARRANT Phase 1 Foundation
│
├── 1. Data Ingestion & Corpus Engineering
│   ├── 1.1 HotpotQA Distractor Dataset (200 Multi-Hop Questions)
│   │   ├── Bridge questions (Entity A -> Entity B -> Answer)
│   │   └── Comparison questions (Comparing properties of Entity A & B)
│   │
│   ├── 1.2 Corpus Pooling (Moving from Toy Benchmark to Real World)
│   │   ├── Toy Setting: Searching 10 isolated paragraphs per question
│   │   └── Pooled Setting: 1,991 unique Wikipedia articles in a shared space
│   │
│   └── 1.3 Sentence-Level Span Segmentation
│       ├── Abbreviation-safe sentence splitting (Dr., U.S., e.g.)
│       ├── Deterministic slugified ID generation (span_title_idx)
│       └── Title-context prefixing: "[Title: X] Body..."
│
├── 2. Agent State Architecture (Pydantic v2 & LangGraph)
│   ├── 2.1 The Append-Only Timeline (`hops: list[HopRecord]`)
│   │   ├── Preserves query decomposition history
│   │   ├── Tracks latency and retrieved span IDs per hop
│   │   └── Prevents cyclic overwriting and infinite retry loops
│   │
│   ├── 2.2 Global Evidence Pool (`evidence_pool: dict[str, EvidenceSpan]`)
│   │   ├── Single source of truth indexed by span ID
│   │   └── Prevents duplicate text storage across hops
│   │
│   ├── 2.3 The Atomic Claim Schema (`AtomicClaim`)
│   │   ├── Text of single factual assertion
│   │   ├── List of cited span IDs (1 to 3 spans)
│   │   ├── Entity guard status (Boolean pass/fail)
│   │   └── Calibrated NLI entailment score
│   │
│   └── 2.4 The 3-State Decision Policy (`PolicyState`)
│       ├── FULL_PASS: 100% of claims verified
│       ├── PARTIAL_PASS: Prune unverified assertions, emit verified core
│       └── ABSTAIN: Contradiction detected or critical evidence missing
│
└── 3. Edge Cases & Failure Modes (Handled in Phase 1)
    ├── Case A: Coreference & Pronoun Amnesia
    ├── Case B: Cyclic Search Amnesia
    ├── Case C: Compound Sentence Entailment Failure
    └── Case D: Distractor Ambiguity in Dense Space
```

---

## 3. Deep Dive: Branch by Branch

### Branch 1: Data Ingestion & Corpus Engineering

#### Why HotpotQA?
HotpotQA is specifically designed for multi-hop reasoning. Answering a query requires hopping between multiple Wikipedia articles.
Example:
> "Were Scott Derrickson and Ed Wood of the same nationality?"
To answer this, an agent must:
- Hop 1: Retrieve the article for Scott Derrickson (learns he is American).
- Hop 2: Retrieve the article for Ed Wood (learns he is American).
- Synthesis: Compare the two nationalities and confirm: "Yes, both are American."

#### The Corpus Pooling Transformation
In the raw HotpotQA release, each question is bundled with 10 paragraphs (2 gold, 8 distractors).
If you evaluate a retriever on only those 10 paragraphs, the task is trivial. Any keyword search gets over 95% recall.

In `warrant/data/ingest_hotpotqa.py`, we extract all paragraphs across the 200 questions and pool them into a global dictionary. 
- Result: **1,991 unique Wikipedia articles** yielding **8,535 sentence spans**.
- Now, when the retriever runs in Phase 2, it must locate the true bridge articles among thousands of candidates.

#### Span Segmentation & Title Context Prefixing
If you split Wikipedia articles into raw sentences, you run into pronoun resolution failures:
- Raw Sentence 0: "Christopher Nolan is a British-American film director."
- Raw Sentence 1: "He was born in London on July 30, 1970."

If the agent cites Sentence 1 as evidence for "Christopher Nolan was born in 1970", an NLI model (DeBERTa) reading only Sentence 1 will reject it because "He" could refer to anyone.

In `warrant/data/span_segmenter.py`, we implement the Title Prefixing invariant:
```python
@computed_field
@property
def formatted_premise(self) -> str:
    return f"[Title: {self.article_title}] {self.text.strip()}"
```
Sentence 1 becomes:
`[Title: Christopher Nolan] He was born in London on July 30, 1970.`
This resolves the pronoun reference without running expensive coreference resolution models.

---

### Branch 2: Agent State Architecture

#### Why Pydantic v2?
In standard Python, agents pass unstructured dictionaries (`state["docs"] = ...`). Dictionaries allow silent schema drift, missing keys, and unexpected mutations.
Pydantic v2 enforces:
1. Strict runtime typing.
2. Field-level validation and defaults.
3. Sub-millisecond serialization via `pydantic-core` (written in Rust).

#### The Append-Only Timeline vs. Mutable Overwrite
Consider this failure loop in a naive agent:
1. User asks: "What college did the director of Interstellar attend?"
2. Hop 0 retrieves: "Christopher Nolan directed Interstellar."
3. Hop 1 rewrites sub-query: "Christopher Nolan college" -> Retriever returns poor matches.
4. If `state["docs"]` was overwritten, Hop 0's findings are erased. The agent now lacks the premise that Nolan directed the film.
5. In Warrant, `state.hops` is an append-only timeline:
```python
class HopRecord(BaseModel):
    hop_idx: int
    sub_query: str
    retrieved_span_ids: list[str] = Field(default_factory=list)
    latency_ms: float = 0.0
```
Every attempt is recorded with its hop index and latency. The agent retains full historical context and can perform cycle detection: if Hop 2 attempts the exact same sub-query as Hop 1, the agent aborts and triggers abstention.

---

### Branch 3: All Edge Cases and How Phase 1 Resolves Them

| Edge Case | Description | What Happens Without Warrant | Warrant Phase 1 Solution |
| :--- | :--- | :--- | :--- |
| **Edge Case 1: Pronoun Amnesia** | Sentence contains "He/She/It" instead of entity name. | NLI verifier rejects valid evidence due to unknown subject. | `formatted_premise` prepends `[Title: Article]` to every span. |
| **Edge Case 2: Cyclic Search Amnesia** | A failed retrieval hop triggers a rewrite loop. | State overwrites previous docs, causing infinite retry loops. | Append-only `HopRecord` timeline maintains full flight recorder. |
| **Edge Case 3: Compound Claim Hallucination** | Sentence has 2 facts: one true, one hallucinated. | Document-level citation masks the fake fact. | Decomposed into `AtomicClaim` objects verified individually. |
| **Edge Case 4: Distractor Ambiguity** | Multiple articles share similar keywords. | Basic keyword search matches wrong document. | Corpus pooling forces hybrid dense-sparse search in Phase 2. |
| **Edge Case 5: Abbreviation Over-Splitting** | Sentence splitting on "Dr." or "U.S." breaks sentences. | Evidence spans are fragmented into meaningless fragments. | `split_sentences_robust` protects known abbreviations with placeholders. |

---

## 4. Connection to Your Local Course Materials

1. **HOML 3rd Edition (Chapter 2 & Appendix A):**
   - Géron's primary rule: *Isolate the test harness before touching model training or tuning.*
   - In Phase 1, we isolated `data/hotpotqa_eval_200.json` and established the evaluation corpus *before* configuring retrieval or prompting LLMs.

2. **Complete Agentic AI Bootcamp (Section 12: LangGraph Components):**
   - Notebook `2. 4-pydantic.ipynb` illustrates defining strict state schemas.
   - We translated this into `WarrantState`, ensuring every state transition is typed and validated.

3. **Complete DS ML DL NLP Bootcamp (Section 51: NLP for ML):**
   - Covers sentence boundary detection, tokenization regexes, and text preprocessing.
   - Reflected directly in our regex protection logic in `warrant/data/span_segmenter.py`.

---

## 5. Phase 1 Code Verification Summary

All modules implemented for Phase 1 have been tested and verified:
- `warrant/core/config.py`: Centralized Pydantic settings.
- `warrant/core/schema.py`: `WarrantState`, `EvidenceSpan`, `AtomicClaim`, `HopRecord`.
- `warrant/data/span_segmenter.py`: Abbreviation-safe sentence splitter.
- `warrant/data/ingest_hotpotqa.py`: HotpotQA loader and corpus pooling script.
- Test Suite: 5/5 unit tests passing in 0.02s (`pytest tests/`).
- Ingestion Data Artifacts:
  - `data/hotpotqa_eval_200.json`: 200 evaluation items with gold answers and supporting facts.
  - `data/pooled_corpus_spans.jsonl`: 8,535 sentence spans across 1,991 unique articles.
