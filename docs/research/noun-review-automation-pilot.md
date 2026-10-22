# Noun review automation pilot

## Finding and status

The dry run completed on 2 October 2026. Evidence gathering and draft assessment
can cover every required noun-review field. The tested rules are not ready for
unattended saving: they leave many candidates unresolved and differ from saved
choices on some safety, UK eligibility and grade decisions. Category suggestions
were consistent with saved choices where a comparison was possible.

The original experiments remain candidate research. The subsequent editorial
package has been accepted in product rules and tested in
[calibrated validation](noun-review-calibrated-validation.md), which owns the
current findings and recommended next action. No review decision,
register, runtime shard or deployment was changed. The webpage was not driven or
tested in this pilot. The proposed UI driver below remains implementation work.
[Product rules](../product-rules.md) still own operator approval and the sole
automatic semantic-reference boundary.

## Evidence and method

The study combines UK adult word-recognition estimates, observed British noun
usage, broader English frequency and individual lexical checks. ESDB suggestions
and saved grades were withheld from assessment. Detailed source identities,
download hashes, transformations and limitations are in
[source checks](noun-review-pilot-source-notes.md).

- The recognition workbook is the publisher's complete supplementary ESM 2
  file. UK values were derived by reversing its documented transformation, not
  by interpreting frequency as a recognition percentage.
- SUBTLEX-UK supplied noun counts separately from adjective, verb and name use.
  Its BBC material dates from 2010–2012. Recognition research was published in
  2018; neither source establishes today's usage by itself.
- `wordfreq` 3.1.1 supplied a broader frequency cross-check. It includes SUBTLEX
  data, so the two sources are not independent votes. Compound estimates were
  not treated as measured phrase frequency.
- Exact noun senses came from the repository's pinned Open English WordNet 2025
  archive, SHA-256
  `7D749F6E2C39E6970E4997839DCF6E42FD281F3C2FAE0171D2192BAE8CFA4B51`.
  All matched senses had to map to one existing Noun Semantic Band.
- Targeted dictionaries, NHS material, government publications and public
  guidance checked meanings, regional labels and present-day contexts. A
  dictionary entry establishes a meaning, not general familiarity or frequent
  contemporary British use.

The read-only source was the active issue #245 review worktree's register and
completed noun tranches: 990 reviewed nouns. The first sample selected 100 nouns
across accepted grades, rejects and compounds. Its assessment was frozen before
saved labels were opened. A revised policy then assessed 40 different nouns,
deliberately including six saved unsafe cases and four saved UK-ineligible
cases. Its complete field proposals were also frozen before comparison.

Selection used saved labels only to construct the samples; assessors received
word text and separate source evidence. The second sample was not exposed during
the first comparison. Both samples are diagnostic, not representative random
samples of the 72,336-candidate catalogue. Much expansion material is early in
alphabetical order. These figures are agreement with earlier choices, not proven
accuracy against an independent truth standard.

## Results

The first 100-word policy proposed 37 accepts, four rejects and 59 investigations.
Forty of the 41 resolved dispositions matched saved choices, but only four of
37 comparable grades matched. Frequency cutoffs systematically downgraded known
nouns: saucepan, notebook and pudding became `lessCommon` instead of `common`.
Only 64 words had exact recognition evidence and 47 had exact SUBTLEX matches.

The second policy prioritised recognition: at least 95% suggested `common`,
75–95% `lessCommon`, and 35–75% `rare`, with observed noun usage required. These
are hypotheses, not validated product thresholds. Very low recognition and
missing norms triggered further research rather than automatic rejection.

| Field in the fresh 40-noun sample | Resolved proposals | Comparable saved choices | Agreements |
| --- | ---: | ---: | ---: |
| UK-English eligibility | 39 | 39 | 36 |
| Family-friendly status | 39 | 39 | 37 |
| Accept/Reject | 18 | 18 | 17 |
| Commonness Grade | 18 | 17 accepted by both | 13 |
| Noun Semantic Band | 35 reference suggestions | 26 saved accepts | 26 |
| Complete row, including all required fields | 15 | 15 | 8 |

All 18 resolved dispositions were Accept. The other 22 required investigation.
Three accepts still lacked a single category, leaving 15 complete rows. The
existing workbench's `validateCurationDecision` accepted those 15 draft rows;
all 25 incomplete rows failed validation and were excluded from readiness.
This checks row structure, not semantic correctness or successful UI saving.

The recognition change improved grade agreement on a fresh sample. It does not
establish that numeric thresholds alone can finish the review. This second
sample produced no obscurity rejects, so it provides no fresh validation of
automatic exclusion for arcane vocabulary.

## Cases that change the proposed approach

| Case | Evidence or difference | Consequence for automation |
| --- | --- | --- |
| saucepan, notebook, pudding | High recognition despite modest corpus frequency | Familiarity should lead grading; infrequent mention is not obscurity. |
| adamant, adept | Familiar spellings with usage dominated by other parts of speech | Check the noun meaning before transferring recognition to it. |
| acetylation, ablaut, affricate | Verified current technical senses; the first policy proposed rejection | Technical vocabulary can be current yet too obscure for the game. Current existence alone is not an inclusion rule. |
| benthos | Low recognition and technical marine-ecology use; the first policy rejected a saved `rare` accept | This could be a deliberate stricter inclusion boundary. Agree that boundary rather than calling every disagreement an error. |
| acrylamide, advection | Food Standards Agency or Met Office public explanations | Do not infer exclusively specialist use from a technical definition. |
| aglet, adze | Current names for practical objects, with low recognition | Decide whether unfamiliar everyday-object names belong in `rare` or should be excluded. |
| afterbirth, areola | The pilot allowed clinical/anatomical terms; saved safety labels were false | Neutral dictionary language does not settle suitability for family play. |
| arse, age of consent | Explicit offensive or sexual meanings | Safety can be false independently of rarity and category. |
| abortion, abortionist | The pilot found offensive secondary senses and proposed safety false | Read relevant noun senses, not only the neutral clinical meaning. |
| barrio, anlage, accoucheur | Dictionaries list British entries; saved UK eligibility was false | Overseas origin alone does not establish UK ineligibility. Read regional labels as well as section headings, and establish contemporary British use. |
| peppermint, boot | Matched senses cross existing bands | Assign one intended category explicitly; do not select the first sense. |
| allemande, acervulus | Current dictionaries expose meanings missing from the extracted WordNet senses | A technically single-band reference result may be incomplete. Keep these as sense-resolution exceptions. |
| book-end, pencil case | Exact variant/reference gaps or compound evidence gaps | Research the complete expression; do not inherit component-word scores. |

For examples of the targeted primary evidence, see the
[Food Standards Agency](https://www.food.gov.uk/food-safety-and-hygiene/chemical-food-safety),
[Met Office](https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/fog),
[UK benthos assessment](https://assets.publishing.service.gov.uk/media/623351f48fa8f504a2af7d23/Appendix_1a_2_-_Benthos.pdf),
British dictionary entries for
[barrio](https://www.collinsdictionary.com/dictionary/english/barrio),
[anlage](https://www.collinsdictionary.com/dictionary/english/anlage) and
[accoucheur](https://www.collinsdictionary.com/dictionary/english/accoucheur), and
the dictionary entries for
[abortion](https://dictionary.cambridge.org/dictionary/english/abortion),
[allemande](https://www.collinsdictionary.com/dictionary/english/allemande) and
[acervulus](https://www.collinsdictionary.com/dictionary/english/acervulus).

## Proposed complete automation

An offline assessor should prepare a proposal for each displayed candidate,
with five independent fields: UK eligibility, family friendliness,
Accept/Reject, Commonness Grade and Noun Semantic Band. Reject clears grade
and band but still requires the two booleans. Family-friendly false is a safety
label, not automatically Reject; current default shards exclude those candidates.

For obscurity, assess recognition and observed noun use first, then investigate
specialist-only, obsolete, regional, name and compound cases against current
sources. Low counts or a missing corpus entry cannot prove vanishing usage.
Each exception needs a short sourced explanation. Strong evidence may support
Reject for general-audience obscurity even when a word remains current in a
specialist discipline. Evidence collection should stop when it can support the
agreed boundary, rather than research every noun to the same depth.

For category, use the existing exact WordNet mapping automatically where it
resolves one band. Resolve cross-band or incomplete senses separately using
the word's intended game meaning. For family friendliness, inspect noun meanings
and usage labels against an agreed family-audience rule. An absent offensive tag
is insufficient evidence for true. Unresolved fields remain explicit exceptions.

Once calibrated, the UI driver should read the displayed candidate identity,
fill every required control, read the values back, and press the existing Save
button once. It should verify the saved result and expected next candidate before
continuing. A durable local checkpoint should record candidate identity, source
evidence, approved proposal and observed save result, so an interruption cannot
skip or repeat a decision. It should stop on identity mismatch, validation error,
unexpected navigation or uncertain persistence. No direct file write or new bulk
save endpoint is required. Browser execution must follow the
[in-app browser runbook](../runbooks/in-app-browser-verification.md).

This approach can shift the user's work from reviewing every noun to agreeing
a small set of rules and occasional unresolved groups. The pilot has not yet
shown the coverage or reliability needed to promise that reduction at catalogue
scale.

## Recommended boundaries for calibration

The operator accepted this editorial package on 2 October 2026. The following
proposal records the reasoning behind that decision; the current accepted rules
are owned by [product rules](../product-rules.md). The contrasting applications
and fresh test are recorded in
[calibrated validation](noun-review-calibrated-validation.md). Adoption does not
authorise live saves or replace previous saved decisions.

### Familiarity and exclusion for obscurity

Use an ordinary contemporary UK adult audience for familiarity. Family suitability
is a separate content decision: a child need not know every family-friendly word.
Allow an uncommon name for an understandable everyday object, creature, place,
activity or idea to remain `rare`, provided that current use is established.
Do not let that exception admit arbitrary technical subdivisions merely because
they describe a physical object.

Reject for obscurity when evidence converges on a word being obsolete in ordinary
use or confined to a narrow specialist vocabulary, with very low general
recognition or exposure and no established general noun meaning. A short,
understandable definition can help explain a decision but does not demonstrate
familiarity. Missing norms, low counts and a technical subject label are each
insufficient on their own.

Recommend retaining aglet and adze as `rare`, subject to current-use checks, and
rejecting benthos and acetylation for general-audience obscurity on the combined
pilot evidence. These are proposed anchor decisions, not changes to saved rows.
Aglet's practical object sense is supported by
[Collins](https://www.collinsdictionary.com/dictionary/english/aglet). Benthos's
modern specialist use is established by the government assessment linked above;
acetylation's biochemical role is established by
[NCBI](https://www.ncbi.nlm.nih.gov/medgen/7840). Neither specialist source alone
demonstrates unfamiliarity; the recognition and usage findings supply that part
of the pilot evidence. Public-facing mention, as with acrylamide or advection,
requires assessment of breadth and the actual noun sense rather than automatic
acceptance.

Keep the tested recognition bands as initial grading guidance: at least 95%
suggests `common`, 75% to below 95% `lessCommon`, and 35% to below 75% `rare`.
Below 35% triggers targeted assessment, including the ordinary-object exception;
it does not automatically mean Reject. These cutoffs do not establish precise
audience knowledge and must not override a part-of-speech or meaning conflict.
Low corpus frequency cannot demote a strongly recognised noun by itself.

When recognition data is missing, infer a qualitative grade from contemporary
noun usage and lexical evidence, clearly recording that it is an inference.
Read actual contexts and their source dates rather than search hit counts.
Corroborate unfamiliar or borderline cases in separate original sources;
repeated dictionary copies and overlapping frequency datasets are not independent
support. Missing data should create additional research, not permanently exclude
most of the catalogue from automation. If the evidence remains insufficient,
leave the draft unresolved.

### Suitability for family play

Recommend a conservative content rule for ordinary mixed-age family play with
school-age children. This is an editorial choice, not an age certification.
Mark false for profanity, slurs, explicit sexual terms, intimate reproductive
anatomy or processes, graphic bodily material or violence, self-harm, and terms
whose usual meanings centre on serious abuse. An ordinary offensive or adult noun
meaning is enough to mark false even when another meaning is neutral.

Permit ordinary body parts, neutral non-intimate health vocabulary, familiar
family roles, and ordinary adventure or fantasy vocabulary. Negative feelings,
religion, cultural origin and identity are not grounds for false. Neither a
neutral medical label nor a remote offensive sense settles the decision: assess
meanings reasonably encountered today, including common British slang, and do
not invent unsafe meanings from possible phrase combinations.

Under this proposal, afterbirth and areola are false, matching their saved labels.
Abortion, abortionist, arse, age of consent and abuser are also proposed false.
Elbow, skeleton, baby and midwife illustrate the permitted side of the boundary.
Neutral procedures such as adenoidectomy are not automatically false; they can
still fail the separate obscurity test. Rarely encountered historical adult
meanings should be exceptions for investigation, rather than a universal rule
that any adult dictionary sense makes the whole word false.

False remains a safety label. It does not automatically mean Reject, and the
current default publication filter continues to exclude false candidates. An
unresolved safety proposal never becomes true merely because a blocklist found
no match.

### Contemporary British vocabulary

Retain the existing domain definition: accepted contemporary British vocabulary,
including shared and borrowed words, while excluding outside-UK-only spellings
and senses. A word may refer to an overseas place, object or culture and still
qualify. Familiarity and specialist status belong to the inclusion and grade
decisions rather than being disguised as UK ineligibility.

Use the exact spelling and noun meaning. Read dictionary usage labels, variant
notes and examples. A clear contemporary unqualified British entry is positive
lexical evidence. US-only, dated, specialist, conflicting or merely generic
dictionary entries need corroborating British contexts from an identifiable
source. For a disputed case, seek original usage in more than one source rather
than repeated glossaries. One occurrence or a dictionary section heading is not
enough to resolve a conflict. Lack of a search result leaves eligibility unknown;
it does not prove false.

The barrio pilot proposal particularly needs reassessment: Collins includes a
British English section but its COBUILD meanings carry US or mainly-US labels.
That is conflicting evidence rather than an automatic true decision.
[Collins barrio entry](https://www.collinsdictionary.com/dictionary/english/barrio)
Accoucheur's British entry establishes a lexical meaning, not general current
familiarity; it may pass UK eligibility while failing inclusion for obscurity.
[Collins accoucheur entry](https://www.collinsdictionary.com/dictionary/english/accoucheur)
Research alone must not expand the existing ESDB spelling-profile admission
rules or silently substitute a different spelling.

## Adoption and validation method

The next-stage method described below has been applied in
[calibrated validation](noun-review-calibrated-validation.md), which owns its
current status and results. Preserve this pilot's original proposals and
comparisons as evidence of the earlier rules.

The method freezes a written assessor policy and tests it on 100 untouched candidates,
covering the whole alphabet, with deliberate representation of proposed
obscurity rejects, safety false cases, regional conflicts, compounds, ambiguous
categories and missing recognition data. Where already-reviewed material does
not cover the alphabet, use unreviewed candidates and distinguish them from
cases with saved comparison labels. Review the evidence behind complete rows as
well as field agreement, so shared mistakes and confident but unsupported
judgements are visible.

The validation report should show complete-row coverage, justified exclusion
decisions, safety and regional mistakes, and systematic grade differences.
Any unresolved safety or UK conflict blocks that row. Any discovered false-safe
decision or unsupported obscurity rejection requires correction and a fresh
targeted check before scaling. Zero observed failures in a small sample is not a
guarantee; retain a sampled audit of subsequent completed batches. Do not require
perfect reproduction of old labels where the accepted new policy deliberately
changes the judgement.

Category exceptions still need one proposed intended sense and one existing
band. Their resolution must remain consistent with the product rules' semantic
reference and operator-approval boundary. Adoption of editorial rules does not
by itself approve every unresolved category or rewrite earlier decisions.

After the policy test, implement and verify a small UI batch under explicit
delegated curation authority. Research exceptions in the draft stage before
trying to advance a sequential tranche; the driver must not skip required
decisions. Increase batch size only when field completeness and persistence have
been verified. Issue #245 remains open; this research does not complete its
curation, publication or deployment scope.

## Reproduction and validation evidence

Local scripts, original reference files, sealed labels and detailed derived
results are ignored scratch under `output/noun-review-pilot/`. They are not a
production tool or a portable checked-in dataset. Original data redistribution
rights were not fully established; retain citations and library notices.

The initial selection seed was
`crazyphrases-noun-obscurity-pilot-2026-10-02-v1`; the fresh sample seed was
`crazyphrases-full-metadata-validation-2026-10-02-v2`.
The first frozen assessment SHA-256 was
`e3af64892d2ebe4d3a05cd83dbc9477c6fd1b08cd03864f674f3d85f1d72d892`;
the fresh full-field assessment SHA-256 was
`692d9b12470839ba035c1a8359e9cbddf94c9acdfdb68d023b43a52818f1ad7a`.
Comparison scripts verified the sealed assessment inputs before opening labels.
The local `full-metadata/draft-workbench-rows.json` contains all 40 draft rows,
their explanations, URLs, validation errors and readiness, without approval.

The final integrity check compared all seven original register/tranche hashes
with the files used to select the pilot. All were unchanged. Documentation
validation checked the research links and whitespace. No frontend, browser,
shard-build or deployment success is claimed.
