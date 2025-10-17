.PHONY: help install dev clean build test lint format typecheck

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	npm install

dev: ## Start mobile and server in development mode
	npm run dev

dev-mobile: ## Start mobile app only
	npm run dev:mobile

dev-server: ## Start server only
	npm run dev:server

clean: ## Clean all node_modules
	npm run clean
	find . -name "node_modules" -type d -prune -exec rm -rf {} +
	find . -name ".next" -type d -prune -exec rm -rf {} +
	find . -name "dist" -type d -prune -exec rm -rf {} +

build: ## Build all packages
	npm run build

test: ## Run all tests
	npm run test

lint: ## Lint all packages
	npm run lint

format: ## Format code with Prettier
	npm run format

typecheck: ## Type-check all packages
	npm run typecheck

setup: install ## Initial project setup
	@echo "✅ Dependencies installed"
	@echo "📝 Next steps:"
	@echo "  1. Copy .env.example to .env and fill in your keys"
	@echo "  2. Run 'make dev' to start development"
