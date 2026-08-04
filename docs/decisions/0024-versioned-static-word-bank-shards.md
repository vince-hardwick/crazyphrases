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
includes canonical candidate text, source id/version, Entry Kind, required
candidate form such as single word, hyphenated word, or open compound,
required family-friendly and curation status, required Commonness Grade,
required Noun Semantic Band for nouns, UK-English eligibility, and optional
inflection or base-form link when available. Playability is not candidate
metadata.

Semantic-reference provenance is recorded once for the build and shard using
the pinned source identity, version, and archive hash. Per-noun runtime metadata
stores only the final operator-approved Noun Semantic Band; matched synset ids,
alternative bands, confidence, override flags, and override reasons are not
persisted.

Runtime Entry Assist consumes candidate lists through an Entry Candidate
Provider seam. The provider may expose legacy seed strings or metadata-bearing
candidate records, but game state and phrase rendering normalise them to plain
candidate values before filling or displaying Entries. This seam preserves the
existing seed-backed dice behaviour while allowing later static shard loaders to
carry metadata without changing the Entry storage shape.

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

Issue #245 curation may retain operator-reviewed candidates whose required
family-friendly boolean is false, without recording a safety rationale, but
its default runtime shards publish only true candidates. Issue #247 owns any
later separately published opt-in tier, Account setting, persistence, Game
snapshot filtering, and runtime access to false candidates.

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

The maintainer-controlled Entry Assist Weight Policy is a separate
version-controlled static asset in the normal app deployment payload. It is
loaded globally at app start or first Entry Assist use and may change after a
reload without changing or replacing an immutable Word Bank Shard. Games pin
candidate shard membership, not policy weights. There is no Account-facing
weight control, service-backed configuration, independent publishing channel,
or background polling for policy changes.

For the first production rollout, Word Bank manifests and shards deploy through
the normal app deployment payload. They must not use a separate publishing
channel or live mutation path. This keeps app code, shard schema, manifest
format, and shard files under the same protected branch, CI, test, and
promotion workflow. A separate Word Bank publishing channel can be reconsidered
only after refresh cadence or curation operations materially diverge from app
release cadence.

The Word Bank build/import pipeline lives in this repository. It should include
the pinned source configuration, extraction and Entry Kind mapping code,
curation inputs, schema validation, and tests for mapping, filtering, output
schema, and reproducibility. The curation inputs, generated shard, validation
result, and Git diff are the review evidence; the pipeline does not need to
record inclusion or exclusion reasons, semantic distributions, candidate-form
counts, or sample phrases. Generated production shard files are committed
under `assets/word-bank/` only when an intentional Word Bank update is in
scope.

Issue #245 also provides a lightweight local-only web workbench for operator noun
tranche review. The source-controlled Noun Review Register and curation inputs remain
authoritative; the workbench only facilitates reading and recording those decisions.
It has no Account, Supabase, authentication, hosted-service, or live-mutation role and
must not deploy to `dev`, `test`, or production. Its implementation must therefore make
the repository's source-only `tools/` boundary explicit in every deployment workflow,
the hosting runbook, and the deployment-surface regression test.

The workbench is served by a loopback-only local process and reads the designated review
files directly from the working tree. An explicit Save action validates a complete
proposed write before replacing authoritative review data; failed validation leaves that
data unchanged. The workbench cannot stage, commit, push, build or publish shards,
trigger deployment, or write outside the designated Noun Review Register and curation
inputs.

Only one workbench process may hold the review-data write lock; additional instances are
read-only. Every save verifies that each authoritative target still matches the version
loaded by the workbench and refuses to overwrite an external edit. A complete replacement
is validated before an atomic swap, so a partial or failed write never becomes
authoritative. Recovering a stale lock requires explicit confirmation that no writable
workbench process remains.

Unfamiliar review terms have discoverable plain-English help available by hover,
keyboard focus, and click or tap. This help covers ESDB source size, spelling profiles,
variant levels, source suggestions versus operator decisions, and every Noun Semantic
Band, with two illustrative nouns per band. The examples explain intended meaning but do
not become automatic classification precedents. A visible help affordance accompanies
each affected label, and semantic-band help remains aligned with the canonical glossary
in `CONTEXT.md` rather than creating UI-only meanings.

The workbench and its validation contract are Entry-Kind-aware rather than noun-only.
Issue #245 uses them for the noun tranche programme and the fixed re-review of all 114
existing adjectives. Adjective review uses the shared Curation Decision, UK-English
eligibility, family-friendly, and Commonness Grade decisions but does not expose or
persist a Noun Semantic Band. The same register, tranche, progress, evidence, and
interaction mechanisms must be reusable by issue #250 for later adjective-catalogue
expansion without redesigning the workbench; #250 still owns its catalogue boundary and
review programme.

The logical Noun Review Register comprises one small source-controlled JSON index and
one source-controlled JSON file per review tranche. The index owns the pinned Source
Catalogue identity, ordered tranche identifiers and paths, and tranche lifecycle state;
each tranche file exclusively owns its candidate roster and operator decisions. The
workbench derives reviewed and total counts from tranche contents rather than persisting
duplicate counters. Register validation reconciles the complete automatically admitted
catalogue and carried-forward legacy candidates so that each is assigned to exactly one
tranche with no gaps or duplicates.

The workbench home screen provides case-insensitive exact and prefix candidate search
across every registered Entry Kind, derived from tranche contents rather than persisted
as a second location index. A result identifies the candidate, tranche, sequence,
lifecycle state, and review state, and opens a read-only tranche summary with the
candidate highlighted. Search never jumps into or changes sequential review. A candidate
in a completed tranche can be selected for correction only when no tranche is active;
planned and active candidates remain locatable but cannot be reached out of sequence.

A standard noun review tranche contains no more than 250 candidates. The existing
240-candidate baseline is its own valid tranche. Each automatically generated #245
semantic-gap tranche contains 250 candidates unless fewer qualifying candidates remain,
and automatically planned later tranches contain 250 candidates except for the final
remainder. Size-85 and size-99 candidates are outside the Source Catalogue and register.

After the automatically generated #245 tranche work, planned later tranches rotate through
the `common`, `lessCommon`, and `rare` ESDB source-suggestion lanes. Within each lane,
candidates are spread across the eleven automatic Noun Semantic Band suggestions plus
an unresolved-suggestion bucket, using canonical text as the stable final ordering key.
When a grade lane is exhausted, rotation continues through the remaining lanes.
Commonness and semantic suggestions organise review order only and never become the
operator's final decisions.

Noun review tranches use the lifecycle states `planned`, `active`, and `complete`, with
no more than one active tranche. A planned tranche has a fixed roster but no review in
progress; an active tranche permits validated partial saves; and completion requires
both a valid decision for every candidate and explicit operator confirmation. Each
reviewed candidate records an `Accept` or `Reject` Curation Decision, UK-English
eligibility, and family friendliness. `Accept` requires UK-English eligibility and also
requires Commonness Grade plus Noun Semantic Band for a noun, or Commonness Grade for an
adjective. An accepted candidate may be non-family-friendly and remain in curation, but
only accepted, UK-English Eligible, family-friendly candidates qualify for the default
runtime shard. `Reject` requires no grade or band and never qualifies for a runtime
shard. Progress counts are derived from those valid decisions. A completed tranche is
read-only unless the operator explicitly reopens it, which is permitted only when no
other tranche is active and returns it to `active`.

The review form orders UK-English eligibility, family friendliness, Curation Decision,
Commonness Grade, and, for nouns, Noun Semantic Band. No decision has an authoritative
default. `Accept` is unavailable until UK-English eligibility is true; family-friendly
false still permits acceptance but visibly explains that the candidate cannot enter the
default shard. With `Reject`, the grade and applicable band controls remain visible but
are disabled and greyed, with a not-allowed cursor, rather than hidden. Changing a saved
accepted candidate to `Reject` requires confirmation before its grade and band values are
cleared. Explicit **Use suggestion** actions sit beside the grade and band controls, and
the keyboard tab order follows the visible decision sequence.

Source suggestions and values from the previously published baseline are review evidence,
not new decisions. The initial #245 re-review requires the operator to adopt or replace
those values explicitly before a candidate counts as reviewed. In contrast, saved tranche
decisions are the authoritative curation state: reopening a completed tranche preserves
them, and unchanged candidates do not require reconfirmation. The operator records only
the required corrections and then explicitly completes the tranche again. Published
shard values remain available as a comparison point but never replace newer saved
curation decisions.

Initial review of an active tranche proceeds strictly from its first candidate to its
last, with no skipping or arbitrary backward or forward navigation. The only review
navigation actions are **Save & Next**, which validates and atomically persists the
current candidate before advancing to the next pending candidate, and **First pending**,
which resumes at the earliest candidate without a persisted valid decision. Leaving the
review surface with unsaved changes requires an explicit Save, Discard, or Cancel choice.
There is no autosave or bulk decision action. `Ctrl+Enter` invokes **Save & Next**, and
all decision controls follow a logical keyboard tab order. Successful saves update a
percentage-labelled progress bar immediately; validation failure retains the current
candidate and explains every missing or invalid decision.

Reopening a completed tranche uses a selected-candidate correction queue. From the
read-only tranche summary, the operator selects one or more candidates requiring
correction before reopening. Their saved decisions remain visible but are marked pending
correction; every other candidate remains complete and read-only. **First pending** and
**Save & Next** process only the selected candidates, in their original tranche order.
Each successful correction clears its pending marker, and the tranche requires another
explicit completion confirmation after no selected correction remains pending.

Completing a tranche returns to the register home screen and never activates its
successor automatically. When no tranche is active, **Start next tranche** explicitly
activates the earliest planned tranche in register order. **First pending** resumes an
existing active tranche but never starts a planned one. The deliberate pause between
tranches permits a review session to end or a completed tranche to be reopened for
correction before another full tranche commitment begins.

Every successful **Save & Next** persists valid progress to the working tree, and active
partial progress may be committed externally at any time. Completing or recompleting a
tranche creates a required local Git checkpoint for that tranche file and the matching
register-index state. **Start next tranche** remains unavailable until those exact files
are committed on the current branch. The workbench may read and display their Git state
but cannot stage or commit them, and unrelated working-tree changes do not affect this
gate. A commit checkpoint does not imply push, pull request, shard publication, or
deployment.

Focused validation must prove the pinned size-35-through-80 British/shared source
profile, baseline carry-forward, duplicate exclusion, complete exactly-once catalogue
assignment, 250-candidate limits, deterministic ordering, and automatic semantic-gap
assembly. It must cover Curation Decision combinations, noun and adjective metadata,
default-shard filtering, tranche lifecycle and sequential navigation, correction queues,
explicit activation, commit checkpoints, atomic and conflict-safe persistence, accessible
tooltips and keyboard order, disabled-control presentation, progress display, validation
messages, and unsaved-change protection. Deployment-surface tests must exclude `tools/`
from every hosted environment. Weight-policy tests remain deterministic and structural;
no statistical distribution test, phrase sample, semantic-distribution report, or
candidate-form report is required.

Completing a review tranche changes only the source-controlled register and curation
data. It never builds or publishes a shard, changes the manifest, stages or commits Git
state, or triggers deployment. A separately approved publication may incorporate
accepted candidates from one or more completed tranches into a new cumulative immutable
shard. Issue #245 publishes its approved noun baseline and semantic-gap outcome together
with the reviewed adjective replacement; later completed tranches may accumulate until
another publication is approved. Accepted-but-unpublished progress is derived by
comparing completed curation with the manifest-selected shard rather than recorded in a
second status ledger. Correcting a published decision affects only a later immutable
shard and never rewrites an existing shard.

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
candidate membership, repeat-avoidance inputs, and phrase rendering cannot
shift mid-game. Selection probabilities may change after an app load or
refresh because the global Entry Assist Weight Policy is deliberately not
Game-pinned.

If no valid Entry Assist Weight Policy is available, Entry Assist keeps the
authorised candidate source and uses the existing uniform selection and repeat
avoidance behaviour. Metadata-free seed fallback is also selected uniformly.
Policy failure must not substitute a different shard or Entry Kind, and dice is
disabled only when the existing candidate-source rules yield no candidates.
Manual entry remains unaffected.

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
  needed for source attribution, curation, UK-English eligibility, Commonness
  Grade and Noun Semantic Band selection, and later template categories.
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
