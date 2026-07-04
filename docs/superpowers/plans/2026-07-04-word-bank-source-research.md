# Word-Bank Source Research Plan

> **Status:** Completed on 2026-07-04. Current authority for the source
> recommendation is `docs/research/word-bank-sources.md`; deferred adoption and
> delivery status is in `docs/backlog.md`.

> **For agentic workers:** This plan has been executed. Do not resume it as an
> active implementation plan. Use it only as provenance for the research pass
> that compared candidate Word Bank sources.

**Goal:** Identify the best source path for a production Crazy Phrases Word Bank
that supports the current adjective-noun-noun default template and leaves room
for future built-in Entry Kinds.

**Architecture:** Download candidate corpora into scratch space, profile them
with conservative game-ready filters, record source evidence and counts, then
promote only durable conclusions to the project research and backlog docs.

**Tech Stack:** Markdown documentation, temporary Python profiling scripts,
public lexical data archives, no runtime asset changes.

---

## Completed Tasks

- [x] Create this plan file and route it from `docs/superpowers/README.md`.
- [x] Update `docs/research/word-bank-sources.md` with a candidate evidence
      matrix before adopting a source.
- [x] Download candidate data into temp scratch space only:
      ESDB/SCOWL v2, old POS/Moby+WordNet, AGID, Princeton WordNet via NLTK
      data, and Open English Wordnet 2025.
- [x] Profile candidates with conservative filters:
      ASCII alphabetic single tokens, lowercase-only, no abbreviations, no
      obvious names/proper nouns, no spaces, no hyphens, no apostrophes, and a
      minimal safety screen.
- [x] Emit scratch JSON/CSV reports and deterministic sample packs under the
      OS temp directory, not under the repository.
- [x] Score each source against Crazy Phrases criteria: current adjective/noun
      fit, future POS coverage, licence posture, family-friendly support,
      commonness controls, dialect controls, parser complexity, update
      stability, and static-shard suitability.
- [x] Record the recommendation in `docs/research/word-bank-sources.md`.
- [x] Update `docs/backlog.md` for the changed source-selection, filtering, and
      delivery deferrals.
- [x] Decide that no ADR is warranted yet because the research recommends a
      source path but does not accept a durable production delivery boundary.

## Scratch Evidence

Scratch outputs were generated at:

`%TEMP%\crazyphrases-word-bank-research\reports\`

The generated corpus archives and sample packs are intentionally not committed.
Recreate them from the download instructions in `docs/research/word-bank-sources.md`
when implementation planning begins.

## Verification

- Baseline before tracked edits: `npm test` passed 292/292 tests.
- Documentation closeout: run `git diff --check`.
- Runtime tests are not expected to change because this plan updates research
  and backlog documentation only.
