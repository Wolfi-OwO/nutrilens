# nutrilens-ai-server — developer task runner
# Usage: make <target>

PY ?= python

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install the package with dev extras (editable)
	$(PY) -m pip install -e ".[dev]"

.PHONY: format
format: ## Auto-format code with black and ruff
	$(PY) -m black src tests scripts
	$(PY) -m ruff check --fix src tests scripts

.PHONY: lint
lint: ## Run linters (ruff + black --check + mypy)
	$(PY) -m ruff check src tests scripts
	$(PY) -m black --check src tests scripts
	$(PY) -m mypy

.PHONY: test
test: ## Run the test suite with coverage
	$(PY) -m pytest

.PHONY: dev
dev: ## Run the dev server with reload
	$(PY) -m uvicorn ai_server.main:app --reload --port 8000

.PHONY: load-test
load-test: ## Load-test a running server against NFR-PERF-01 (p95 < 3s) — pass ARGS="--base-url ..." to override
	$(PY) scripts/load_test.py $(ARGS)
