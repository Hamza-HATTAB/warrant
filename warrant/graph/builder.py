from typing import Any, Optional
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from warrant.graph.nodes import GraphNodeHandler
from warrant.graph.state import GraphState

# compiles stategraph workfow with bounded cyclic retries


def build_warrant_graph(
    node_handler: Optional[GraphNodeHandler] = None,
    checkpointer: Optional[Any] = None,
) -> CompiledStateGraph:
    """constructs and compiles stategraph state machine with conditional routing"""
    handler = node_handler or GraphNodeHandler()
    builder = StateGraph(GraphState)

    # register graph execution nodes
    builder.add_node("retrieve_hop", handler.retrieve_hop_node)
    builder.add_node("synthesize_claims", handler.synthesize_claims_node)
    builder.add_node("verify_claims", handler.verify_claims_node)
    builder.add_node("evaluate_policy", handler.evaluate_policy_node)
    builder.add_node("assemble_answer", handler.assemble_answer_node)
    builder.add_node("abstain_diagnostic", handler.abstain_diagnostic_node)

    # linear execution flow from start through evaluation
    builder.add_edge(START, "retrieve_hop")
    builder.add_edge("retrieve_hop", "synthesize_claims")
    builder.add_edge("synthesize_claims", "verify_claims")
    builder.add_edge("verify_claims", "evaluate_policy")

    # conditional edge enforcing 3-state abstention contract and bounded retries
    builder.add_conditional_edges(
        "evaluate_policy",
        handler.route_policy,
        {
            "retry": "retrieve_hop",
            "full_pass": "assemble_answer",
            "partial_pass": "assemble_answer",
            "abstain": "abstain_diagnostic",
        },
    )

    # terminal transitions
    builder.add_edge("assemble_answer", END)
    builder.add_edge("abstain_diagnostic", END)

    return builder.compile(checkpointer=checkpointer)
