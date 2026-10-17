.PHONY: test-auth-e2e lint format-check format lint-inventory format-check-inventory format-inventory lint-order format-check-order format-order lint-admin format-check-admin format-admin lint-storefront format-check-storefront format-storefront

test-auth-e2e:
	node scripts/auth-e2e.mjs

lint: lint-inventory lint-order lint-admin lint-storefront

format-check: format-check-inventory format-check-order format-check-admin format-check-storefront

format: format-inventory format-order format-admin format-storefront

lint-inventory:
	cd services/inventory && golangci-lint run ./...

format-check-inventory:
	@test -z "$$(gofmt -l $$(find services/inventory -name '*.go' -not -path '*/vendor/*'))"

format-inventory:
	gofmt -w $$(find services/inventory -name '*.go' -not -path '*/vendor/*')

lint-order:
	cd services/order && ruff check .

format-check-order:
	cd services/order && ruff format --check .

format-order:
	cd services/order && ruff format .

lint-admin:
	cd frontends/admin && pnpm lint

format-check-admin:
	cd frontends/admin && pnpm format:check

format-admin:
	cd frontends/admin && pnpm format

lint-storefront:
	cd frontends/storefront && pnpm lint

format-check-storefront:
	cd frontends/storefront && pnpm format:check

format-storefront:
	cd frontends/storefront && pnpm format
