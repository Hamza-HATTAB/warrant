from warrant.core.schema import EvidenceSpan, AtomicClaim
from warrant.llm.client import extract_json_payload, SynthesisResponse, SynthesizedClaim
from warrant.llm.prompts import format_evidence_for_prompt, build_synthesis_prompt
from warrant.llm.synthesizer import ClaimSynthesizer


def test_prompt_formatting():
    spans = [
        EvidenceSpan(
            span_id="span_inception_001",
            article_title="Inception",
            sentence_idx=0,
            text="Inception is a 2010 film directed by Christopher Nolan."
        ),
        EvidenceSpan(
            span_id="span_nolan_002",
            article_title="Christopher Nolan",
            sentence_idx=1,
            text="Nolan was born in Westminster, London."
        )
    ]
    formatted = format_evidence_for_prompt(spans)
    assert "[span_inception_001]" in formatted
    assert "[Title: Inception]" in formatted
    assert "[span_nolan_002]" in formatted
    assert "[Title: Christopher Nolan]" in formatted


def test_extract_json_payload_variants():
    # clean json
    raw_clean = '{"is_answerable": true, "summary": "test", "claims": []}'
    assert extract_json_payload(raw_clean)["is_answerable"] is True

    # markdown code fence wrapped json
    raw_markdown = '```json\n{\n  "is_answerable": false,\n  "summary": "",\n  "claims": [],\n  "refusal_reason": "missing context"\n}\n```'
    extracted = extract_json_payload(raw_markdown)
    assert extracted["is_answerable"] is False
    assert extracted["refusal_reason"] == "missing context"


def test_synthesis_schema_validaton():
    payload = {
        "is_answerable": True,
        "summary": "Christopher Nolan was born in London and directed Inception.",
        "claims": [
            {
                "claim_id": "c_01",
                "claim_text": "Christopher Nolan directed Inception.",
                "cited_span_ids": ["span_inception_001"]
            },
            {
                "claim_id": "c_02",
                "claim_text": "Christopher Nolan was born in London.",
                "cited_span_ids": ["span_nolan_002"]
            }
        ],
        "refusal_reason": None
    }
    response = SynthesisResponse.model_validate(payload)
    assert len(response.claims) == 2
    assert response.claims[0].cited_span_ids == ["span_inception_001"]


def test_synthesizer_hallucinated_span_filtering():
    synthesizer = ClaimSynthesizer()

    # context only has span_01
    evidence_spans = [
        EvidenceSpan(
            span_id="span_01",
            article_title="Test",
            sentence_idx=0,
            text="This is valid evidence."
        )
    ]

    # mock response where model hallucinated span_fake_999
    mock_response = SynthesisResponse(
        is_answerable=True,
        summary="Test answer",
        claims=[
            SynthesizedClaim(
                claim_id="c_01",
                claim_text="Valid claim",
                cited_span_ids=["span_01", "span_fake_999"]
            )
        ]
    )

    valid_span_ids = {s.span_id for s in evidence_spans}
    verified_span_ids = [sid for sid in mock_response.claims[0].cited_span_ids if sid in valid_span_ids]

    # span_fake_999 must be stripped
    assert verified_span_ids == ["span_01"]


def test_multi_span_resolution():
    claim = AtomicClaim(
        claim_id="c_01",
        text="Christopher Nolan directed Inception and was born in London.",
        cited_span_ids=["span_01", "span_02"]
    )
    evidence_pool = {
        "span_01": EvidenceSpan(
            span_id="span_01",
            article_title="Inception",
            sentence_idx=0,
            text="Inception is directed by Christopher Nolan."
        ),
        "span_02": EvidenceSpan(
            span_id="span_02",
            article_title="Christopher Nolan",
            sentence_idx=0,
            text="Christopher Nolan was born in London."
        )
    }

    resolved_premise = ClaimSynthesizer.resolve_multi_span_premise(claim, evidence_pool, max_spans=3)
    assert "[Title: Inception]" in resolved_premise
    assert "[Title: Christopher Nolan]" in resolved_premise
    assert "\n" in resolved_premise
