# Phase 1 Complete Master Manual: Attributed Multi-Hop Research Agent (WARRANT)

> **Purpose of this document:**  
> This file is a **100% self-contained, end-to-end technical manual** for Phase 1 of the Warrant project. It contains the full theoretical foundation, mathematical motivations, all failure modes, the complete source code of every implemented file, the test suite, execution traces, course mappings, and a complete examination syllabus with an instruction prompt so that another AI can tutor and test you on every detail.

---

# Table of Contents
1. Executive Summary & System Invariants
2. The Core Problem: Citation Decoration & Why Standard RAG Fails
3. Multi-Hop Data Engineering & Global Corpus Pooling
4. Span Segmentation, Title Prefixing, and Attention Dilution
5. Immutable State Machine Architecture (Pydantic v2 & LangGraph)
6. Complete Source Code & Line-by-Line Technical Breakdown
   - `warrant/core/config.py`
   - `warrant/core/schema.py`
   - `warrant/data/span_segmenter.py`
   - `warrant/data/ingest_hotpotqa.py`
7. Test Suite, Verification Logs, and Data Artifacts
8. Academic & Course Mappings (HOML, LangGraph Bootcamp, DS Bootcamp)
9. Tutor Protocol: 10 Comprehensive Interview Questions & Answer Keys

---

# 1. Executive Summary & System Invariants

**WARRANT** is a high-reliability, attributed multi-hop research agent designed to enforce claim-level factual verification and a 3-state abstention contract (`FULL_PASS`, `PARTIAL_PASS`, `ABSTAIN`).

### Hardware Profile & Invariants (Local Machine Constraints)
- **Target GPU:** NVIDIA GeForce RTX 4060 Laptop GPU (8,188 MiB VRAM total).
- **VRAM Hard Ceiling:** Active GPU memory must remain strictly **under 6.5 GB** to leave headroom for KV-cache during multi-hop context generation.
- **Generator:** `qwen2.5:7b-instruct-q4_K_M` running locally via Ollama (~4.6 GB VRAM) or `gemma-3:12b` (quantized).
- **Verifier:** `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` cross-encoder (~0.9 GB VRAM or CPU ONNX).
- **Reranker:** `FlashRank-MiniLM` running strictly on **CPU** via ONNX Runtime (0 MB VRAM footprint).
- **Vector Database:** Local Dockerized **Qdrant** with hybrid BM25 + dense (`BGE-Large-v1.5`) search.

---

# 2. The Core Problem: Citation Decoration & Why Standard RAG Fails

### The Enterprise Failure Mode
In standard retrieval-augmented generation (RAG), commercial systems (ChatGPT, Claude, Perplexity, basic LangChain apps) prompt an LLM:
> *"Answer the question based on the retrieved documents and cite your sources."*

The LLM outputs fluent text with inline citations:
> *"Christopher Nolan was born in London on July 30, 1970, and won an Academy Award for Best Director in 2011 for Inception. [Source: Doc 1]"*

If an automated auditor checks `Doc 1`:
1. Nolan was born in London on July 30, 1970 $\rightarrow$ **TRUE (Entailed)**.
2. Nolan directed Inception in 2010 $\rightarrow$ **TRUE (Entailed)**.
3. Nolan won Best Director in 2011 for Inception $\rightarrow$ **FALSE (Hallucination)**. (Tom Hooper won for *The King's Speech*; Nolan won his first Best Director Oscar in 2024 for *Oppenheimer*).

The citation `[Source: Doc 1]` is **decorative**: it gives the appearance of factual rigor, but masks an unverified hallucination. Empirical benchmarks (ALCE, Vectara) prove that **25% to 40% of native citations in modern LLMs are inaccurate or ungrounded**.

### The Warrant Solution: An External Attribution Contract
Warrant makes factual attribution a mathematical, deterministic contract:
1. **Decomposition:** The generator cannot emit free-form text. It emits a structured list of **atomic claims** (`AtomicClaim`).
2. **Explicit Pointers:** Every claim points directly to a list of sentence-level span IDs (`cited_span_ids: list[str]`).
3. **Dual Verification:** Each claim is independently tested:
   $$\text{Verified} = (\text{Deterministic\_Entity\_Guard} == \text{PASS}) \land (\text{DeBERTa\_NLI\_Score} \ge \tau)$$
4. **The 3-State Decision Policy:**
   - `FULL_PASS`: 100% of claims verified $\rightarrow$ Emit answer with verified span citations.
   - `PARTIAL_PASS`: Some non-critical assertions fail $\rightarrow$ Prune unsupported sentences, return verified core, explicitly flag dropped assertions.
   - `ABSTAIN`: Critical premise missing or evidence contradicts $\rightarrow$ Emit structured refusal diagnostic.

---

# 3. Multi-Hop Data Engineering & Global Corpus Pooling

### Single-Hop vs. Multi-Hop Reasoning
- **Single-Hop:** The answer exists inside a single document (e.g. *"When was Christopher Nolan born?"*).
- **Multi-Hop (Bridge Questions):** The agent must connect multiple entities across different documents:
  - *Question:* *"Where was the director of Inception born?"*
  - *Hop 1:* Identify director of Inception $\rightarrow$ Christopher Nolan.
  - *Hop 2:* Retrieve Christopher Nolan biography $\rightarrow$ Born in Westminster, London.
- **Multi-Hop (Comparison Questions):** The agent must compare properties of two separate entities:
  - *Question:* *"Were Scott Derrickson and Ed Wood of the same nationality?"*
  - *Hop 1:* Scott Derrickson $\rightarrow$ American.
  - *Hop 2:* Ed Wood $\rightarrow$ American.
  - *Hop 3:* Compare $\rightarrow$ Yes, both are American.

### The "Toy Benchmark" Trap vs. Global Corpus Pooling
HotpotQA is the standard benchmark for multi-hop question answering. Each sample in the dataset ships with:
- 2 Gold paragraphs (containing the answer).
- 8 Distractor paragraphs (unrelated articles).

If a researcher tests retrieval by searching *only within those 10 paragraphs*, the evaluation is **scientifically invalid**:
- In a 10-paragraph pool, finding the 2 gold paragraphs is trivial. Even a basic keyword search achieves 95%+ recall.
- In real-world enterprise systems, an agent must search among tens of thousands of documents where many lookalike articles share overlapping keywords.

### The Warrant Pooling Implementation
In `warrant/data/ingest_hotpotqa.py`, we take 200 HotpotQA validation questions and **pool all context paragraphs into a single unified global corpus**:
- **Evaluation Questions:** 200 multi-hop questions with gold answers and supporting facts stored in `data/hotpotqa_eval_200.json`.
- **Global Corpus:** **1,991 unique Wikipedia articles** pooled into **8,535 sentence spans** stored in `data/pooled_corpus_spans.jsonl`.
- Now, when retrieval runs, finding the bridge document requires searching through 1,991 competing articles, simulating true enterprise needle-in-a-haystack search.

---

# 4. Span Segmentation, Title Prefixing, and Attention Dilution

### The Attention Dilution Problem
In standard RAG, systems retrieve entire 500-word chunks. Why can't we feed a 500-word chunk directly to our NLI model (`DeBERTa-v3`)?
1. In transformer self-attention, every token computes attention against every other token:
   $$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$
2. When evaluating a 15-token claim against a 500-token chunk, 95% of the text is irrelevant background noise (e.g. awards, box office numbers, quotes).
3. The attention weights become diluted across the 500 tokens, flattening the cross-entropy loss and resulting in uncalibrated, noisy entailment scores.

### The Pronoun Amnesia Problem
If we split an article into individual sentences, Wikipedia text frequently uses pronouns:
- *Sentence 0:* "Christopher Nolan is a British-American filmmaker."
- *Sentence 1:* "He was born in Westminster, London on July 30, 1970."

If the agent cites Sentence 1 as evidence for *"Christopher Nolan was born in 1970"*, an NLI model reading Sentence 1 in isolation will reject it because **the referent for "He" is unknown**.

### The Warrant Title-Prefix Invariant
In `warrant/data/span_segmenter.py`, every sentence span is automatically prepended with its Wikipedia article title:
```python
@computed_field
@property
def formatted_premise(self) -> str:
    return f"[Title: {self.article_title}] {self.text.strip()}"
```
Sentence 1 becomes:
```
[Title: Christopher Nolan] He was born in Westminster, London on July 30, 1970.
```
Now, the NLI model immediately connects "He" to "Christopher Nolan", eliminating pronoun amnesia with zero extra runtime cost.

### Abbreviation Protection
Naive sentence splitters break sentences at every period (`.`).
This shatters sentences containing abbreviations:
- Raw: *"Dr. Nolan moved to the U.S. in 2001."*
- Naive split: `["Dr.", "Nolan moved to the U.", "S.", "in 2001."]` (Broken!)
- `warrant/data/span_segmenter.py` protects abbreviations (`Dr.`, `U.S.`, `Prof.`, `vs.`, `e.g.`) by temporarily replacing them with unique tokens (`__ABBR_0__`) before regex splitting.

---

# 5. Immutable State Machine Architecture (Pydantic v2 & LangGraph)

### Why Raw Python Dictionaries Fail in Agentic Systems
```python
# The Naive Python Dictionary Pattern
state = {"query": "Who directed Inception?", "docs": []}

# Failure 1: Silent Key Typos
state["retreived_docs"] = ["doc1"]  # Creates new key silently; "docs" remains empty!

# Failure 2: Silent Type Incoherence
state["query"] = None  # Valid in Python; crashes downstream nodes with TypeError!
```

### The Pydantic v2 Invariant
Pydantic classes inherit from `pydantic.BaseModel`:
- Enforces strict data types at runtime.
- Emits an immediate `ValidationError` if malformed data enters the agent boundary.
- Serializes and deserializes via `pydantic-core` (written in Rust), running at sub-millisecond speeds.

### The Flight Recorder Pattern (Append-Only Timeline)
In LangGraph, agents execute in cyclic loops:
$$\text{Query} \rightarrow \text{Retrieve} \rightarrow \text{Generate} \rightarrow \text{Verify} \rightarrow [\text{Fail}] \rightarrow \text{Rewrite} \rightarrow \text{Retrieve}$$

If an agent naively overwrites its state:
```python
state["docs"] = new_docs  # WRONG: Erases Hop 0 findings!
```
- When Hop 1 executes, Hop 0's evidence is permanently lost.
- The agent has no historical memory of what queries it previously tried.
- It is prone to searching the exact same query, entering an infinite loop.

**The Warrant Solution:**
In `warrant/core/schema.py`, retrieval hops are stored in an **append-only timeline**:
```python
hops: list[HopRecord] = []
```
Every attempt appends a new `HopRecord` (sub-query, retrieved span IDs, latency). Like an airplane flight recorder, the agent has complete visibility over previous attempts, can detect duplicate search queries, and outputs an audit trace.

---

# 6. Complete Source Code & Line-by-Line Technical Breakdown

Below is the complete code for all 4 modules implemented in Phase 1.

### Module 1: `warrant/core/config.py`
```python
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """runtime configuartion and paths for the warrant system"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # model endpoints and identifiers
    ollama_base_url: str = "http://localhost:11434"
    generator_model: str = "qwen2.5:7b-instruct-q4_K_M"
    fallback_generator_model: str = "gemma3:12b"
    verifier_model: str = "MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli"
    embedding_model: str = "BAAI/bge-large-en-v1.5"

    # qdrant vector store
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_grpc_port: int = 6334
    qdrant_collection: str = "warrant_hotpotqa"

    # verification parameters
    verification_threshold: float = 0.82
    max_hops: int = 2
    max_spans_per_claim: int = 3
    retrieval_top_k: int = 10
    rerank_top_k: int = 4

    # paths
    base_dir: Path = Path(__file__).resolve().parent.parent.parent
    data_dir: Path = base_dir / "data"
    cache_dir: Path = base_dir / "cache"


settings = Settings()
```
**Line-by-Line Explanation:**
- `model_config = SettingsConfigDict(...)`: Automatically reads environment variables or `.env` file overrides.
- `generator_model`: Defaults to `qwen2.5:7b` (4.6 GB VRAM) to leave room for DeBERTa on GPU.
- `verification_threshold = 0.82`: The calibrated confidence cutoff $\tau$.
- `max_hops = 2`: Hard recursion limit to prevent infinite LangGraph retry loops.
- `base_dir`, `data_dir`, `cache_dir`: Resolves absolute system paths dynamically.

---

### Module 2: `warrant/core/schema.py`
```python
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, computed_field


class PolicyState(str, Enum):
    FULL_PASS = "FULL_PASS"
    PARTIAL_PASS = "PARTIAL_PASS"
    ABSTAIN = "ABSTAIN"


class EvidenceSpan(BaseModel):
    """sentence level evidence span with title context"""
    span_id: str
    article_title: str
    section_title: str = "Lead"
    sentence_idx: int
    text: str

    @computed_field
    @property
    def formatted_premise(self) -> str:
        """prepends title to prevent pronoun and coreference resolution errors"""
        return f"[Title: {self.article_title}] {self.text.strip()}"


class AtomicClaim(BaseModel):
    """single factual assertion tied to cited span identifiers"""
    claim_id: str
    text: str
    cited_span_ids: list[str] = Field(default_factory=list)
    extracted_entities: list[str] = Field(default_factory=list)
    extracted_numbers: list[str] = Field(default_factory=list)
    guard_pass: Optional[bool] = None
    nli_entailment_score: Optional[float] = None
    is_verified: bool = False
    rejection_reason: Optional[str] = None


class HopRecord(BaseModel):
    """record of single retrieval hop in append only timeline"""
    hop_idx: int
    sub_query: str
    retrieved_span_ids: list[str] = Field(default_factory=list)
    latency_ms: float = 0.0


class WarrantState(BaseModel):
    """immutable agent state tracking query hops and verifcation status"""
    query: str
    hops: list[HopRecord] = Field(default_factory=list)
    evidence_pool: dict[str, EvidenceSpan] = Field(default_factory=dict)
    claims: list[AtomicClaim] = Field(default_factory=list)
    policy: PolicyState = PolicyState.ABSTAIN
    final_answer: Optional[str] = None
    dropped_claims: list[AtomicClaim] = Field(default_factory=list)
    abstention_diagnostic: Optional[str] = None
    total_latency_ms: float = 0.0

    def add_hop(self, hop: HopRecord) -> None:
        self.hops.append(hop)

    def add_spans(self, spans: list[EvidenceSpan]) -> None:
        for span in spans:
            if span.span_id not in self.evidence_pool:
                self.evidence_pool[span.span_id] = span
```
**Line-by-Line Explanation:**
- `PolicyState`: Strict 3-state string enum. Prevents arbitrary string states.
- `EvidenceSpan`: Stores sentence index, title, and raw text.
- `@computed_field formatted_premise`: Prepends `[Title: {article_title}]` so that serialization includes the title-prepended text without duplicate storage.
- `AtomicClaim`: Isolates single assertions and tracks NER guard results and NLI scores independently.
- `HopRecord`: Encapsulates an individual search query, retrieved IDs, and timing.
- `WarrantState`: Master LangGraph state.
  - `add_hop()`: Enforces the append-only timeline.
  - `add_spans()`: Deduplicates evidence spans into a global dictionary keyed by `span_id`.

---

### Module 3: `warrant/data/span_segmenter.py`
```python
import re
import unicodedata
from warrant.core.schema import EvidenceSpan


def slugify(text: str) -> str:
    """simple ascii slugifier for span id generation"""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "_", text)[:40]


def split_sentences_robust(text: str) -> list[str]:
    """regex sentence splittng with protection for common titles and abbreviations"""
    text = text.strip()
    if not text:
        return []

    # protect common abbreviations from splitting
    protected = text
    abbrevs = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Sr.", "Jr.", "vs.", "e.g.", "i.e.", "U.S.", "U.K.", "St."]
    placeholders = {}
    for idx, abbrev in enumerate(abbrevs):
        token = f"__ABBR_{idx}__"
        placeholders[token] = abbrev
        protected = protected.replace(abbrev, token)

    # split on terminal punctuation followed by whitespace and capital letter
    raw_sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9"\'\(\[])', protected)

    sentences = []
    for s in raw_sentences:
        s = s.strip()
        if not s:
            continue
        # restore abbreviations
        for token, original in placeholders.items():
            s = s.replace(token, original)
        sentences.append(s)

    return sentences


def segment_document_into_spans(
    article_title: str,
    text: str,
    section_title: str = "Lead"
) -> list[EvidenceSpan]:
    """segments document text into discrete evidence spans with formatted premise identifiers"""
    sentences = split_sentences_robust(text)
    slug = slugify(article_title) or "doc"
    spans = []

    for idx, sent in enumerate(sentences):
        span_id = f"span_{slug}_{idx:03d}"
        spans.append(
            EvidenceSpan(
                span_id=span_id,
                article_title=article_title,
                section_title=section_title,
                sentence_idx=idx,
                text=sent
            )
        )

    return spans
```
**Line-by-Line Explanation:**
- `slugify()`: Normalizes Unicode titles to lowercase ASCII strings (e.g. `"Christopher Nolan"` $\rightarrow$ `"christopher_nolan"`).
- `split_sentences_robust()`:
  - Iterates over common English abbreviations (`Dr.`, `U.S.`, `vs.`) and swaps them with tokens (`__ABBR_0__`).
  - Uses positive lookbehind `(?<=[.!?])` and positive lookahead `(?=[A-Z0-9...])` to split only on actual sentence boundaries.
  - Swaps placeholders back to original text.
- `segment_document_into_spans()`: Assigns a zero-padded deterministic ID (e.g. `span_inception_000`, `span_inception_001`) and packages each sentence as an `EvidenceSpan`.

---

### Module 4: `warrant/data/ingest_hotpotqa.py`
```python
import json
import os
from pathlib import Path
from typing import Any
from warrant.core.config import settings
from warrant.core.schema import EvidenceSpan
from warrant.data.span_segmenter import segment_document_into_spans


def fetch_hotpotqa_dev_split(num_questions: int = 200) -> list[dict[str, Any]]:
    """fetches hotpotqa distractor validation split from huggingface or local cache"""
    cache_path = settings.data_dir / "raw" / "hotpot_val.parquet"
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "raw").mkdir(parents=True, exist_ok=True)

    # attempt downlaod if parquet does not exist
    if not cache_path.exists():
        import urllib.request
        url = "https://huggingface.co/datasets/hotpot_qa/resolve/main/distractor/validation-00000-of-00001.parquet"
        print(f"fetching validation split from huggingface: {url}")
        urllib.request.urlretrieve(url, cache_path)

    import pandas as pd
    df = pd.read_parquet(cache_path)
    records = df.head(num_questions).to_dict(orient="records")
    return records


def process_and_pool_corpus(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[EvidenceSpan]]:
    """extracts evaluation questions and pools all context paragraphs into unique evidence spans"""
    eval_questions = []
    pooled_docs: dict[str, str] = {}

    for row in records:
        q_item = {
            "id": row["id"],
            "question": row["question"],
            "answer": row["answer"],
            "type": row.get("type", "bridge"),
            "level": row.get("level", "medium"),
            "supporting_facts": [
                {"title": str(t), "sent_id": int(s)} 
                for t, s in zip(row["supporting_facts"]["title"], row["supporting_facts"]["sent_id"])
            ]
        }
        eval_questions.append(q_item)

        # pool context paragraphs
        context_titles = row["context"]["title"]
        context_sentences = row["context"]["sentences"]
        for title, sents in zip(context_titles, context_sentences):
            if title not in pooled_docs:
                full_text = " ".join([s.strip() for s in sents if s.strip()])
                pooled_docs[title] = full_text

    print(f"extracted {len(eval_questions)} evaluation queries")
    print(f"pooled {len(pooled_docs)} unique articles across query contexts")

    # segment pooled documents into sentence spans
    all_spans: list[EvidenceSpan] = []
    for title, text in pooled_docs.items():
        spans = segment_document_into_spans(article_title=title, text=text)
        all_spans.extend(spans)

    print(f"generated {len(all_spans)} total premise spans")
    return eval_questions, all_spans


def run_ingestion() -> None:
    records = fetch_hotpotqa_dev_split(num_questions=200)
    eval_questions, spans = process_and_pool_corpus(records)

    eval_out = settings.data_dir / "hotpotqa_eval_200.json"
    with open(eval_out, "w", encoding="utf-8") as f:
        json.dump(eval_questions, f, indent=2)
    print(f"saved evaluation questions to {eval_out}")

    spans_out = settings.data_dir / "pooled_corpus_spans.jsonl"
    with open(spans_out, "w", encoding="utf-8") as f:
        for span in spans:
            f.write(span.model_dump_json() + "\n")
    print(f"saved pooled evidence spans to {spans_out}")


if __name__ == "__main__":
    run_ingestion()
```
**Line-by-Line Explanation:**
- `fetch_hotpotqa_dev_split()`: Checks if `hotpot_val.parquet` is already downloaded. If not, fetches it directly from Hugging Face via `urllib.request`.
- `process_and_pool_corpus()`:
  - Iterates over each question record.
  - Fixes the `TypeError: Object of type int32 is not JSON serializable` by explicitly casting `sent_id: int(s)`.
  - Aggregates all paragraph contexts across all 200 questions into `pooled_docs[title]`, eliminating duplicates.
  - Calls `segment_document_into_spans()` on each unique article.
- `run_ingestion()`: Serializes `hotpotqa_eval_200.json` (tracked in Git) and `pooled_corpus_spans.jsonl` (local dataset cache).

---

# 7. Test Suite, Verification Logs, and Data Artifacts

### Test Suite 1: `tests/test_schema.py`
```python
from warrant.core.schema import WarrantState, EvidenceSpan, AtomicClaim, HopRecord, PolicyState


def test_evidence_span_formatting():
    span = EvidenceSpan(
        span_id="span_inception_01",
        article_title="Inception",
        sentence_idx=0,
        text="Inception is a 2010 science fiction action film written and directed by Christopher Nolan."
    )
    expected = "[Title: Inception] Inception is a 2010 science fiction action film written and directed by Christopher Nolan."
    assert span.formatted_premise == expected


def test_warrant_state_timeline_accumulation():
    state = WarrantState(query="Who directed Inception and where was he born?")
    
    hop1 = HopRecord(
        hop_idx=0,
        sub_query="Who directed Inception?",
        retrieved_span_ids=["span_inception_01"],
        latency_ms=12.4
    )
    state.add_hop(hop1)
    
    hop2 = HopRecord(
        hop_idx=1,
        sub_query="Where was Christopher Nolan born?",
        retrieved_span_ids=["span_nolan_03"],
        latency_ms=15.1
    )
    state.add_hop(hop2)
    
    assert len(state.hops) == 2
    assert state.hops[0].sub_query == "Who directed Inception?"
    assert state.hops[1].retrieved_span_ids == ["span_nolan_03"]


def test_atomic_claim_validaton():
    claim = AtomicClaim(
        claim_id="c1",
        text="Christopher Nolan directed Inception.",
        cited_span_ids=["span_inception_01"],
        guard_pass=True,
        nli_entailment_score=0.96,
        is_verified=True
    )
    assert claim.is_verified is True
    assert claim.guard_pass is True
```

### Test Suite 2: `tests/test_span_segmenter.py`
```python
from warrant.data.span_segmenter import split_sentences_robust, segment_document_into_spans


def test_split_sentences_robust_abbreviations():
    raw_text = "Dr. Nolan moved to the U.S. in 2001. He directed Inception in 2010! It won 4 Oscars."
    sentences = split_sentences_robust(raw_text)
    assert len(sentences) == 3
    assert sentences[0] == "Dr. Nolan moved to the U.S. in 2001."
    assert sentences[1] == "He directed Inception in 2010!"
    assert sentences[2] == "It won 4 Oscars."


def test_segment_document_into_spans_ids():
    title = "Christopher Nolan"
    body = "Christopher Nolan is a British-American filmmaker. Known for his Hollywood blockbusters, his films have grossed over $6 billion."
    spans = segment_document_into_spans(title, body)
    
    assert len(spans) == 2
    assert spans[0].span_id == "span_christopher_nolan_000"
    assert spans[1].span_id == "span_christopher_nolan_001"
    assert spans[0].article_title == "Christopher Nolan"
    assert "[Title: Christopher Nolan]" in spans[0].formatted_premise
```

### Verification Execution Log (`uv run pytest -v tests/`)
```
============================= test session starts ==============================
platform linux -- Python 3.11.9, pytest-9.1.1, pluggy-1.6.0
rootdir: /home/hamza/AI-Learning/warrant
configfile: pyproject.toml
plugins: anyio-4.15.1, langsmith-0.13.0, asyncio-1.4.0

tests/test_schema.py::test_evidence_span_formatting PASSED               [ 20%]
tests/test_schema.py::test_warrant_state_timeline_accumulation PASSED    [ 40%]
tests/test_schema.py::test_atomic_claim_validaton PASSED                 [ 60%]
tests/test_span_segmenter.py::test_split_sentences_robust_abbreviations PASSED [ 80%]
tests/test_span_segmenter.py::test_segment_document_into_spans_ids PASSED [100%]

============================== 5 passed in 0.02s ===============================
```

### Generated Data Artifacts on Local Disk
- `data/hotpotqa_eval_200.json`: 91 KB (Tracked in Git). Contains 200 evaluation items with question, answer, type, level, and supporting facts.
- `data/pooled_corpus_spans.jsonl`: 3.7 MB (Local dataset cache). Contains **8,535 sentence spans** extracted from **1,991 unique Wikipedia articles**.

---

# 8. Academic & Course Mappings

Open and inspect these files on your local machine to see how Warrant's code directly implements the curriculum:

### 1. Hands-On Machine Learning (HOML 3rd Ed. with PyTorch)
* **Location:** `/home/hamza/AI-Learning/Books/HOML/homl_chapters/`
* **File 1:** [appendix_A_ml_project_checklist.pdf](file:///home/hamza/AI-Learning/Books/HOML/homl_chapters/appendix_A_ml_project_checklist.pdf)
  - *The 8-Step ML Checklist:*
    1. **Frame the problem and look at the big picture.** $\rightarrow$ *Executed in Warrant Phase 1 (Attribution contract, 3-state policy).*
    2. **Get the data.** $\rightarrow$ *Executed in Warrant Phase 1 (`ingest_hotpotqa.py`).*
    3. **Explore the data to gain insights.** $\rightarrow$ *Executed in Warrant Phase 1 (Sentence lengths, distractor pooling).*
    4. **Prepare the data.** $\rightarrow$ *Executed in Warrant Phase 1 & 2 (Span segmentation, Qdrant indexing).*
    5. **Explore models.** $\rightarrow$ *Phase 3 & 4 (Qwen2.5-7B, DeBERTa-v3).*
    6. **Fine-tune models.** $\rightarrow$ *Phase 4 (Temperature scaling $\tau$).*
    7. **Present solution.** $\rightarrow$ *Phase 6 & 7 (Next.js UI & Verifier Bake-off).*
    8. **Launch & monitor.** $\rightarrow$ *Phase 8 (Cloud deployment & live CV link).*
* **File 2:** [02_end_to_end_machine_learning_project.pdf](file:///home/hamza/AI-Learning/Books/HOML/homl_chapters/02_end_to_end_machine_learning_project.pdf)
  - Read pages 49–54: *"Create a Test Set and Keep It Aside"*. Explains why isolating `data/hotpotqa_eval_200.json` first prevents data snooping.

### 2. Complete Agentic AI Bootcamp (Section 12: LangGraph Components)
* **Location:** `/home/hamza/Courses/Complete_Agentic_AI_Bootcamp/12 - LangGraph Components/`
* **Notebook 1:** [1. 3-DataclassStateSchema.ipynb](file:///home/hamza/Courses/Complete_Agentic_AI_Bootcamp/12%20-%20LangGraph%20Components/1.%203-DataclassStateSchema.ipynb)
  - Demonstrates creating basic dataclasses for state schemas.
* **Notebook 2:** [2. 4-pydantic.ipynb](file:///home/hamza/Courses/Complete_Agentic_AI_Bootcamp/12%20-%20LangGraph%20Components/2.%204-pydantic.ipynb)
  - Demonstrates defining Pydantic models for LangGraph state validation. Warrant uses this exact pattern to create `WarrantState` in `warrant/core/schema.py`.

### 3. Complete Data Science ML DL NLP Bootcamp 2025
* **Section 11 (OOP Concepts):** Class methods, property decorators, and encapsulation. Applied in `EvidenceSpan.formatted_premise`.
* **Section 15 (Logging):** Execution latency tracking. Applied in `HopRecord.latency_ms` and `WarrantState.total_latency_ms`.
* **Section 51 (NLP for Machine Learning):** Sentence boundary regexes and abbreviation protection. Applied in `warrant/data/span_segmenter.py`.

---

# 9. Tutor Protocol: 10 Comprehensive Interview Questions & Answer Keys

> **Instructions for Another AI / Evaluator:**  
> Copy and paste this prompt to another AI to test Hamza:  
> *"You are an expert Principal AI/ML Systems Engineer interviewing Hamza for a Senior Applied AI role at a Canadian AI startup. Use the 10 questions and grading rubrics below to test his understanding of Phase 1 of Warrant. Ask him questions one by one, critique his answers rigorously, and certify his score."*

### Question 1: Citation Decoration Mechanics
* **Question:** What is "citation decoration" in enterprise RAG systems, and why do commercial APIs (Claude, OpenAI) fail on 25% to 40% of native citations?
* **Answer Key:** LLMs append inline citations (e.g. `[Doc 1]`) at the sentence or paragraph level, but parts of the generated assertion are ungrounded or contradicted by the cited text. The model hallucinates entities, dates, or numbers while citing a relevant-looking background document.

### Question 2: Multi-Hop Bridge vs. Comparison
* **Question:** What is the structural difference between a HotpotQA "bridge" question and a "comparison" question?
* **Answer Key:** A bridge question requires hopping from Entity A to discover Entity B, then retrieving Entity B to find the target fact. A comparison question retrieves two disjoint entities (A and B) independently and compares their shared attributes (e.g. nationality, birth year).

### Question 3: The Toy Benchmark Trap
* **Question:** Why is evaluating retrieval on only the 10 paragraphs provided with each HotpotQA question considered a "toy benchmark"? How did Warrant fix this?
* **Answer Key:** In a 10-paragraph pool, finding 2 gold documents is trivial (95%+ recall with simple BM25). Warrant pooled all paragraphs across 200 questions into a shared collection of 1,991 articles (8,535 spans), creating a realistic needle-in-a-haystack search.

### Question 4: Attention Dilution in Cross-Encoders
* **Question:** Mathematically and semantically, why does passing a 500-word document chunk into `DeBERTa-v3` degrade verification accuracy compared to a 20-word sentence span?
* **Answer Key:** Transformer self-attention computes $O(N^2)$ pairwise token relationships. When 95% of tokens in the premise are irrelevant background text, attention weights are diluted across uninformative tokens, flattening cross-entropy loss and degrading calibration.

### Question 5: Pronoun Amnesia & Title Prefixing
* **Question:** If an extracted Wikipedia sentence is *"He directed Inception in 2010"*, why will an NLI model reject it, and how does Warrant solve this?
* **Answer Key:** The NLI model rejects it because "He" has no referent in isolation. Warrant's `EvidenceSpan.formatted_premise` prepends `[Title: Christopher Nolan]` to the sentence, binding the pronoun to the article entity without slow coreference resolution.

### Question 6: Abbreviation Over-Splitting
* **Question:** How does `warrant/data/span_segmenter.py` prevent regex sentence splitters from shattering sentences like *"Dr. Nolan moved to the U.S. in 2001"*?
* **Answer Key:** It performs token replacement on known abbreviations (`Dr.`, `U.S.`, `Prof.`) using temporary placeholders (`__ABBR_0__`) before running regex splitting on terminal punctuation, then restores the original abbreviations.

### Question 7: Pydantic v2 vs. Python Dictionaries
* **Question:** Why is passing raw Python dictionaries between agent nodes an anti-pattern in production LangGraph architectures?
* **Answer Key:** Dictionaries have zero runtime type safety, allow silent key typos (`state["retreived_docs"]`), and lack boundary parsing. Pydantic models validate types at the boundary, enforce schemas, and serialize via compiled Rust (`pydantic-core`).

### Question 8: The Flight Recorder Pattern
* **Question:** What happens during a cyclic retry if your state naively overwrites `state["docs"] = new_docs`? How does `hops: list[HopRecord]` solve this?
* **Answer Key:** Overwriting state erases evidence from earlier hops (search amnesia), blinding the agent to what it already attempted and causing infinite retry loops. `hops: list[HopRecord]` is an append-only timeline that preserves full history, tracks latency, and allows cycle detection.

### Question 9: The 3-State Output Policy
* **Question:** What are the three states in Warrant's output policy, and what action does the system take in `PARTIAL_PASS`?
* **Answer Key:** `FULL_PASS` (100% verified claims), `PARTIAL_PASS` (prunes unsupported claims, emits verified subset, logs dropped claims), and `ABSTAIN` (structured diagnostic refusal when critical evidence is missing or conflicting).

### Question 10: The Numpy JSON Serialization Bug
* **Question:** During data ingestion, what caused `TypeError: Object of type int32 is not JSON serializable`, and how was it resolved?
* **Answer Key:** PyArrow and Pandas read HotpotQA supporting fact indices as numpy `int32` types, which Python's standard `json.dump()` cannot serialize. The fix explicitly casts `sent_id: int(s)`.
