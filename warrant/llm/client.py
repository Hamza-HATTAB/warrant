import json
import re
from typing import Any, Optional, Type, TypeVar
import httpx
from pydantic import BaseModel, Field

from warrant.core.config import settings

T = TypeVar("T", bound=BaseModel)


class SynthesizedClaim(BaseModel):
    """atomic claim tied to explicit cited span identifiers"""
    claim_id: str
    claim_text: str
    cited_span_ids: list[str] = Field(default_factory=list)


class SynthesisResponse(BaseModel):
    """structured output schema emitted by generator model"""
    is_answerable: bool = True
    summary: str = ""
    claims: list[SynthesizedClaim] = Field(default_factory=list)
    refusal_reason: Optional[str] = None


def extract_json_payload(raw_text: str) -> dict[str, Any]:
    """robustly extracts json payload even if wrapped in markdown codeblocks"""
    raw_text = raw_text.strip()
    # match markdown json fence
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if match:
        return json.loads(match.group(1))

    # match first outer json object
    match_braces = re.search(r"(\{.*\})", raw_text, re.DOTALL)
    if match_braces:
        return json.loads(match_braces.group(1))

    return json.loads(raw_text)


class OllamaClient:
    """asynchronous ollama client enforcing structured json outputs and low temperature"""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 60.0,
    ):
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.generator_model
        self.timeout = timeout

    async def generate_chat(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.0,
    ) -> str:
        """calls ollama /api/chat with low temperature for deterministic extraction"""
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "format": "json",
            "options": {
                "temperature": temperature,
                "num_ctx": 4096,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Type[T] = SynthesisResponse,
    ) -> T:
        """generates and validates structured output against target pydantic schema"""
        raw_output = await self.generate_chat(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        parsed_dict = extract_json_payload(raw_output)
        return schema.model_validate(parsed_dict)

    def generate_structured_sync(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: Type[T] = SynthesisResponse,
    ) -> T:
        """synchronous runner for structured extraction in standard nodes"""
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()

        return loop.run_until_complete(
            self.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                schema=schema,
            )
        )
