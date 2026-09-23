# Contributing

Keep the skill public, portable, and based on released FieldTwin integration contracts.

Before opening a change:

1. Verify protocol claims against current public FieldTwin documentation or a released host contract.
2. Use fictional identifiers, domains, tags, coordinates, and measurements in every example.
3. Never add JWTs, API tokens, customer data, private endpoints, internal repository paths, or unpublished implementation details.
4. Keep browser examples safe by default: exact origins, pinned source windows, memory-only credentials, and explicit cleanup.
5. Update the skill metadata version and changelog when installed behavior changes.
6. Keep canonical skills under `skills/<skill-name>`; do not duplicate them in agent-specific wrappers.
7. Run `python3 scripts/validate_package.py` and `skills-ref validate` for every changed skill before publishing.

Protocol changes should include both positive and negative tests: correct payload/routing, malformed input, wrong origin/source, token refresh, and teardown.
