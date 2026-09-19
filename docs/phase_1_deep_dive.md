# Phase 1 Master Guide: Complete From-Scratch Deep Dive

This guide teaches the complete engineering foundation of **Phase 1: Problem Framing, Data Ingestion, and State Architecture**. 

Every concept is explained from absolute first principles, followed by a line-by-line code walkthrough of what we implemented, and direct links to your local books and course notebooks.

---

## The Tree-Based Big Picture of Phase 1

```
Phase 1: Foundations & Architecture
│
├── 1. The Core Problem
│   ├── 1.1 The Citation Decoration Trap (Why standard RAG fails in enterprise)
│   └── 1.2 The Warrant Solution: An Attributed Contract with Abstention
│
├── 2. Data Engineering & Corpus Pooling
│   ├── 2.1 Multi-Hop Reasoning: Bridge vs. Comparison Questions
│   ├── 2.2 The Toy Benchmark Trap vs. Global Corpus Pooling (1,991 Articles)
│   └── 2.3 Sentence-Level Span Segmentation & Title Context Prefixing
│
├── 3. State Architecture & Invariant Enforcement
│   ├── 3.1 Why Pydantic v2? (Fail-fast boundary validation vs. Python dicts)
│   ├── 3.2 The Flight Recorder: Append-Only Timeline (`HopRecord`)
│   ├── 3.3 Atomic Claim Decomposition (`AtomicClaim`)
│   └── 3.4 The 3-State Decision Policy (`FULL_PASS`, `PARTIAL_PASS`, `ABSTAIN`)
│
├── 4. Line-by-Line Code Walkthrough
│   ├── `warrant/core/config.py` (VRAM limits, paths, thresholds)
│   ├── `warrant/core/schema.py` (Data models and state invariants)
│   ├── `warrant/data/span_segmenter.py` (Abbreviation-safe splitting & slugs)
│   └── `warrant/data/ingest_hotpotqa.py` (Ingestion pipeline & serialization)
│
├── 5. Study Guide & Exact Course Links
│   ├── Hands-On Machine Learning (HOML 3rd Ed.) — Steps 1, 2, and 3
│   ├── Agentic AI Bootcamp — Section 12 (LangGraph StateSchema)
│   └── Complete Data Science Bootcamp — Sections 11, 15, and 51
│
└── 6. Certification Quiz (3 Active Recall Questions)
```

---

## 1. The Core Problem: Why Standard RAG Fails

### 1.1 The Citation Decoration Trap
In standard RAG tutorials, an LLM prompt says: *"Answer the question using the retrieved text and cite your sources."*

Suppose the question is: *"When was the director of Inception born and what honors did he receive?"*

The LLM outputs:
> *"Christopher Nolan was born on July 30, 1970 in London, and won an Academy Award for Best Director in 2011 for Inception. [Source: Document 1]"*

If you inspect the actual text inside `Document 1`:
- It confirms Nolan was born on July 30, 1970 in London.
- It confirms he directed Inception in 2010.
- **But it never says he won Best Director in 2011.** (In reality, Tom Hooper won for *The King's Speech*; Nolan did not win Best Director until 2024 for *Oppenheimer*).

The model appended `[Source: Document 1]` to the end of the entire sentence. To a human reader, the citation looks legitimate. In reality, **30% of the sentence is a fabricated hallucination**. 

In LegalTech, FinTech, clinical medicine, or compliance, this behavior is fatal. Commercial cloud APIs (Claude, OpenAI) exhibit a **25% to 40% citation hallucination rate** on complex multi-hop queries.

### 1.2 The Warrant Solution
Warrant enforces an external, verifiable **Attribution Contract**:
1. An answer cannot be returned as a single block of free text. It must be broken into **atomic claims** (one factual assertion per claim).
2. Every atomic claim must point to explicit, sentence-level premise spans (`cited_span_ids: list[str]`).
3. An external, non-circular dual verifier (deterministic regex/NER guard + calibrated NLI model) verifies each claim individually.
4. If a claim is unsupported, the system executes an abstention policy: it either prunes the unverified claim (`PARTIAL_PASS`) or refuses to answer with a structured diagnostic (`ABSTAIN`).

---

## 2. Data Engineering & Corpus Pooling

### 2.1 What is Multi-Hop Reasoning?
Single-hop questions can be answered by matching keywords in a single sentence:
- *Single-hop:* "When was Christopher Nolan born?" -> Match "Christopher Nolan" + "born".

Multi-hop questions require an agent to connect dots across disjoint sources:
- **Bridge Questions:** "Where was the director of Inception born?"
  - *Hop 1:* Identify who directed Inception (Christopher Nolan).
  - *Hop 2:* Retrieve Christopher Nolan's biography and extract his birthplace (London).
- **Comparison Questions:** "Were Scott Derrickson and Ed Wood of the same nationality?"
  - *Hop 1:* Retrieve Scott Derrickson (American).
  - *Hop 2:* Retrieve Ed Wood (American).
  - *Hop 3:* Compare both nationalities (Yes, both are American).

### 2.2 The Toy Benchmark Trap vs. Global Corpus Pooling
HotpotQA is the gold-standard multi-hop dataset. In its raw form, each question is packaged with:
- 2 "Gold" paragraphs (containing the bridge facts).
- 8 "Distractor" paragraphs (unrelated Wikipedia articles).

If you build a retrieval engine and test it by searching *only among those 10 paragraphs*, the benchmark is a **toy evaluation**. Any basic BM25 keyword search achieves 95%+ recall because 8 of the paragraphs are completely off-topic.

In the real world, an enterprise knowledge base contains thousands or millions of documents.
* **Our Solution:** In `warrant/data/ingest_hotpotqa.py`, we took 200 questions and **pooled all paragraphs into a unified corpus**.
* **Result:** **1,991 unique Wikipedia articles** yielding **8,535 individual sentence spans**.
* Now, when our retriever runs in Phase 2, it must locate the needle in a real 1,991-document haystack filled with overlapping entities and lexical distractors.

### 2.3 Sentence-Level Span Segmentation & Title Context
Why not just feed 500-word document chunks to our verifier?

1. **The Attention Dilution Problem:** In a transformer model like `DeBERTa-v3`, self-attention computes relationships between all pairs of tokens ($O(N^2)$). When you pass a 500-token chunk to verify a 15-token claim, 95% of the attention weights are spent processing irrelevant background text. The entailment score degrades, leading to false positives and false negatives.
2. **The Pronoun Amnesia Problem:** If you simply split a Wikipedia article into raw sentences, you get:
   - Sentence 0: *"Christopher Nolan is a British-American filmmaker."*
   - Sentence 1: *"He was born in London on July 30, 1970."*
   If an agent cites Sentence 1 as evidence for *"Christopher Nolan was born in 1970"*, an NLI model reading Sentence 1 in isolation will say: *"Rejected. 'He' could be anyone."*
3. **The Warrant Title-Prefix Invariant:** In `warrant/data/span_segmenter.py`, every sentence span is automatically prepended with its Wikipedia article title:
   ```
   [Title: Christopher Nolan] He was born in London on July 30, 1970.
   ```
   Now, any downstream NLI model immediately resolves the referent of "He", eliminating pronoun amnesia without running slow coreference resolution pipelines.

---

## 3. State Architecture & Invariant Enforcement

### 3.1 Why Pydantic v2 Over Python Dictionaries?
In basic Python, developers pass state as raw dictionaries:
```python
state = {"docs": [], "query": "Who directed Inception?"}
```
**Why this fails in agentic systems:**
- **Zero Type Safety:** `state["query"] = 12345` executes without error.
- **Silent Key Typos:** Typing `state["retreived_docs"]` instead of `state["retrieved_docs"]` creates a new key silently. The rest of the graph receives an empty list and halts.
- **No Boundary Parsing:** If an LLM emits JSON with string numbers (`"latency": "15.4"`), raw Python requires manual `float()` conversions everywhere.

**The Pydantic v2 Invariant:**
Pydantic classes inherit from `BaseModel`. When data is passed to a model:
- Types are coerced and validated at runtime.
- Invalid structures raise an immediate `ValidationError` at the system boundary.
- Serialization to/from JSON is handled in compiled Rust (`pydantic-core`), running at sub-millisecond speeds.

### 3.2 The Flight Recorder: Append-Only Timeline
In LangGraph, agents execute in **cyclic loops**:
- If a verifier node rejects an answer because evidence was insufficient, the graph routes back to a query-rewriter node to fetch additional documents.

**The Naive Failure (Search Amnesia):**
If your state schema has a mutable field:
```python
retrieved_docs: list[str] = []
```
When Hop 1 retries, it overwrites `retrieved_docs` with new documents. 
- Hop 0's evidence is permanently lost.
- The agent has no memory of what it already tried.
- It is prone to searching the exact same failed query, entering an infinite loop.

**The Warrant Solution:**
In `warrant/core/schema.py`, we implement the **Append-Only Timeline**:
```python
hops: list[HopRecord] = []
```
Every retrieval iteration appends a new `HopRecord` containing:
- `hop_idx`: 0, 1, 2 (bounded to a maximum of 2 retries).
- `sub_query`: The exact decomposed query searched.
- `retrieved_span_ids`: The exact list of span IDs fetched.
- `latency_ms`: Execution time for that hop.

Like an airplane's black box / flight recorder, the agent never forgets past attempts, can detect duplicate search queries, and outputs a complete execution trace for debugging.

### 3.3 Atomic Claim Decomposition
An answer must never be treated as an indivisible string.
In `warrant/core/schema.py`, we define:
```python
class AtomicClaim(BaseModel):
    claim_id: str
    text: str
    cited_span_ids: list[str]
    guard_pass: Optional[bool] = None
    nli_entailment_score: Optional[float] = None
    is_verified: bool = False
    rejection_reason: Optional[str] = None
```
Each sentence generated by the LLM is an `AtomicClaim`. If an answer contains 3 claims, and claim #3 is hallucinated, claims #1 and #2 remain verified and safe.

### 3.4 The 3-State Output Policy
Rather than a binary pass/fail, Warrant implements an enterprise 3-state contract:
1. `FULL_PASS`: 100% of claims are verified by both the deterministic guard and the calibrated NLI model. Emit the complete answer with verified citations.
2. `PARTIAL_PASS`: Some non-critical claims failed verification. Prune the unsupported sentences, return the verified subset, and explicitly list the dropped claims in a diagnostic audit log.
3. `ABSTAIN`: The core premise is missing or sources contradict each other. Emit a structured refusal explaining exactly why the agent cannot answer.

---

## 4. Line-by-Line Walkthrough of Implemented Code

### 4.1 Configuration: `warrant/core/config.py`
This module manages global system settings using `pydantic_settings.BaseSettings`:
- `generator_model = "qwen2.5:7b-instruct-q4_K_M"`: Default local generator fitting within our VRAM budget.
- `fallback_generator_model = "gemma3:12b"`: Supported when verifier is offloaded to CPU.
- `verifier_model = "MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli"`: The NLI cross-encoder.
- `verification_threshold = 0.82`: Calibrated confidence threshold $\tau$.
- `max_hops = 2`: Hard boundary preventing infinite retry loops.

### 4.2 State Schemas: `warrant/core/schema.py`
Defines the core data structures:
- `PolicyState(str, Enum)`: Enforces the three valid output states (`FULL_PASS`, `PARTIAL_PASS`, `ABSTAIN`).
- `EvidenceSpan`:
  - `span_id: str`: Deterministic identifier (e.g. `span_christopher_nolan_001`).
  - `article_title: str` & `section_title: str`.
  - `formatted_premise`: Computed property prepending `[Title: {self.article_title}] {self.text}`.
- `HopRecord`: Tracks `hop_idx`, `sub_query`, `retrieved_span_ids`, and `latency_ms`.
- `WarrantState`: The master agent state passed between LangGraph nodes. Contains `add_hop()` and `add_spans()` methods to enforce append-only updates.

### 4.3 Span Segmenter: `warrant/data/span_segmenter.py`
Splits raw Wikipedia articles into sentence spans:
- `slugify(text)`: Converts article titles into clean ASCII slugs (e.g. `"Christopher Nolan"` -> `"christopher_nolan"`).
- `split_sentences_robust(text)`: 
  - Protects abbreviations (`Dr.`, `U.S.`, `Mr.`, `vs.`, `e.g.`) by temporarily replacing them with unique tokens (`__ABBR_0__`).
  - Splits on sentence-ending punctuation (`.`, `!`, `?`) followed by a space and capital letter.
  - Restores the original abbreviations.
- `segment_document_into_spans()`: Packages each sentence into an `EvidenceSpan` with its slugified ID and title context.

### 4.4 Data Ingestion & Pooling: `warrant/data/ingest_hotpotqa.py`
Automates the data pipeline:
- `fetch_hotpotqa_dev_split(num_questions=200)`: Downloads the official validation parquet file from Hugging Face and caches it locally at `data/raw/hotpot_val.parquet`.
- `process_and_pool_corpus()`:
  - Extracts 200 questions, gold answers, and supporting facts.
  - Pools all context paragraphs into a single dictionary (`pooled_docs`), extracting 1,991 unique articles.
  - Segments all articles into 8,535 sentence spans.
  - Type-casts numpy `int32` indices to native Python `int` to ensure valid JSON serialization.
  - Saves `data/hotpotqa_eval_200.json` (91 KB) and `data/pooled_corpus_spans.jsonl` (3.7 MB).

---

## 5. Study Guide & Exact Course References

Open and review these exact files on your machine to connect the theory to our code:

### A. Hands-On Machine Learning (HOML 3rd Ed.)
* **The 8-Step ML Checklist:** [appendix_A_ml_project_checklist.pdf](file:///home/hamza/AI-Learning/Books/HOML/homl_chapters/appendix_A_ml_project_checklist.pdf)
  - Review Step 1 (*Frame the Problem and Look at the Big Picture*) and Step 2 (*Get the Data*).
  - Notice Géron's rule: *Never touch model prompts or inference before isolating your evaluation set and defining deterministic performance metrics.*
* **End-to-End Project Walkthrough:** [02_end_to_end_machine_learning_project.pdf](file:///home/hamza/AI-Learning/Books/HOML/homl_chapters/02_end_to_end_machine_learning_project.pdf)
  - Review the section on creating a test set and data pipeline isolation (pages 49–54).

### B. Complete Agentic AI Bootcamp (Section 12: LangGraph Components)
* **Dataclass State Schema:** [1. 3-DataclassStateSchema.ipynb](file:///home/hamza/Courses/Complete_Agentic_AI_Bootcamp/12%20-%20LangGraph%20Components/1.%203-DataclassStateSchema.ipynb)
  - See how LangGraph passes typed state schemas between nodes.
* **Pydantic State Schema:** [2. 4-pydantic.ipynb](file:///home/hamza/Courses/Complete_Agentic_AI_Bootcamp/12%20-%20LangGraph%20Components/2.%204-pydantic.ipynb)
  - See how Pydantic models validate state mutations. We used this exact pattern to build `WarrantState` in `warrant/core/schema.py`.

### C. Complete Data Science ML DL NLP Bootcamp 2025
* **Section 11 (OOP Concepts):** Review classes, encapsulation, and property decorators used in `EvidenceSpan.formatted_premise`.
* **Section 15 (Logging in Python):** Review structured latency tracking used in `HopRecord.latency_ms`.
* **Section 51 (NLP for Machine Learning):** Review regex tokenization and sentence boundaries used in `warrant/data/span_segmenter.py`.

---

## 6. Certification Quiz (3 Active Recall Questions)

To certify your mastery of Phase 1, answer these 3 questions in your own words:

1. **Why do we enforce Pydantic `BaseModel` instead of raw Python dictionaries for agent state?**
2. **Why must retrieval hops be stored in an append-only timeline (`hops: list[HopRecord]`) instead of overwriting a single `docs` variable?**
3. **Why does Warrant prepend `[Title: Article]` to each extracted sentence span?**
