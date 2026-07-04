# 0024: Versioned Static Word Bank Shards

## Status

Accepted

## Context

ADR `0004` established that dice-click Entry Assist must use a local or cached
Word Bank, not a synchronous live API or LLM call. The 2026-07-04 source
research in `docs/research/word-bank-sources.md` recommends ESDB / SCOWL v2 as
the lead source candidate and shows that conservatively filtered adjective and
noun candidates are small enough for static delivery.

The project still needed a production delivery boundary before implementation
planning could start. The main alternatives were:

- replace fixed shard URLs in place whenever the Word Bank changes;
- serve rotating subsets selected from a larger offline corpus;
- use static per-Entry-Kind shards with explicit versions;
- move candidate delivery into Supabase RPC or another service-backed path.

Rotating subsets and in-place replacement would make QA, cache behaviour,
repeat-avoidance, and user-facing word-list changes harder to reason about.
A service-backed path remains plausible later, but it is not required by the
measured shard sizes.

## Decision

Production Word Bank delivery uses immutable static Word Bank Shards plus a
small manifest.

A Word Bank Shard is the complete curated playable candidate list for one
Entry Kind at a specific version. It is not an exhaustive English dictionary,
not a temporary cache slice, and not a rotating subset of a larger corpus.
Shard candidates are curated lexical entries for one Entry Kind, not
necessarily single tokens. They may be single words, hyphenated words, or
open compounds when the compound behaves as one candidate, such as a specific
noun or adjective. Arbitrary phrases, sentence fragments, and unreviewed source
compounds are outside the accepted production shape.

Shard files are versioned or content-addressed and must not be silently
replaced in place. A manifest declares the current shard version for each
supported Entry Kind and the client may continue using a cached shard until the
manifest points to a newer version. Entry Kinds can advance independently, so
an adjective shard can be replaced without forcing noun, verb, or future
function-word shards to change.

Shard entries carry minimal metadata rather than bare strings only. Runtime
entry assistance may still fill inputs with a plain candidate value, but the
published shard format must preserve enough information for attribution,
curation, filtering, and future Entry Kind behaviour. The expected metadata
includes canonical candidate text, source id/version, Entry Kind, optional
dialect marker, optional commonness or playability band, required candidate
form such as single word, hyphenated word, or open compound, required
safety/curation status, and optional inflection or base-form link when
available.

Published shard candidates are positive allowlists, not blocklist-only source
exports. Build inputs may include source filters, exclusion rules, and
blocklists, but a candidate ships only after it is deliberately accepted into a
curation tier. Potentially offensive but otherwise playable candidates may be
included only when labelled so the runtime can exclude them by default. The
Entry Assist Safety Setting in signed-in Account Settings controls whether
those labelled potentially offensive candidates can be suggested; the default
excludes them. Anonymous play has no safety-setting form and must always
exclude potentially offensive candidates from Entry Assist. This setting
affects Entry Assist only. It is not typed-entry validation, public-content
Safety Screening, or moderation authority for shared phrases.

The first production Word Bank slice should publish only family-friendly
candidate shards, while still defining the shard schema with safety/curation
status. Potentially offensive labelled candidates should not ship as dormant
content until the signed-in Account Settings toggle, persistence, QA process,
and copy are implemented together.

The production shard schema and build pipeline should understand the full
controlled vocabulary of built-in Entry Kinds, but production publishes shards
only for Entry Kinds used by currently playable templates. Unsupported Entry
Kinds should fail clearly in build-time validation or disable only their dice
action at runtime if somehow requested without a shard or seed fallback.

Production shard assets live under a dedicated `assets/word-bank/` namespace,
separate from the MVP seed fallback file. The default layout is
`assets/word-bank/manifest.json` plus immutable shard files under
`assets/word-bank/shards/`, such as
`assets/word-bank/shards/adjective.<version>.json`. The manifest owns current
production shard mapping. `assets/word-bank-seed.json` keeps its separate
fallback-seed contract and should not be treated as the manifest or a
production shard file.

For the first production rollout, Word Bank manifests and shards deploy through
the normal app deployment payload. They must not use a separate publishing
channel or live mutation path. This keeps app code, shard schema, manifest
format, and shard files under the same protected branch, CI, test, and
promotion workflow. A separate Word Bank publishing channel can be reconsidered
only after refresh cadence or curation operations materially diverge from app
release cadence.

The Word Bank build/import pipeline lives in this repository. It should include
the pinned source configuration, extraction and Entry Kind mapping code,
curation inputs, schema validation, deterministic sample/report generation, and
tests for mapping, filtering, output schema, and reproducibility. Generated
review reports can remain build artefacts unless deliberately added for a
review package. Generated production shard files are committed under
`assets/word-bank/` only when an intentional Word Bank update is in scope.

Implementation should introduce the production manifest/shard loader directly
rather than treating a larger `assets/word-bank-seed.json` file as the primary
path. The loader contract includes manifest fetch, lazy per-Entry-Kind shard
fetch, cache-by-version behaviour, game-stable shard version pinning, and seed
category fallback. The existing seed JSON remains valid fallback data.

The client checks the manifest at app start or on first Entry Assist use, then
fetches shard files lazily per Entry Kind. It does not background-poll for Word
Bank changes during play. If the manifest points to a newer shard, that version
becomes eligible for newly started games after it has been fetched. Any game
already in progress keeps using the shard versions it started with, so
repeat-avoidance and phrase rendering cannot shift mid-game.

`assets/word-bank-seed.json` remains the tiny bundled fallback for unavailable
production candidate delivery. It should expand beyond the default
adjective/noun template as future built-in Entry Kinds become playable, but it
is not the full production Word Bank.

When the manifest or a needed shard cannot be fetched, manual entry remains
available. The app should keep using any already cached manifest and shards. If
there is no cached shard for the needed Entry Kind, dice assistance falls back
to the bundled seed list for that Entry Kind when one exists. If neither a
cached shard nor a seed fallback exists for the active Entry Kind, only that
slot's dice action is disabled with restrained local unavailable copy. Game
setup, typed entry, turn submission, and Reveal must not be blocked by missing
candidate suggestions. The app must not silently substitute candidates from the
wrong Entry Kind.

Supabase RPC, server prefetch, or another service-backed delivery path remains
deferred unless final curated shards become too large for static delivery, need
account-level dynamic filtering, or need server-controlled update cadence that
static manifests cannot provide.

## Consequences

- Word Bank QA is reproducible because a tested shard version keeps the same
  contents after publication.
- Cache invalidation is explicit: manifest changes, not URL reuse, move clients
  to newer candidate lists.
- Word Bank refresh is session-bounded and game-stable. New shard versions can
  be discovered at app start or first Entry Assist use, but in-progress games
  retain their starting shard versions.
- Implementation work must create a build/import pipeline that emits shard
  files, a manifest, source/licence attribution metadata, schema validation,
  and deterministic output tests.
- Shard schema design must keep runtime use simple while preserving metadata
  needed for source attribution, curation, dialect controls, playability
  filters, and later template categories.
- Production curation must not assume "single token" is the eligibility rule.
  Hyphenated words and open compounds can ship when reviewed as one lexical
  Entry Candidate.
- Family-friendly curation remains a separate layer. The source extraction
  filter and ESDB usage notes are not enough by themselves, and the runtime
  default must exclude candidates labelled as potentially offensive.
- The initial production shard rollout should avoid publishing potentially
  offensive candidates at all, even labelled, until the signed-in opt-in
  setting and review process are ready.
- The first rollout can publish only adjective and noun shards unless another
  playable template brings more Entry Kinds into scope.
- Production shard files use the `assets/word-bank/` namespace. The MVP seed
  fallback remains at `assets/word-bank-seed.json` with a separate contract.
- The first production shard rollout uses the normal app deployment payload;
  independent Word Bank publishing remains deferred.
- The build/import pipeline is source-controlled so production shards are
  reproducible from pinned inputs rather than dependent on ad hoc scratch
  scripts.
- Implementation work should build the real manifest/shard loader contract
  rather than temporarily expanding the MVP seed as the main production path.
- The bundled seed asset becomes a small multi-Entry-Kind resilience layer over
  time, not only an adjective/noun MVP artefact.
- Static hosting and CDN caching remain the first production delivery target.
  Service-backed Word Bank access is intentionally deferred rather than
  accepted by default.
- Future custom templates may compose built-in Entry Kinds from the available
  shards, but user-defined Entry Kinds remain outside this decision.
