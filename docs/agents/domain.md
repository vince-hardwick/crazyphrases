# Domain Docs

Crazy Phrases is a single-context repository.

## Read First

- `CONTEXT.md` for canonical domain vocabulary.
- `docs/planning/agent-context-map.md` for document ownership and routing.
- `docs/product-rules.md` for accepted product and UX rules.
- Relevant ADRs under `docs/decisions/`.

## Domain Vocabulary

Use the glossary terms from `CONTEXT.md` when writing PRDs, issues, plans, tests, and implementation notes. Avoid synonyms that the glossary explicitly rejects.

If a concept is missing from `CONTEXT.md`, do not invent durable terminology casually. Either use plain descriptive wording for the current task or run a glossary/design clarification session before making the term durable.

## ADRs

ADRs live under `docs/decisions/`, not `docs/adr/`.

Read relevant ADRs before changing deployment boundaries, source-of-truth rules, lifecycle behaviour, authentication, deletion semantics, template/versioning behaviour, or static/backend architecture.

If work contradicts an accepted ADR, surface the contradiction explicitly before proceeding.

