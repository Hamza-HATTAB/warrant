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
