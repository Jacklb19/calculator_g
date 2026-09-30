IMAGE ?= calculator
PORT ?= 8080
GOTESTFLAGS ?=

.PHONY: help install lint lint-backend lint-frontend test test-backend test-frontend \
	coverage coverage-backend coverage-frontend coverage-report build run-backend run-frontend \
	docker-build docker-run smoke clean

help: ## List the available targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  %-14s %s\n", $$1, $$2}'

install: ## Install frontend dependencies
	cd frontend && npm ci

lint: lint-backend lint-frontend ## Check formatting, vet, lint and types

lint-backend:
	@unformatted=$$(cd backend && gofmt -l .); \
	if [ -n "$$unformatted" ]; then echo "Run gofmt on:"; echo "$$unformatted"; exit 1; fi
	cd backend && go vet ./...

lint-frontend:
	cd frontend && npm run lint && npx tsc -b

test: test-backend test-frontend ## Run all tests

test-backend:
	cd backend && go test $(GOTESTFLAGS) ./...

test-frontend:
	cd frontend && npm test

coverage: coverage-backend coverage-frontend ## Run all tests with coverage reports

coverage-backend:
	cd backend && go test $(GOTESTFLAGS) -coverprofile=coverage.out ./...
	cd backend && go tool cover -func=coverage.out | tail -n 1

coverage-frontend:
	cd frontend && npm run coverage

coverage-report: coverage-backend ## Write HTML coverage reports to docs/coverage
	cd backend && go tool cover -html=coverage.out -o ../docs/coverage/backend.html
	cd frontend && npx vitest run --coverage --coverage.reporter=html --coverage.reportsDirectory=../docs/coverage/frontend

build: ## Build the frontend and the server binary (backend/bin/server)
	cd frontend && npm run build
	cd backend && go build -o bin/server ./cmd/server

run-backend: ## Run the API on :8080
	cd backend && go run ./cmd/server

run-frontend: ## Run the Vite dev server, proxying /api to :8080
	cd frontend && npm run dev

docker-build: ## Build the Docker image
	docker build -t $(IMAGE) .

docker-run: ## Run the Docker image on PORT
	docker run --rm -p $(PORT):8080 $(IMAGE)

smoke: ## Smoke-test a server running on PORT
	bash scripts/smoke-test.sh http://localhost:$(PORT)

clean: ## Remove build and coverage output
	rm -rf frontend/dist frontend/coverage backend/bin backend/coverage.out
