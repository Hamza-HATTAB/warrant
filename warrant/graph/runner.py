import asyncio
import time
from typing import Any, AsyncIterator, Optional
from langgraph.graph.state import CompiledStateGraph

from warrant.core.schema import PolicyState, WarrantState
from warrant.graph.builder import build_warrant_graph
from warrant.graph.nodes import GraphNodeHandler
from warrant.graph.state import GraphState, create_initial_state, to_warrant_state

# asynchronous runer managing graph execution and state accumulation


class WarrantGraphRunner:
    """high level runner executing multi-hop research queries against warrant graph"""

    def __init__(
        self,
        node_handler: Optional[GraphNodeHandler] = None,
        compiled_graph: Optional[CompiledStateGraph] = None,
    ):
        self.handler = node_handler or GraphNodeHandler()
        self.graph = compiled_graph or build_warrant_graph(node_handler=self.handler)

    async def run(self, query: str) -> WarrantState:
        """executes complete multi-hop research lifecycle and returns validated warrant state"""
        start_time = time.perf_counter()
        initial_state = create_initial_state(query)

        try:
            raw_output = await self.graph.ainvoke(initial_state)
            warrant_state = to_warrant_state(raw_output)
            warrant_state.total_latency_ms = (time.perf_counter() - start_time) * 1000.0
            return warrant_state
        except Exception as err:
            latency = (time.perf_counter() - start_time) * 1000.0
            return WarrantState(
                query=query,
                policy=PolicyState.ABSTAIN,
                final_answer=None,
                abstention_diagnostic=f"Runtime error during graph execution: {err}",
                total_latency_ms=latency,
            )

    def run_sync(self, query: str) -> WarrantState:
        """synchronous entrypoint wrapping event loop execution"""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # inside an active event loop, dispatch via nestable thread executor
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(lambda: asyncio.run(self.run(query)))
                return future.result()
        else:
            return asyncio.run(self.run(query))

    async def stream_events(self, query: str) -> AsyncIterator[dict[str, Any]]:
        """streams node level updates and state transitions as they occur"""
        initial_state = create_initial_state(query)
        async for event in self.graph.astream(initial_state):
            yield event
