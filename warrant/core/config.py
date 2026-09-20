from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """runtime configuartion and paths for the warrant system"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # model endpoints and identifiers
    ollama_base_url: str = "http://localhost:11434"
    generator_model: str = "gemma3:12b"
    fallback_generator_model: str = "qwen2.5:7b-instruct-q4_K_M"
    verifier_model: str = "MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli"
    embedding_model: str = "BAAI/bge-large-en-v1.5"

    # qdrant vector store
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_grpc_port: int = 6334
    qdrant_collection: str = "warrant_hotpotqa"

    # verification parameters
    verification_threshold: float = 0.82
    max_hops: int = 2
    max_spans_per_claim: int = 3
    retrieval_top_k: int = 10
    rerank_top_k: int = 4

    # paths
    base_dir: Path = Path(__file__).resolve().parent.parent.parent
    data_dir: Path = base_dir / "data"
    cache_dir: Path = base_dir / "cache"


settings = Settings()
