
## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
- New page/UI built from scratch, wanting a distinctive non-generic aesthetic → invoke hallmark

## Design System

Always read DESIGN.md before making any visual or UI decision. All font choices,
colors, spacing, radius, and aesthetic direction are defined there. The
direction is "Instrument": dark-first, high-contrast, dense, emerald-green accent,
Geist Sans plus Geist Mono, no serif, no decorative color. Do not deviate
without explicit user approval. In QA mode, flag any code that does not match
DESIGN.md.

## Debugging discipline

/investigate is a root-cause debugging workflow, not a blanket file/project scanner. Give it the specific error output/symptom as input. Before any full build: read the complete error output or run tsc --noEmit first, batch-fix everything found, then rebuild once — never rebuild repeatedly to discover errors one at a time.

## Testing

Run with `npm test` (Vitest, unit/integration in `tests/unit` and `tests/integration`) or `npm run test:e2e` (Playwright, `tests/e2e`). See TESTING.md for layers and conventions.

- 100% test coverage is the goal — tests make vibe coding safe, not slow.
- New functions get a corresponding test.
- Bug fixes get a regression test that fails on the old code.
- New error-handling paths get a test that triggers the error.
- New conditionals (if/else, switch) get tests for every branch.
- Never commit code that makes existing tests fail.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
