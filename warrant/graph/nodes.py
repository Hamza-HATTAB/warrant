import time
from typing import Any, Optional

from warrant.core.config import settings
from warrant.core.schema import EvidenceSpan, HopRecord, PolicyState
from warrant.graph.state import GraphState
from warrant.llm.synthesizer import ClaimSynthesizer
from warrant.retrieval.flashrank_cpu import FlashRankCPUReranker
from warrant.retrieval.hybrid_qdrant import HybridQdrantRetriever
from warrant.verifier.hybrid_verifier import HybridVerifier

# execution nodes for multi-hop agent retreival and policy routing


class GraphNodeHandler:
    """coordinates node operations for retrieval, synthesis, verification, and policy routing"""

    def __init__(
        self,
        retriever: Optional[HybridQdrantRetriever] = None,
        reranker: Optional[FlashRankCPUReranker] = None,
        synthesizer: Optional[ClaimSynthesizer] = None,
        verifier: Optional[HybridVerifier] = None,
        max_hops: Optional[int] = None,
        verification_threshold: Optional[float] = None,
    ):
        self._retriever = retriever
        self._reranker = reranker
        self._synthesizer = synthesizer
        self._verifier = verifier
        self.max_hops = max_hops if max_hops is not None else getattr(settings, "max_hops", 2)
        self.verification_threshold = (
            verification_threshold
            if verification_threshold is not None
            else getattr(settings, "verification_threshold", 0.82)
        )

    @property
    def retriever(self) -> HybridQdrantRetriever:
        if self._retriever is None:
            self._retriever = HybridQdrantRetriever()
        return self._retriever

    @property
    def reranker(self) -> FlashRankCPUReranker:
        if self._reranker is None:
            self._reranker = FlashRankCPUReranker()
        return self._reranker

    @property
    def synthesizer(self) -> ClaimSynthesizer:
        if self._synthesizer is None:
            self._synthesizer = ClaimSynthesizer()
        return self._synthesizer

    @property
    def verifier(self) -> HybridVerifier:
        if self._verifier is None:
            self._verifier = HybridVerifier(verification_threshold=self.verification_threshold)
        return self._verifier

    def retrieve_hop_node(self, state: GraphState) -> dict[str, Any]:
        """executes dense and sparse hybrid retrieval followed by cpu reranking"""
        start_time = time.perf_counter()
        current_hop = state.get("current_hop", 0)

        # resolve sub-query: use targeted query on retries, primary query on hop 0
        search_query = state.get("next_sub_query") or state["query"]

        retrieval_top_k = getattr(settings, "retrieval_top_k", 10)
        rerank_top_k = getattr(settings, "rerank_top_k", 4)

        if hasattr(self.retriever, "search_hybrid_rrf"):
            raw_candidates = self.retriever.search_hybrid_rrf(
                query=search_query,
                limit=retrieval_top_k,
            )
        elif hasattr(self.retriever, "hybrid_search"):
            raw_candidates = self.retriever.hybrid_search(
                query=search_query,
                limit=retrieval_top_k,
            )
        else:
            raw_candidates = []

        rerank_res = self.reranker.rerank(
            query=search_query,
            candidates=raw_candidates,
            top_k=rerank_top_k,
        )
        # handle tuple return (reranked_output, latency_ms) or plain list
        reranked_items = rerank_res[0] if isinstance(rerank_res, tuple) else rerank_res

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        # update evidence pool with newly discovered spans
        evidence_pool = dict(state.get("evidence_pool", {}))
        newly_retrieved_ids = []
        for item in reranked_items:
            if isinstance(item, EvidenceSpan):
                span = item
            elif isinstance(item, dict):
                span = EvidenceSpan(
                    span_id=item["span_id"],
                    article_title=item.get("article_title", "Unknown"),
                    section_title=item.get("section_title", "Lead"),
                    sentence_idx=int(item.get("sentence_idx", 0)),
                    text=item.get("text", ""),
                )
            else:
                continue

            newly_retrieved_ids.append(span.span_id)
            if span.span_id not in evidence_pool:
                evidence_pool[span.span_id] = span
                evidence_pool[span.span_id] = span

        hop_record = HopRecord(
            hop_idx=current_hop,
            sub_query=search_query,
            retrieved_span_ids=newly_retrieved_ids,
            latency_ms=latency_ms,
        )

        hops = list(state.get("hops", []))
        hops.append(hop_record)

        return {
            "hops": hops,
            "evidence_pool": evidence_pool,
            "current_hop": current_hop + 1,
            "total_latency_ms": state.get("total_latency_ms", 0.0) + latency_ms,
            "next_sub_query": None,  # clear consumed sub-query
        }

    async def synthesize_claims_node(self, state: GraphState) -> dict[str, Any]:
        """synthesizes atomic claims constrained to current evidence pool"""
        start_time = time.perf_counter()
        evidence_pool = state.get("evidence_pool", {})

        # invoke gemma 3 with json grammar constraints
        claims = await self.synthesizer.synthesize(
            query=state["query"],
            evidence_pool=evidence_pool,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return {
            "claims": claims,
            "total_latency_ms": state.get("total_latency_ms", 0.0) + latency_ms,
        }

    def verify_claims_node(self, state: GraphState) -> dict[str, Any]:
        """evaluates candidate claims through deterministic guard and calibrated nli"""
        start_time = time.perf_counter()
        claims = state.get("claims", [])
        evidence_pool = state.get("evidence_pool", {})

        verified_claims = self.verifier.verify_claims(
            claims=claims,
            evidence_pool=evidence_pool,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return {
            "claims": verified_claims,
            "total_latency_ms": state.get("total_latency_ms", 0.0) + latency_ms,
        }

    def evaluate_policy_node(self, state: GraphState) -> dict[str, Any]:
        """applies 3-state abstention contract and determines retry routing"""
        claims = state.get("claims", [])
        current_hop = state.get("current_hop", 0)
        retry_count = state.get("retry_count", 0)
        dropped_claims = list(state.get("dropped_claims", []))

        verified = [c for c in claims if c.is_verified]
        unverified = [c for c in claims if not c.is_verified]
        total = len(claims)

        # case 1: 100% of candidate claims are verified
        if total > 0 and len(verified) == total:
            return {
                "policy": PolicyState.FULL_PASS,
                "claims": verified,
                "dropped_claims": dropped_claims,
                "next_sub_query": None,
            }

        # case 2: partial verification (some verified, some ungrounded)
        if len(verified) > 0 and len(unverified) > 0:
            if current_hop < self.max_hops:
                # generate targeted bridge sub-query from unverified claim entities
                bridge_entities = []
                for c in unverified:
                    bridge_entities.extend(c.extracted_entities or c.extracted_numbers)
                sub_query = (
                    f"{state['query']} {' '.join(bridge_entities[:3])}"
                    if bridge_entities
                    else state["query"]
                )
                return {
                    "policy": PolicyState.PARTIAL_PASS,
                    "retry_count": retry_count + 1,
                    "next_sub_query": sub_query,
                }
            else:
                # max hops exhausted: drop unverified claims, proceed with verified claims
                dropped_claims.extend(unverified)
                return {
                    "policy": PolicyState.PARTIAL_PASS,
                    "claims": verified,
                    "dropped_claims": dropped_claims,
                    "next_sub_query": None,
                }

        # case 3: zero claims verified
        if current_hop < self.max_hops:
            # reformulate query to find alternative evidence
            sub_query = state["query"]
            return {
                "policy": PolicyState.ABSTAIN,
                "retry_count": retry_count + 1,
                "next_sub_query": sub_query,
            }

        # max hops exhausted with zero verified claims: enforce strict abstention
        dropped_claims.extend(unverified)
        return {
            "policy": PolicyState.ABSTAIN,
            "claims": [],
            "dropped_claims": dropped_claims,
            "next_sub_query": None,
        }

    def route_policy(self, state: GraphState) -> str:
        """conditional edge router directing workflow to retry, answer, or abstention"""
        policy = state.get("policy", PolicyState.ABSTAIN)
        next_sub_query = state.get("next_sub_query")
        current_hop = state.get("current_hop", 0)

        # if retry requested and hop budget permits
        if next_sub_query is not None and current_hop < self.max_hops:
            return "retry"

        if policy == PolicyState.FULL_PASS:
            return "full_pass"
        elif policy == PolicyState.PARTIAL_PASS:
            return "partial_pass"
        else:
            return "abstain"

    def assemble_answer_node(self, state: GraphState) -> dict[str, Any]:
        """assembles final attributed response strictly from surviving verified claims"""
        claims = state.get("claims", [])
        policy = state.get("policy", PolicyState.FULL_PASS)
        dropped_claims = state.get("dropped_claims", [])

        if not claims:
            return {
                "final_answer": None,
                "abstention_diagnostic": "No verified claims available to assemble answer.",
            }

        # format claims with explicit citation pointers
        claim_segments = []
        for claim in claims:
            citations = ", ".join(claim.cited_span_ids)
            claim_segments.append(f"{claim.text.strip()} [{citations}]")

        body = " ".join(claim_segments)

        if policy == PolicyState.PARTIAL_PASS and dropped_claims:
            dropped_notes = "; ".join(f"'{c.text.strip()}'" for c in dropped_claims)
            disclaimer = (
                f"\n\n[Warrant Attribution Notice: The following ungrounded candidate assertions "
                f"were omitted due to lack of verified evidence: {dropped_notes}]"
            )
            final_answer = body + disclaimer
        else:
            final_answer = body

        return {
            "final_answer": final_answer,
            "abstention_diagnostic": None,
        }

    def abstain_diagnostic_node(self, state: GraphState) -> dict[str, Any]:
        """records detailed diagnostic reasoning when agent refuses to answer"""
        hops = state.get("hops", [])
        dropped_claims = state.get("dropped_claims", [])

        rejection_details = []
        for c in dropped_claims:
            reason = c.rejection_reason or "Unknown verification failure"
            rejection_details.append(f"- Claim: '{c.text}' | Reason: {reason}")

        diagnostic_lines = [
            f"WARRANT Abstention Contract Enforced:",
            f"Query: '{state['query']}'",
            f"Reason: Zero candidate claims satisfied the calibrated verification threshold (tau={self.verification_threshold:.2f}).",
            f"Total hops executed: {len(hops)}",
            f"Total rejected claims: {len(dropped_claims)}",
            "Rejected claim diagnostics:",
        ] + (rejection_details if rejection_details else ["- No candidate claims could be synthesized."])

        return {
            "final_answer": None,
            "abstention_diagnostic": "\n".join(diagnostic_lines),
        }
