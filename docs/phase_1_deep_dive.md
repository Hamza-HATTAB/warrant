# Phase 1: Problem Framing, Ingestion, and State Architecture (80/20 Deep Dive)

This document explains Phase 1 from absolute first principles using the 80/20 rule: focusing on the 20% of foundational concepts that generate 80% of runtime reliability and engineering clarity.

---

## 1. What is Pydantic? (From Scratch)

In standard Python, variables and dictionaries have **zero type enforcement** at runtime:

```python
# The Standard Python Problem
doc = {"title": "Inception", "year": "2010", "score": "high"}

# Python permits typos and incorrect types silently:
doc["scores"] = 0.95      # Typo: created a new key "scores" instead of "score"
doc["year"] = None        # Wrong type: downstream functions crash later with TypeError
```

In multi-agent systems, if one node produces unstructured or malformed output, the entire graph fails silently or crashes deep inside an execution loop.

### The Pydantic Solution
**Pydantic** is a data-validation and parsing library. You define a blueprint (a class inheriting from `BaseModel`):

```python
from pydantic import BaseModel

class EvidenceSpan(BaseModel):
    title: str
    year: int
    score: float

# Pydantic validates and coerces data at runtime:
span = EvidenceSpan(title="Inception", year="2010", score=0.95)
# Result: year is automatically converted from string "2010" to integer 2010.
# If an invalid type is passed (e.g. score="invalid"), it errors immediately at the boundary.
```

In Warrant, every data structure passing through the agent is a strict Pydantic model.

---

## 2. The Big Picture Tree (Phase 1 80/20 Architecture)

```
Phase 1 Foundation
│
├── 1. Data Contract (Pydantic v2)
│    ├── Problem: Python dicts mutate unpredictably and allow silent schema drift.
│    └── Solution: WarrantState, EvidenceSpan, AtomicClaim, HopRecord enforce strict types.
│
├── 2. Memory Contract (Append-Only Timeline)
│    ├── Problem: Overwriting state causes "search amnesia" during cyclic retries.
│    └── Solution: Every retrieval is recorded in hops: list[HopRecord] (the flight recorder).
│
└── 3. Attribution Contract (Title-Context Spans)
     ├── Problem: 500-word chunks dilute NLI attention; raw sentences lose pronoun context.
     └── Solution: [Title: Article] + single sentence = precise, verifiable premise.
```

---

## 3. Contrastive Analysis: Bad Practice vs. Warrant 80/20

| Architectural Layer | The Naive Way (Fails in Production) | The Warrant 80/20 Way (Enterprise Grade) |
| :--- | :--- | :--- |
| **State Management** | `state = {"docs": [...]}` (raw dictionary). No runtime validation, prone to key errors. | `WarrantState(BaseModel)` in `warrant/core/schema.py`. Strict typing and field validation. |
| **Retrieval History** | `state["docs"] = new_docs`. Overwriting previous hops. Failed retries erase earlier evidence. | `state.hops.append(HopRecord)`. Append-only timeline preserving complete audit history. |
| **Evidence Granularity**| 500-token chunk cited as `[Doc 1]`. NLI cross-attention is diluted across irrelevant text. | `[Title: X] + Sentence`. Focused 20-word span. Cross-attention is concentrated and calibrated. |
| **Corpus Pooling** | Querying only the 10 provided paragraphs per HotpotQA item (artificial 95%+ recall). | Pooling 200 questions into 1,991 unique articles (8,535 spans) to test real-world retrieval. |

---

## 4. The 5 Edge Cases Handled in Phase 1

1. **Pronoun Amnesia:**
   - *Failure:* Sentence reads *"He directed Inception in 2010."* An NLI model rejects it because the referent for "He" is unknown.
   - *Fix:* `span.formatted_premise` prepends the article title: `[Title: Christopher Nolan] He directed Inception in 2010.`
2. **Cyclic Search Amnesia:**
   - *Failure:* Hop 1 fails. Agent rewrites query. If state is overwritten, Hop 0's evidence is lost.
   - *Fix:* `hops: list[HopRecord]` tracks every hop index, query, retrieved span list, and latency.
3. **Compound Claim Hallucination:**
   - *Failure:* A generated sentence has two facts: one true, one false. Document-level citations hide the lie.
   - *Fix:* Split into `AtomicClaim` models so each assertion is verified independently.
4. **Distractor Ambiguity:**
   - *Failure:* Keyword search matches unrelated articles with identical terms.
   - *Fix:* Pooled corpus of 1,991 documents forces hybrid dense-sparse retrieval in Phase 2.
5. **Abbreviation Over-Splitting:**
   - *Failure:* Standard sentence splitters break on "Dr.", "U.S.", or "Prof.".
   - *Fix:* `split_sentences_robust` replaces known abbreviations with tokens before regex splitting.

---

## 5. Direct Course & Resource Cross-References

### A. Agentic AI Bootcamp — Section 12 (LangGraph Components)
* **Notebooks:** 
  - [1. 3-DataclassStateSchema.ipynb](file:///home/hamza/Courses/Complete_Agentic_AI_Bootcamp/12%20-%20LangGraph%20Components/1.%203-DataclassStateSchema.ipynb)
  - [2. 4-pydantic.ipynb](file:///home/hamza/Courses/Complete_Agentic_AI_Bootcamp/12%20-%20LangGraph%20Components/2.%204-pydantic.ipynb)
* **Core Takeaway:** LangGraph uses state schemas to control data flow. In `warrant/core/schema.py`, we implemented `WarrantState` to manage state across cyclic retry nodes.

### B. Hands-On Machine Learning (HOML 3rd Ed.) — Chapter 2 & Appendix A
* **References:**
  - [appendix_A_ml_project_checklist.pdf](file:///home/hamza/AI-Learning/Books/HOML/homl_chapters/appendix_A_ml_project_checklist.pdf)
  - [02_end_to_end_machine_learning_project.pdf](file:///home/hamza/AI-Learning/Books/HOML/homl_chapters/02_end_to_end_machine_learning_project.pdf)
* **Core Takeaway:** The 8-Step ML Checklist dictates:
  1. *Step 1 (Frame Problem):* Defined attribution contract, abstention states (`FULL_PASS`, `PARTIAL_PASS`, `ABSTAIN`), and 6.5 GB active VRAM ceiling.
  2. *Step 2 (Get Data):* Ingested 200 HotpotQA questions into `data/hotpotqa_eval_200.json` to lock the evaluation set before running models.
  3. *Step 3 (Prepare Data):* Segmented 8,535 sentence spans with title context in `data/pooled_corpus_spans.jsonl`.

### C. Complete Data Science ML DL NLP Bootcamp 2025
* **Section 11 (OOP Concepts):** Class methods and property decorators used in `EvidenceSpan.formatted_premise`.
* **Section 15 (Logging):** Structured latency tracking via `HopRecord.latency_ms` and `WarrantState.total_latency_ms`.
* **Section 51 (NLP for ML):** Sentence tokenization, regex handling, and text sanitation.

---

## 6. Active Recall Validation Quiz

Answer these 3 questions in your own words to certify Phase 1:

1. **Why do we use Pydantic `BaseModel` instead of standard Python dictionaries for agent state?**
2. **Why must retrieval hops be stored in an append-only timeline (`hops: list[HopRecord]`) instead of overwriting a single variable?**
3. **Why does Warrant prepend `[Title: Article]` to each extracted sentence span?**
