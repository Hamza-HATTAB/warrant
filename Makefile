VENV := .venv
PYTHON := $(VENV)/bin/python
PYTEST := $(VENV)/bin/pytest
RUFF := $(VENV)/bin/ruff


.PHONY: help install test lint format clean ingest run-api run-frontend build-frontend reproduce

help:
	@echo "Available commands for Warrant Research Engine:"
	@echo "  install        - Install package dependecies via uv"
	@echo "  test           - Run full test suite (pytest -v tests/)"
	@echo "  lint           - Check code formatting and typing"
	@echo "  format         - Format source files with ruff"
	@echo "  ingest         - Run HotpotQA ingestion and build local collection"
	@echo "  run-api        - Launch FastAPI backend with SSE streaming on port 8000"
	@echo "  run-frontend   - Launch Next.js 14 frontend in development mode"
	@echo "  build-frontend - Build Next.js 14 production bundle"
	@echo "  reproduce      - Run full verifier bake-off benchmark (Naive RAG vs LLM Judge vs Warrant)"
	@echo "  clean          - Remove temporary bytecode, coverage, and caches"

install:
	$(UV) pip install -e .

test:
	$(PYTEST) -v tests/

lint:
	$(RUFF) check warrant tests

format:
	$(RUFF) format warrant tests

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .coverage htmlcov frontend/.next

ingest:
	$(PYTHON) -m warrant.data.ingest_hotpotqa

run-api:
	$(PYTHON) -m uvicorn warrant.api.server:app --host 0.0.0.0 --port 8000 --reload

run-frontend:
	cd frontend && npm run dev

build-frontend:
	cd frontend && npm run build

reproduce:
	$(PYTHON) -m benchmarks.bake_off_benchmark
