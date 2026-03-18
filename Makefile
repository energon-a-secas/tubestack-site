.DEFAULT_GOAL := help

PORT ?= 8827

# ── Help ───────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  tubestack-site"
	@echo ""
	@echo "  make setup          Install deps + deploy Convex functions"
	@echo "  make install        Install npm dependencies"
	@echo "  make dev            Run Convex dev (deploys functions + watches)"
	@echo "  make deploy         Deploy Convex functions to production"
	@echo "  make serve          Serve the site locally on PORT (default: $(PORT))"
	@echo "  make kill           Kill this project's HTTP server"
	@echo "  make login          Authenticate with Convex"
	@echo "  make worker-dev     Run Cloudflare Worker locally"
	@echo "  make worker-deploy  Deploy Cloudflare Worker"
	@echo ""

# ── Setup ──────────────────────────────────────────────────────────────────────
.PHONY: setup
setup: install deploy
	@echo "Setup complete — run 'make serve' to view the site"

# ── Dependencies ───────────────────────────────────────────────────────────────
.PHONY: install
install:
	npm install

# ── Convex ─────────────────────────────────────────────────────────────────────
.PHONY: login
login:
	npx convex login

.PHONY: dev
dev:
	npx convex dev

.PHONY: deploy
deploy:
	npx convex deploy

# ── Local server ───────────────────────────────────────────────────────────────
.PHONY: serve
serve:
	@echo "Serving on http://localhost:$(PORT)"
	python3 -m http.server $(PORT)

.PHONY: kill
kill:
	@lsof -ti :$(PORT) | xargs kill 2>/dev/null && echo "Stopped server on port $(PORT)" || echo "No server running on port $(PORT)"

# ── Cloudflare Worker ──────────────────────────────────────────────────────────
.PHONY: worker-dev
worker-dev:
	cd worker && npx wrangler dev

.PHONY: worker-deploy
worker-deploy:
	cd worker && npx wrangler deploy
