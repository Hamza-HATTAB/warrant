import json
from typing import Any
from warrant.core.schema import EvidenceSpan

SYSTEM_SYNTHESIS_PROMPT = """You are a rigorous scientific research agent enforcing an explicit attribution contract.
Your task is to answer the user's multi-hop query using ONLY the provided evidence spans.

CRITICAL INVARIANTS:
1. ATOMIC CLAIMS: You must decompose your answer into discrete, atomic claims. Each claim must express exactly ONE factual proposition.
2. EXPLICIT CITATIONS: Each atomic claim MUST cite 1 to 3 span IDs (e.g. ["span_nolan_000"]) from the provided evidence that directly entail the claim.
3. NO CITATION DECORATION: Do not cite a span unless it directly proves the specific claim.
4. UNANSWERABLE CONTRACT: If the provided evidence is contradictory, insufficient, or fails to connect the multi-hop bridge, set "is_answerable" to false and explain why in "refusal_reason".
5. OUTPUT FORMAT: Output strictly valid JSON conforming to the requested schema. No conversational filler or markdown outside the JSON block.
"""

USER_SYNTHESIS_TEMPLATE = """QUERY: {query}

EVIDENCE SPANS:
{formatted_spans}

Respond with a JSON object following this exact schema:
{{
  "is_answerable": true,
  "summary": "Cohesive multi-hop answer summarizing the verified facts.",
  "claims": [
    {{
      "claim_id": "c_001",
      "claim_text": "Single atomic factual statement.",
      "cited_span_ids": ["span_id_1", "span_id_2"]
    }}
  ],
  "refusal_reason": null
}}
"""


def format_evidence_for_prompt(spans: list[EvidenceSpan]) -> str:
    """formats evidence spans with explicit span identifiers for prompt context"""
    if not spans:
        return "No evidence spans provided."

    formatted_lines = []
    for span in spans:
        line = f"[{span.span_id}] {span.formatted_premise}"
        formatted_lines.append(line)

    return "\n".join(formatted_lines)


def build_synthesis_prompt(query: str, spans: list[EvidenceSpan]) -> tuple[str, str]:
    """constructs system and user prompt for structured claim syntheis"""
    formatted_spans = format_evidence_for_prompt(spans)
    user_prompt = USER_SYNTHESIS_TEMPLATE.format(
        query=query.strip(),
        formatted_spans=formatted_spans,
    )
    return SYSTEM_SYNTHESIS_PROMPT, user_prompt
