from unittest.mock import MagicMock
import numpy as np
import pytest

from warrant.core.schema import AtomicClaim, EvidenceSpan
from warrant.verifier.calibrator import TemperatureCalibrator
from warrant.verifier.deberta_nli import DeBERTaVerifier, NLIResult
from warrant.verifier.entity_guard import DeterministicGuard
from warrant.verifier.hybrid_verifier import HybridVerifier


# test suit for deterministic guard and calibrated nli verification

@pytest.fixture
def sample_evidence_pool() -> dict[str, EvidenceSpan]:
    span1 = EvidenceSpan(
        span_id="art_mag_0",
        article_title="Arthur's Magazine",
        sentence_idx=0,
        text="Arthur's Magazine was an American literary magazine published in Philadelphia in 1844.",
    )
    span2 = EvidenceSpan(
        span_id="art_mag_1",
        article_title="Arthur's Magazine",
        sentence_idx=1,
        text="It was founded by Timothy Shay Arthur, who edited the monthly periodical.",
    )
    span3 = EvidenceSpan(
        span_id="radio_city_0",
        article_title="Radio City Music Hall",
        sentence_idx=0,
        text="Radio City Music Hall is an entertainment venue in Rockefeller Center in New York City.",
    )
    return {
        span1.span_id: span1,
        span2.span_id: span2,
        span3.span_id: span3,
    }


def test_deterministic_guard_numerical_attribution(sample_evidence_pool):
    guard = DeterministicGuard()

    # grounded year (1844)
    claim_grounded = AtomicClaim(
        claim_id="c1",
        text="Arthur's Magazine was first published in 1844.",
        cited_span_ids=["art_mag_0"],
    )
    res_grounded = guard.verify(claim_grounded, sample_evidence_pool)
    assert res_grounded.passed is True
    assert "1844" in res_grounded.extracted_numbers
    assert len(res_grounded.unmatched_items) == 0

    # ungrounded year (1995)
    claim_hallucinated = AtomicClaim(
        claim_id="c2",
        text="Arthur's Magazine was first published in 1995.",
        cited_span_ids=["art_mag_0"],
    )
    res_hallucinated = guard.verify(claim_hallucinated, sample_evidence_pool)
    assert res_hallucinated.passed is False
    assert any("1995" in item for item in res_hallucinated.unmatched_items)
    assert "guard failure" in res_hallucinated.failure_reason.lower()


def test_deterministic_guard_entity_grounding(sample_evidence_pool):
    guard = DeterministicGuard()

    # grounded named entities (Philadelphia, Timothy Shay Arthur)
    claim_grounded = AtomicClaim(
        claim_id="c1",
        text="Timothy Shay Arthur founded a magazine in Philadelphia.",
        cited_span_ids=["art_mag_0", "art_mag_1"],
    )
    res_grounded = guard.verify(claim_grounded, sample_evidence_pool)
    assert res_grounded.passed is True
    assert len(res_grounded.unmatched_items) == 0

    # ungrounded entity (Tokyo, Elon Musk)
    claim_hallucinated = AtomicClaim(
        claim_id="c2",
        text="Timothy Shay Arthur founded a magazine in Tokyo.",
        cited_span_ids=["art_mag_0", "art_mag_1"],
    )
    res_hallucinated = guard.verify(claim_hallucinated, sample_evidence_pool)
    assert res_hallucinated.passed is False
    assert any("tokyo" in item.lower() for item in res_hallucinated.unmatched_items)


def test_deterministic_guard_zero_or_invalid_cited_spans(sample_evidence_pool):
    guard = DeterministicGuard()
    claim_no_spans = AtomicClaim(
        claim_id="c_empty",
        text="Arthur's Magazine was published in Philadelphia.",
        cited_span_ids=["non_existent_span_99"],
    )
    res = guard.verify(claim_no_spans, sample_evidence_pool)
    assert res.passed is False
    assert "zero valid spans" in res.failure_reason.lower()


def test_temperature_calibrator_ece_and_nll_minimization():
    calibrator = TemperatureCalibrator(temperature=1.0)

    # synthetic logits and ground truth
    np.random.seed(1337)
    n_samples = 300
    y_true = np.random.choice([0, 1, 2], size=n_samples)

    logits = np.random.randn(n_samples, 3) * 1.5
    for i in range(n_samples):
        logits[i, y_true[i]] += 2.5

    # check uncalibrated metrics
    uncal_metrics = calibrator.evaluate(logits, y_true)
    assert uncal_metrics.ece >= 0.0
    assert uncal_metrics.nll >= 0.0

    # optimize temperature
    cal_metrics = calibrator.fit(logits, y_true)
    assert calibrator.temperature > 0.0
    assert cal_metrics.nll <= uncal_metrics.nll
    assert cal_metrics.optimal_temperature == calibrator.temperature


def test_temperature_calibrator_scaling_properties():
    cal_sharp = TemperatureCalibrator(temperature=0.5)
    cal_soft = TemperatureCalibrator(temperature=2.0)

    logits = np.array([[2.0, 1.0, 0.0]])
    p_sharp = cal_sharp.predict_proba(logits)[0]
    p_soft = cal_soft.predict_proba(logits)[0]

    # lower temperature sharpens probability around argmax
    assert p_sharp[0] > p_soft[0]
    # higher temperature softens distribution towards uniform
    assert p_soft[2] > p_sharp[2]
    # argmax preserved
    assert np.argmax(p_sharp) == np.argmax(p_soft) == 0


def test_deberta_nli_inference_directionality():
    # test real deberta-v3 cross-encoder
    verifier = DeBERTaVerifier(device="cpu")
    premise = "[Title: Arthur's Magazine] Arthur's Magazine was an American literary magazine published in Philadelphia."

    # clear entailment
    res_entail = verifier.verify(
        premise=premise,
        hypothesis="Arthur's Magazine was published in Philadelphia.",
    )
    assert res_entail.predicted_label == "entailment"
    assert res_entail.entailment_score > 0.80

    # clear contradiction
    res_contra = verifier.verify(
        premise=premise,
        hypothesis="Arthur's Magazine was never published in Philadelphia.",
    )
    assert res_contra.predicted_label == "contradiction"
    assert res_contra.contradiction_score > 0.70


def test_hybrid_verifier_short_circuit_on_guard_failure(sample_evidence_pool):
    # mock nli to verify it is NEVER called when guard fails
    mock_nli = MagicMock(spec=DeBERTaVerifier)
    hybrid = HybridVerifier(nli_verifier=mock_nli, verification_threshold=0.82)

    claim_bad = AtomicClaim(
        claim_id="c_hallucinated",
        text="Arthur's Magazine was published in 2024 in London.",
        cited_span_ids=["art_mag_0"],
    )

    verified_claim = hybrid.verify_claim(claim_bad, sample_evidence_pool)

    # deterministic guard must reject
    assert verified_claim.guard_pass is False
    assert verified_claim.is_verified is False
    assert verified_claim.nli_entailment_score == 0.0
    assert "guard failure" in verified_claim.rejection_reason.lower()

    # verify mock NLI was bypassed
    mock_nli.verify.assert_not_called()


def test_hybrid_verifier_decision_thresholds(sample_evidence_pool):
    mock_nli = MagicMock(spec=DeBERTaVerifier)
    hybrid = HybridVerifier(nli_verifier=mock_nli, verification_threshold=0.82)

    claim = AtomicClaim(
        claim_id="c_pass",
        text="Arthur's Magazine was published in Philadelphia.",
        cited_span_ids=["art_mag_0"],
    )

    # scenario 1: high entailment (>= 0.82) -> PASS
    mock_nli.verify.return_value = NLIResult(
        entailment_score=0.91,
        neutral_score=0.06,
        contradiction_score=0.03,
        predicted_label="entailment",
    )
    res_pass = hybrid.verify_claim(claim.model_copy(deep=True), sample_evidence_pool)
    assert res_pass.is_verified is True
    assert res_pass.rejection_reason is None

    # scenario 2: low entailment (< 0.82) -> REJECT
    mock_nli.verify.return_value = NLIResult(
        entailment_score=0.74,
        neutral_score=0.20,
        contradiction_score=0.06,
        predicted_label="neutral",
    )
    res_low = hybrid.verify_claim(claim.model_copy(deep=True), sample_evidence_pool)
    assert res_low.is_verified is False
    assert "below threshold" in res_low.rejection_reason.lower()

    # scenario 3: direct contradiction (> 0.5) -> REJECT
    mock_nli.verify.return_value = NLIResult(
        entailment_score=0.05,
        neutral_score=0.10,
        contradiction_score=0.85,
        predicted_label="contradiction",
    )
    res_contra = hybrid.verify_claim(claim.model_copy(deep=True), sample_evidence_pool)
    assert res_contra.is_verified is False
    assert "contradiction detected" in res_contra.rejection_reason.lower()


def test_hybrid_verifier_batched_execution(sample_evidence_pool):
    hybrid = HybridVerifier(verification_threshold=0.82)

    c1 = AtomicClaim(
        claim_id="c1",
        text="Arthur's Magazine was founded by Timothy Shay Arthur.",
        cited_span_ids=["art_mag_1"],
    )
    c2 = AtomicClaim(
        claim_id="c2",
        text="Arthur's Magazine was founded by Leonardo DiCaprio in 2020.",
        cited_span_ids=["art_mag_1"],
    )
    c3 = AtomicClaim(
        claim_id="c3",
        text="Radio City Music Hall is located in New York City.",
        cited_span_ids=["radio_city_0"],
    )

    claims = [c1, c2, c3]
    verified_claims = hybrid.verify_claims(claims, sample_evidence_pool)

    assert len(verified_claims) == 3
    # c1: valid grounded entailment
    assert verified_claims[0].guard_pass is True
    assert verified_claims[0].is_verified is True

    # c2: ungrounded entity and number -> rejected in guard
    assert verified_claims[1].guard_pass is False
    assert verified_claims[1].is_verified is False

    # c3: valid grounded entailment
    assert verified_claims[2].guard_pass is True
    assert verified_claims[2].is_verified is True
