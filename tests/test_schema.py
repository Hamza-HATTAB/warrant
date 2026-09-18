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
    # test that hops are tracked as an append only timeline for auditing
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
