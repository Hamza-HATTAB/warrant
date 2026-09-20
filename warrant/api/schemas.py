from typing import Any, Optional
from pydantic import BaseModel, Field

from warrant.core.schema import PolicyState, WarrantState

# pydantic schemas for api endpoints and sse stream serialization


class QueryRequest(BaseModel):
    """incoming research query payload"""
    query: str = Field(..., min_length=3, description="natural language research question")
    max_hops: Optional[int] = Field(default=None, ge=1, le=5)
    verification_threshold: Optional[float] = Field(default=None, ge=0.5, le=0.99)


class HealthResponse(BaseModel):
    """system health and telemetry status"""
    status: str
    generator_model: str
    verifier_model: str
    qdrant_connected: bool
    vram_free_mb: float
    vram_total_mb: float
    loaded_models: list[str] = Field(default_factory=list)


class SSEEventPayload(BaseModel):
    """typed event emitted over server sent events stream"""
    event: str
    data: dict[str, Any]
