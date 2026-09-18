PYTHON := /home/hamza/.pyenv/versions/3.11.9/envs/ml/bin/python
PIP := $(PYTHON) -m pip
PYTEST := $(PYTHON) -m pytest

.PHONY: help install test lint format clean ingest run-api reproduce

help:
	@echo "Available commands:"
	@echo "  install    - Install package and dev dependecies"
	@echo "  test       - Run test suite"
	@echo "  lint       - Check code formatting and typing"
	@echo "  format     - Format source files"
	@echo "  ingest     - Run HotpotQA ingestion and build local collection"
	@echo "  run-api    - Launch FastAPI server with reload"
	@echo "  reproduce  - Run full benchmark evaluation and dump metrics"
	@echo "  clean      - Remove temporary bytecode and caches"

install:
	$(PIP) install -e .

test:
	$(PYTEST) -v tests/

lint:
	$(PYTHON) -m ruff check warrant tests

format:
	$(PYTHON) -m ruff format warrant tests

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .coverage htmlcov

ingest:
	$(PYTHON) -m warrant.data.ingest_hotpotqa

run-api:
	$(PYTHON) -m uvicorn warrant.api.server:app --host 0.0.0.0 --port 8000 --reload

reproduce:
	$(PYTHON) -m benchmarks.bakeoff
