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

## Toolkit files outside `skills/`

8. Edit `fieldtwin-instructions.md` or `api-quick-reference.md`, never the copies in `platforms/`.
   Run `python3 scripts/build-platform-files.py` to regenerate them.
9. Never edit `api-reference.json` by hand. Run `python3 scripts/build-api-reference.py` after the
   v1.10 attribute catalog changes.
10. Keep the MCP server in `packages/fieldtwin-mcp`. Do not reference it from a `SKILL.md`; the
    skills stay documentation only. Route changes must match the v1.10 catalog, and write tools
    must stay behind `FIELDTWIN_MCP_ALLOW_WRITES`.
11. Run `python3 scripts/build-api-reference.py --check`, `python3 scripts/build-platform-files.py --check`,
    and `node --check packages/fieldtwin-mcp/index.js` before publishing.
12. Propose fixes to upstream skill files in
    [XvisionAS/fieldtwin-agent-skills](https://github.com/XvisionAS/fieldtwin-agent-skills) too, so
    the next upstream merge does not conflict.
