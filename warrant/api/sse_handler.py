import json
from typing import Any, AsyncIterator

from warrant.core.schema import PolicyState, WarrantState
from warrant.graph.runner import WarrantGraphRunner
from warrant.graph.state import create_initial_state, to_warrant_state

# event stream generator bridging langgraph node events to sse protocols


async def generate_sse_stream(
    query: str,
    runner: WarrantGraphRunner,
) -> AsyncIterator[dict[str, str]]:
    """asynchronous generator producing sse compliant event objects"""
    yield {
        "event": "query_started",
        "data": json.dumps({"query": query}),
    }

    try:
        accumulated_state = create_initial_state(query)
        async for event_dict in runner.stream_events(query):
            for node_name, state_chunk in event_dict.items():
                accumulated_state.update(state_chunk)

                if node_name == "retrieve_hop":
                    hops = state_chunk.get("hops", [])
                    evidence_pool = state_chunk.get("evidence_pool", {})
                    last_hop = hops[-1] if hops else None
                    spans_data = [
                        evidence_pool[sid].model_dump()
                        for sid in (last_hop.retrieved_span_ids if last_hop else [])
                        if sid in evidence_pool
                    ]
                    yield {
                        "event": "hop_completed",
                        "data": json.dumps({
                            "hop_idx": last_hop.hop_idx if last_hop else 0,
                            "sub_query": last_hop.sub_query if last_hop else query,
                            "spans": spans_data,
                            "latency_ms": last_hop.latency_ms if last_hop else 0.0,
                        }),
                    }

                elif node_name == "synthesize_claims":
                    claims = state_chunk.get("claims", [])
                    yield {
                        "event": "claims_synthesized",
                        "data": json.dumps({
                            "claims": [c.model_dump() for c in claims],
                        }),
                    }

                elif node_name == "verify_claims":
                    claims = state_chunk.get("claims", [])
                    yield {
                        "event": "claims_verified",
                        "data": json.dumps({
                            "claims": [c.model_dump() for c in claims],
                        }),
                    }

                elif node_name == "evaluate_policy":
                    policy = state_chunk.get("policy", PolicyState.ABSTAIN)
                    yield {
                        "event": "policy_evaluated",
                        "data": json.dumps({
                            "policy": policy.value if hasattr(policy, "value") else str(policy),
                            "retry_count": state_chunk.get("retry_count", 0),
                            "next_sub_query": state_chunk.get("next_sub_query"),
                        }),
                    }

                elif node_name == "assemble_answer":
                    yield {
                        "event": "answer_assembled",
                        "data": json.dumps({
                            "final_answer": state_chunk.get("final_answer"),
                            "claims": [c.model_dump() for c in state_chunk.get("claims", [])],
                            "dropped_claims": [c.model_dump() for c in state_chunk.get("dropped_claims", [])],
                        }),
                    }

                elif node_name == "abstain_diagnostic":
                    yield {
                        "event": "abstention_enforced",
                        "data": json.dumps({
                            "abstention_diagnostic": state_chunk.get("abstention_diagnostic"),
                            "dropped_claims": [c.model_dump() for c in state_chunk.get("dropped_claims", [])],
                        }),
                    }

        warrant_state = to_warrant_state(accumulated_state)
        yield {
            "event": "complete",
            "data": json.dumps(warrant_state.model_dump()),
        }

    except Exception as err:
        yield {
            "event": "error",
            "data": json.dumps({"error": str(err)}),
        }
