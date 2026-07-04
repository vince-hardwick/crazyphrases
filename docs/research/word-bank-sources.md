# Word Bank Source Candidates

## Status

Research completed on 2026-07-04. The recommended source path for the next
design/PRD slice is:

1. Use **ESDB / SCOWL v2** as the lead candidate for the production global Word
   Bank.
2. Use **AGID** only as a morphology supplement when future templates need
   participles or inflection-specific Entry Kinds that ESDB does not expose
   cleanly enough.
3. Keep the old **POS / Moby plus WordNet** database as a fallback and
   comparison source, not as the preferred foundation.
4. Treat **Princeton WordNet via NLTK** and **Open English Wordnet** as semantic
   reference sources, not complete game-ready word banks.
5. Defer **Wiktionary** unless the above sources cannot support future roadmap
   Entry Kinds; dump size, parsing complexity, and share-alike licensing make it
   a poor first production source.

This is a research recommendation, not an accepted runtime delivery boundary.
No ADR is required until the project chooses a production delivery model such as
static/CDN shards, Supabase-backed RPC/prefetch, or another durable service
shape.

## Project Fit Criteria

The default Word Bank must support low-latency dice-click Entry Assist for the
current adjective-noun-noun default template. Future custom templates need room
for built-in Entry Kinds such as adverb, verb, participle, article/determiner,
preposition, pronoun, conjunction, and interjection.

The adopted source must be:

- licensable and redistributable with clear attribution;
- filterable into family-friendly candidates;
- usable as local or cached shards rather than synchronous API calls;
- able to separate current adjective and noun candidates from future Entry
  Kinds;
- practical to refresh in an offline build/import pipeline.

## Profiling Method

Candidate archives were downloaded into:

`%TEMP%\crazyphrases-word-bank-research\downloads\`

Scratch reports and deterministic sample packs were generated under:

`%TEMP%\crazyphrases-word-bank-research\reports\`

The scratch profiler used conservative game-ready filters:

- ASCII alphabetic single tokens only;
- lowercase-only to suppress obvious names and acronyms;
- no spaces, hyphens, apostrophes, digits, abbreviations, or open compounds;
- obvious name/proper-noun classes excluded where the source exposed them;
- a small profiling-only profanity screen, with the remaining safety work kept
  as a separate curation requirement.

These counts are not final production counts. They estimate whether each source
can support Crazy Phrases after a first pass of v1 filtering.

The single-token/no-hyphen/no-open-compound filters were profiling shortcuts,
not accepted product constraints. ADR 0024 now treats production Word Bank
candidates as curated lexical entries for one Entry Kind. Production curation
may include single words, hyphenated words, and reviewed open compounds when the
candidate behaves as one noun, adjective, or other Entry Kind.

## Download And Licence Evidence

| Source | Download route used | Version pinned | Licence / redistribution notes | Practical notes |
| --- | --- | --- | --- | --- |
| ESDB / SCOWL v2 | `https://github.com/en-wl/wordlist/archive/1e5b7d3a72f47a71da5d28686c1dd4b397178485.zip` | v2 branch commit `1e5b7d3a72f47a71da5d28686c1dd4b397178485` | README says the combined work is MIT-like and derived from BSD-compatible sources; keep the upstream `Copyright` attribution. | Best overall fit. Includes commonness/size, dialect, spelling variants, basic POS, and inflection data. The schema/CLI is still work in progress, so pin exact revisions. |
| Old POS / Moby plus WordNet | `https://downloads.sourceforge.net/project/wordlist/POS/Rev%201/pos-1.zip` | Rev 1, July 23 2000 database | README says `part-of-speech.txt` combines Moby Part-of-Speech II and WordNet; keep source notices. | Broad raw coverage and simple `word<TAB>tags` format, but old tags are coarse and participles are not separated reliably. |
| AGID | `https://downloads.sourceforge.net/project/wordlist/AGID/2016.01.19/agid-2016.01.19.zip` | `agid-2016.01.19` | Distributed from the SCOWL/wordlist project; keep upstream README and notices with any derivative build process. | Strong morphology supplement. Useful for present and past participles; weak for playability, frequency, safety, and function words. |
| Princeton WordNet via NLTK data | `https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip` | NLTK `wordnet.zip` downloaded 2026-07-04 | Princeton WordNet licence permits use, copy, modification, and distribution with required notices and no Princeton endorsement. | Good semantic lemma source for noun, adjective, adverb, and verb; not enough by itself for game-ready candidates or function-word Entry Kinds. |
| Open English Wordnet 2025 | `https://en-word.net/static/english-wordnet-2025-json.zip` | 2025 Edition JSON, release commit `dc343f2683279ecbb13fab4e2fd778d7b162d287` | Released under CC-BY 4.0; attribution required. | Current semantic wordnet with clean JSON and core common-word edition. It intentionally excludes the 2025+ proper-noun-heavy Namenet data from this profile. |
| Wiktionary | `https://dumps.wikimedia.org/enwiktionary/latest/` | Not downloaded | Wikimedia dump reuse is tied to Wikimedia licence terms; English Wiktionary content is generally share-alike. | Deferred. The 2026-06 latest current-page dump page listed `enwiktionary-latest-pages-meta-current.xml.bz2` at about 1.9 GB compressed, before parsing. |

Downloaded archive SHA-256 hashes from the 2026-07-04 scratch run:

| Archive | SHA-256 |
| --- | --- |
| `esdb-v2-1e5b7d3.zip` | `4A9ACD18D0C16ED595D11458A2DBC226C8A91F93C89970C0F4506444A8F4B161` |
| `pos-1.zip` | `167D72D7F18D23A328E17EC3DDE8BC80913D1B7460943BF01F04EBA1E5BC80DE` |
| `agid-2016.01.19.zip` | `561266F842D6AA09DA09FBF68E919EE9E1D32BBDCD435E6A0DF51546D35A4E91` |
| `nltk-wordnet.zip` | `CBDA5EA6EEF7F36A97A43D4A75F85E07FCCBB4F23657D27B4CCBC93E2646AB59` |
| `nltk-omw-1.4.zip` | `3B941E664852F3297B6040236626065796A2AAF7D7F9EEC8779A3BEAA1096C2D` |
| `english-wordnet-2025-json.zip` | `7D749F6E2C39E6970E4997839DCF6E42FD281F3C2FAE0171D2192BAE8CFA4B51` |

## Candidate Counts

Counts below are filtered unique candidates by Crazy Phrases Entry Kind. Zero
means the source does not expose that category in a useful way under the
conservative profile.

| Source | Raw rows / members | Filtered unique words | Adjective | Noun | Adverb | Verb | Present participle | Past participle | Article / determiner | Preposition | Pronoun | Conjunction | Interjection |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ESDB / SCOWL v2 | 246,039 | 86,952 | 17,953 | 45,819 | 5,668 | 9,441 | 9,208 | 9,406 | 0 | 99 | 84 | 80 | 272 |
| Old POS / Moby plus WordNet | 295,172 | 156,808 | 48,646 | 82,780 | 12,916 | 27,053 | 0 | 0 | 101 | 153 | 104 | 84 | 350 |
| AGID | 112,505 | 120,103 | 7,163 | 76,210 | 7,163 | 15,891 | 15,841 | 16,147 | 0 | 0 | 0 | 0 | 0 |
| Princeton WordNet via NLTK data | 153,972 | 77,455 | 17,861 | 55,145 | 3,627 | 8,419 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Open English Wordnet 2025 | 185,129 | 64,840 | 17,250 | 42,539 | 3,637 | 8,448 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Static Delivery Size Check

The ESDB profile is small enough for static or CDN-hosted shards:

| ESDB shard set | Candidate entries | Minified JSON bytes | Gzip bytes |
| --- | ---: | ---: | ---: |
| Current adjective+noun support | 63,772 | 737,502 | 214,491 |
| Future core POS without function words | 97,495 | 1,131,458 | 323,052 |
| Future core POS with function words | 98,030 | 1,135,801 | 324,862 |

This supports the default recommendation to design production delivery around
static per-Entry-Kind JSON shards first. A Supabase RPC/prefetch service should
remain a later option if final curated shards become too large, need dynamic
per-account filtering, or need server-side update cadence.

## Scoring

Scores use 1 = poor, 3 = workable, 5 = strong.

| Source | MVP adjective/noun | Future POS coverage | Licence clarity | Family-friendly support | Commonness / playability controls | UK/US controls | Parser complexity | Update stability | Static-shard fit | Summary |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ESDB / SCOWL v2 | 5 | 5 | 4 | 3 | 5 | 5 | 3 | 3 | 5 | Best overall source if pinned and built in a controlled pipeline. |
| Old POS / Moby plus WordNet | 4 | 3 | 3 | 1 | 1 | 1 | 5 | 2 | 4 | Useful fallback with broad counts, but too coarse as the lead source. |
| AGID | 2 | 4 | 3 | 1 | 1 | 1 | 3 | 2 | 4 | Valuable for participles and inflections only. |
| Princeton WordNet via NLTK data | 4 | 2 | 4 | 1 | 2 | 1 | 4 | 4 | 4 | Useful semantic reference, not complete enough for roadmap categories. |
| Open English Wordnet 2025 | 4 | 2 | 4 | 1 | 2 | 1 | 4 | 4 | 4 | Current and clean semantic reference; still not a game-ready Word Bank. |
| Wiktionary | 2 | 5 | 2 | 1 | 1 | 3 | 1 | 4 | 1 | Defer until other sources fail; too large and licence-heavy for v1. |

## Recommendation

Use ESDB / SCOWL v2 as the primary production Word Bank candidate for the next
design and PRD slice.

The next slice should design a pipeline that:

- pins an ESDB v2 commit;
- runs ESDB generation in a Unix-like CI/container environment rather than
  relying on ad hoc Windows import;
- exports per-Entry-Kind static shards for the built-in Crazy Phrases Entry
  Kind vocabulary;
- applies a separate family-friendly curation layer because ESDB's own usage
  notes explicitly mark only some offensive/vulgar words;
- keeps AGID available as a supplement for participle-specific future templates;
- avoids bundling the full production Word Bank into the main client bundle.

Do not adopt a live word API, synchronous LLM call, or Supabase RPC service for
the first production Word Bank implementation. Static per-Entry-Kind shards are
small enough after conservative filtering and fit the existing cached Word Bank
architecture in ADR 0004
(`docs/decisions/0004-cached-word-bank-for-entry-candidates.md`).

## Open Risks

- The ESDB v2 schema and CLI are still marked as work in progress. Pinning and
  generated-output tests are required before implementation.
- The Windows scratch run could not create `scowl.db` through the official
  import path because accented source entries failed parsing without the full
  upstream build flow. Production extraction should run in a Unix-like build
  path or container.
- The profiling safety filter is intentionally minimal. A real curation pass
  needs a maintained blocklist, human sample review, and source-specific usage
  note handling.
- Counts do not prove comedy/playability. Human sample review is still required
  before replacing or expanding `assets/word-bank-seed.json`.
- The scratch counts understate final candidate potential because the profiling
  pass excluded hyphenated words and open compounds. Production curation should
  evaluate those forms deliberately rather than inheriting the scratch filter.
- Function-word Entry Kinds such as article/determiner may need manual seed
  lists even if the main Word Bank comes from ESDB.
