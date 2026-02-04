# Makefile for NaisuIntentHook deployment

.PHONY: test build deploy-base-sepolia verify help

# Default target
help:
	@echo "Available targets:"
	@echo "  test              - Run all tests"
	@echo "  build             - Build contracts"
	@echo "  deploy-base-sepolia - Deploy to Base Sepolia"
	@echo "  verify            - Verify contract on Etherscan"

# Run tests
test:
	forge test -vvv

# Build contracts
build:
	forge build

# Deploy to Base Sepolia
deploy-base-sepolia:
	@echo "Checking environment..."
	@if [ -z "$(PRIVATE_KEY)" ]; then \
		echo "❌ Error: PRIVATE_KEY not set"; \
		echo "   Set it with: export PRIVATE_KEY=your_key_here"; \
		exit 1; \
	fi
	@echo "✅ PRIVATE_KEY is set"
	@echo ""
	@echo "🚀 Deploying NaisuIntentHook to Base Sepolia..."
	@echo ""
	forge script script/DeployNaisuHook.s.sol:DeployNaisuHookScript \
		--rpc-url https://sepolia.base.org \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		-vvvv

# Verify contract on Basescan (Base Sepolia explorer)
verify:
	@echo "Verifying contract..."
	@if [ -z "$(HOOK_ADDRESS)" ]; then \
		echo "❌ Error: HOOK_ADDRESS not set"; \
		echo "   Set it with: export HOOK_ADDRESS=0x..."; \
		exit 1; \
	fi
	forge verify-contract \
		$(HOOK_ADDRESS) \
		src/NaisuIntentHook.sol:NaisuIntentHook \
		--chain 84532 \
		--etherscan-api-key $(ETHERSCAN_API_KEY)
