from contextlib import asynccontextmanager
import time
from typing import Any, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
import torch

from warrant.api.schemas import HealthResponse, QueryRequest
from warrant.api.sse_handler import generate_sse_stream
from warrant.core.config import settings
from warrant.core.schema import PolicyState, WarrantState
from warrant.graph.nodes import GraphNodeHandler
from warrant.graph.runner import WarrantGraphRunner

# fastpai server hosting rest endpoints and sse streaming services

_runner: Optional[WarrantGraphRunner] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _runner
    if _runner is None:
        handler = GraphNodeHandler()
        _runner = WarrantGraphRunner(node_handler=handler)
    yield
    # keep runner or clean up only if default
    _runner = None


app = FastAPI(
    title="WARRANT API",
    description="Operational Research & Claim Verification Agent API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_runner() -> WarrantGraphRunner:
    global _runner
    if _runner is None:
        _runner = WarrantGraphRunner()
    return _runner


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """returns system operational health, model telemetry, and vram budget"""
    qdrant_ok = False
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port, timeout=2.0)
        client.get_collections()
        qdrant_ok = True
    except Exception:
        qdrant_ok = False

    free_mb = 0.0
    total_mb = 0.0
    if torch.cuda.is_available():
        try:
            free_b, tot_b = torch.cuda.mem_get_info()
            free_mb = free_b / (1024 * 1024)
            total_mb = tot_b / (1024 * 1024)
        except Exception:
            pass

    return HealthResponse(
        status="healthy",
        generator_model=settings.generator_model,
        verifier_model=settings.verifier_model,
        qdrant_connected=qdrant_ok,
        vram_free_mb=free_mb,
        vram_total_mb=total_mb,
        loaded_models=[
            settings.generator_model,
            settings.verifier_model,
            settings.embedding_model,
            "FlashRank-ms-marco-MiniLM-L-12-v2",
        ],
    )


@app.get("/api/presets")
async def get_presets():
    """returns curated hotpotqa benchmark queries with known attribution profiles"""
    return [
        {
            "id": "preset-1",
            "title": "Arthur's Magazine Merger (Full Pass)",
            "query": "Arthur's Magazine was founded in what city, and what publication did it merge with?",
            "expected_policy": "FULL_PASS",
            "description": "2-hop factual query requiring synthesis across Arthur's Magazine and Godey's Lady's Book.",
        },
        {
            "id": "preset-2",
            "title": "Radio City & Rockefeller (Full Pass)",
            "query": "In which complex is Radio City Music Hall located and what city is it in?",
            "expected_policy": "FULL_PASS",
            "description": "Multi-hop entity verification with explicit spatial constraints.",
        },
        {
            "id": "preset-3",
            "title": "Date Hallucination Trap (Partial Pass)",
            "query": "When was Arthur's Magazine founded and was it sold for 50 million dollars in 2020?",
            "expected_policy": "PARTIAL_PASS",
            "description": "Tests deterministic guard fail-fast on ungrounded modern monetary figure.",
        },
        {
            "id": "preset-4",
            "title": "Adversarial Mars Colony (Strict Abstain)",
            "query": "Was Arthur's Magazine published on Mars by Elon Musk in 1844?",
            "expected_policy": "ABSTAIN",
            "description": "Adversarial entity injection triggering strict Warrant Abstention Contract.",
        },
    ]


@app.post("/api/query", response_model=WarrantState)
async def execute_query(payload: QueryRequest):
    """synchronous api endpoint returning fully resolved warrant state"""
    runner = get_runner()
    state = await runner.run(payload.query)
    return state


@app.get("/api/stream")
async def stream_query(query: str = Query(..., min_length=3)):
    """server sent events endpoint streaming real time node transitions and claim scores"""
    runner = get_runner()
    return EventSourceResponse(
        generate_sse_stream(query=query, runner=runner),
        media_type="text/event-stream",
    )
