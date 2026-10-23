# Noun review: agreed boundaries and fresh validation

## Status

The operator accepted the recommended editorial package on 2 October 2026 and
approved its contrasting examples and fresh validation. The accepted boundaries
are owned by [product rules](../product-rules.md). This document owns calibration
applications and validation evidence, not a second set of product rules.
The fresh 100-noun dry validation and audit are complete. The operator approved
the first ten sequential decisions, and the visible local UI saved them on
22 October 2026. Their persistence and stopping boundary were verified below.
The tranche remains active with its remaining 240 positions untouched. No shard
or deployment has changed.

## Contrasting examples

These applications settle the recommended examples under the agreed rules.
They are research decisions for calibration, not replacements for saved rows.
Reject clears final grade and band. Family-friendly false is independent of
Accept/Reject. Additional checks for exact meanings or publication remain separate.

| Candidate | Inclusion and grade | Family-friendly | UK eligibility | Intended band when accepted |
| --- | --- | --- | --- | --- |
| aglet | Accept, rare | true | true | Made Objects |
| adze | Accept, rare | true | true | Made Objects |
| benthos | Reject for obscurity | true | true | — |
| acetylation | Reject for obscurity | true | true | — |
| afterbirth | Accept, common | false | true | Body |
| areola | Accept, lessCommon | false | true | Body |
| abuser | Accept, common | false | true | People and Groups |
| elbow | Accept, common | true | true | Body |
| midwife | Accept, common | true | true | People and Groups |
| age of consent | Accept, lessCommon, inferred | false | true | Measures and Relationships |
| rucksack | Accept, common | true | true | Made Objects |
| barrio | Accept, rare | true | true | Places |

The aglet and adze decisions deliberately use the ordinary-object exception:
their derived UK recognition is about 29%, but the terms remain current names
for practical objects. A British lace manufacturer describes and supplies
aglets, and separate British tool suppliers explain and sell adzes.
[Kalsi Tags](https://kalsitags.co.uk/category-information-page/shoe-boot-laces/),
[Woodsmith](https://www.woodsmith.co.uk/woodworking-tools/adzes),
[Toolnut](https://www.toolnut.co.uk/pages/adze-drawknives-froes-scorps)
The underlying lexical senses were read in the pinned reference and current
dictionary evidence recorded in the [original pilot](noun-review-automation-pilot.md).

Benthos has approximately 16% derived recognition; acetylation about 40%.
Both exclusions apply the agreed general-audience specialist boundary rather
than claiming the terms are obsolete. The grade guides apply to accepted words
and cannot require inclusion merely because recognition exceeds 35%.
Current specialist uses are established by the
[UK marine assessment](https://assets.publishing.service.gov.uk/media/623351f48fa8f504a2af7d23/Appendix_1a_2_-_Benthos.pdf)
and [NCBI biochemical entry](https://www.ncbi.nlm.nih.gov/medgen/7840).
The government's original report establishes British benthos usage. A current
[Oxford research abstract](https://www.cmd.ox.ac.uk/people/publication_modal/2406981)
establishes British acetylation usage; the NCBI entry alone is not a British
usage measure.

Afterbirth and areola have approximately 99% and 91% derived recognition
respectively. British patient information uses both exact nouns. They are false
under the accepted intimate reproductive-content boundary, not because clinical
language is inherently offensive.
[North Bristol NHS](https://www.nbt.nhs.uk/maternity-services/after-birth/postpartum-contraception/intrauterine-device-coil-at-caesarean-section),
[NHS areola usage](https://www.nhs.uk/conditions/pagets-disease-nipple/)
The general body-part and family-role anchors apply the permitted side of that
same editorial boundary. Age of consent is an inferred grade for a familiar
legal expression, not a fabricated survey result.
[Cambridge expression entry](https://dictionary.cambridge.org/dictionary/english/age-of-consent)

Barrio's derived UK recognition is approximately 37%. The regional dictionary
conflict was investigated rather than overridden by a section heading. Two
separate original British newspaper articles use the noun in neighbourhood contexts.
[March 2025 reporting](https://www.theguardian.com/global-development/2025/mar/30/acapulco-mexico-climate-crisis-extreme-weather-damage-hurricanes-otis-john-floods-landslides),
[July 2025 architecture reporting](https://www.theguardian.com/artanddesign/2025/jul/02/parque-prado-multi-storey-car-park-garden-paradise-colombia)
Combined with the British lexical entry, this supports a borrowed neighbourhood
noun. It does not imply that a foreign referent establishes eligibility by itself.
The sources share a publisher and are separate original reports, not independent
population-familiarity measurements.

## Frozen validation profile and sample

The local assessment profile is `output/noun-review-pilot/calibrated/policy-v3.md`,
SHA-256 `9841213572e94b8fe84b87702b5941a5be1f6102037c2b95455ffc88d9ece886`.
It was frozen before the fresh sample was selected or inspected. It applies the
accepted editorial rules to research proposals only. Original v1 and v2 results
remain unchanged.

The deterministic selection seed is
`crazyphrases-calibrated-noun-validation-2026-10-02-v3`. The sample contains
100 different catalogue candidates, excluding earlier pilot words, exposed
examples and calibration anchors. It reserves ten safety-pressure candidates,
eight regional candidates, twelve specialist candidates and eight compounds;
then selects two further candidates beginning with each letter A–Z and fills
the last ten places from untouched completed-review material for comparison.
These groups describe sampling pressure, not final classifications.

The source catalogue was regenerated through the repository's pinned input
loader and its identity hash matched the register. Catalogue size is 72,336.
The sample has exact recognition evidence for 53 candidates, SUBTLEX matches for
47 and exact pinned noun senses for 78. Missing data is part of the test.
Previously saved decisions, where available, were sealed separately. Assessors
received only text and external evidence, without ESDB suggestions or human labels.
Two assessors evaluated separate halves. A third independently checked 24
safety, meaning and part-of-speech pressure cases without seeing the primary
proposals or saved choices. All original proposals were sealed before comparison
labels were opened. This is an independent assessment process, not an independent
survey of the UK population or evidence from independent underlying corpora.

## Validation results

The frozen blind proposals contained 59 Accept, seven Reject and 34 Investigate
decisions. The existing workbench validator accepted 65 complete rows and blocked
35 incomplete rows. A complete row meets the form contract; that does not prove
its editorial judgements correct.

The evidence audit then changed seven proposals separately from that frozen
result. The resulting research set has 60 Accept, two Reject and 38 Investigate
decisions. Sixty rows are structurally complete: 58 Accept and two Reject. The
other 40 include two proposed accepts with unresolved family suitability. None
has been approved or saved by the operator.

| Required field | Resolved after audit | Remaining unknown |
| --- | ---: | ---: |
| UK-English eligibility | 79 | 21 |
| Family-friendly status | 89 | 11 |
| Accept/Reject | 62 | 38 |
| Grade and intended band for proposed accepts | 60 | 0 |

All 60 proposed accepts have an intended category: 32 use the pinned automatic
reference mapping and 28 require an explicit researched assignment. Every
automatic proposal was checked against all its exact pinned noun senses and the
existing eleven-band mapping. A researched assignment is not a second automatic
reference fallback and still requires operator adoption.

The useful category exceptions include muscle **abs**, where the reference only
supplies a plastics acronym, and wool **angora**, where its animal senses omit the
material meaning. The proposals select Body and Nature and Materials respectively.
**Melt** remains unresolved: recognising its familiar spelling as a verb cannot
establish familiarity with its sandwich, person or material noun meanings.
The actual dictionary checks are recorded in the local source audits.

## Audit findings and corrections

The audit found no false-safe proposal among the eleven clearly excluded safety
examples. Of 20 resolved safety comparisons with the independent audit, 19 agreed
and axeman conflicted. Two further audit expectations were themselves unresolved.
This small targeted check cannot estimate a general safety error rate.

- **Eggplant:** the original regional rejection was unsupported. Current RHS
  guidance recognises the alternative noun, and separate BBC British cooking
  material corroborates it. The revised proposal is UK eligible, Accept/common,
  family-friendly true, with a researched Food and Drink assignment. Its derived
  UK recognition is about 98%; weak subtitle exposure does not demote that result.
  This is an explained borrowing inference despite dictionary regional labels,
  not a claim that aubergine has ceased to be Britain's preferred name.
  [RHS guidance](https://www.rhs.org.uk/vegetables/aubergines/grow-your-own),
  [BBC cooking material](https://downloads.bbc.co.uk/tv/hairybikers/bestofbritish/taste_of_med.pdf)
- **Zip code, condo, fender-bender and yuk:** the original rejects treated regional
  dictionary labels as sufficient. They did not complete the current British
  usage assessment required by the agreed rules. They now retain unknown UK
  eligibility and Investigate. This does not assert that all four are British
  borrowings; it blocks unsupported exclusion until their exact noun use is checked.
- **Axeman:** Oxford supplies an attacking meaning; Collins supplies forestry,
  spending-cutting and musical meanings. The independent safety judgements conflict
  at the boundary between ordinary adventure vocabulary and excluded violence.
  Family suitability is now unknown. An attack example alone does not resolve
  the policy application, and selecting the benign meaning alone cannot make it safe.
  [Oxford meaning](https://www.oxfordlearnersdictionaries.com/definition/english/axman),
  [Collins meanings](https://www.collinsdictionary.com/dictionary/english/axeman)
- **Neurula:** the original false decision extended the intimate reproductive
  boundary to neutral vertebrate embryology. That application is not clearly
  established by the frozen rules, so family suitability is now unknown.

Ecstasy already retained unknown family suitability in the blind proposal because
the rules do not expressly settle its ordinary recreational-drug meaning. Skin
graft and xenograft also retained uncertainty; medical treatment or transferred
tissue does not automatically establish graphic content. These cases need a
reusable interpretation or more evidence before any delegated save. They do not
block research and processing of unrelated fully resolved candidates.

The two remaining rejections are **coelenterate** and **enantiomer**. Their modern
British existence is acknowledged. Approximately 10% and 7% recognition respectively,
very limited general exposure, and narrowly taxonomic or molecular meanings
converge on the specialist exclusion boundary. They are not rejected merely for
being scientific, old classifications or absent from a corpus.
[Collins coelenterate](https://www.collinsdictionary.com/dictionary/english/coelenterate),
[Natural History Museum record](https://www.nhm.ac.uk/our-science/data/uk-species/taxon?tvk=NHMSYS0000304833),
[Collins enantiomer](https://www.collinsdictionary.com/dictionary/english/enantiomer),
[RSC teaching use](https://edu.rsc.org/experiments/properties-of-stereoisomers/544.article)
Endosperm and chromatid were retained as rare with substantially higher recognition.
Alkyd was retained as a documented ordinary-material exception using British paint
guidance. The differences from specialist rejection are explained, not obtained
by accepting ESDB's rarity suggestions.
[Dulux consumer guidance](https://www.dulux.co.uk/en/articles/dr-dulux-answers-your-questions)

## Comparison with saved choices

Eleven fresh candidates had saved human choices. The following figures use the
original blind proposals, before audit corrections. Neither saved choices nor
agreement with them establish independent correctness under the new policy.

| Field | Comparable saved choices | Agreements |
| --- | ---: | ---: |
| UK-English eligibility | 9 | 9 |
| Family-friendly status | 11 | 11 |
| Accept/Reject | 8 | 6 |
| Grade, where both accepted | 6 | 3 |
| Intended band, where both accepted | 6 | 6 |

Abs and alkyd were proposed for acceptance where saved choices rejected them.
The muscle sense and the ordinary paint-material exception explain those
differences. Grades differ for adding machine, aniseed and auricle. Adding machine
is a qualitative rarity judgement; the other two follow recognition guides that
suggest lessCommon and rare respectively. These are observable differences for
operator review, not grounds for copying old labels into the assessor.

The sample deliberately overrepresents difficult cases. Its completion rate is
not a forecast of catalogue-wide coverage. Current contexts establish meanings
and currency; they are not familiarity percentages. The recognition and subtitle
sources remain historical, and overlapping corpora are not independent votes.

## Operational recommendation and verification

Use two stages: prepare and audit every required field, then apply complete
operator-approved rows through the existing sequential UI. Regional labels must
trigger a usage check rather than a hard rejection. Before a proposed obscurity
rejection passes the draft stage, its explanation must establish converging
evidence and check for ordinary current meanings. Safety conflicts remain blocked.
The audit stage is necessary: form completeness alone admitted unsupported decisions
in this test. These are corrections to applying the accepted rules, not new
runtime metadata requirements or changes to the semantic-reference boundary.

The first ten-row visible UI rehearsal below passed. The next action is to
prepare and audit the next sequential batch, beginning at position 11, before
seeking approval for those new decisions. Audit subsequent batches before
increasing their size. This validation does not justify unattended catalogue-wide
saving. Issue #245 remains open for its curation and publication scope.

Detailed source audits and original proposals are ignored local scratch in
`output/noun-review-pilot/calibrated/`. The original combined assessment SHA-256 is
`5d4016f9d44e90813bb8e1f9b721e3b9df528ce900884120a76905da8119a01f`.
`sealed-assessment-hashes.json` records the immutable policy, sample, evidence and
primary/audit proposals. `audit-reconciliation.json` records the seven later changes
without overwriting those originals. Existing workbench validation and exact
automatic-mapping checks passed. Closeout checks cover frozen evidence, all seven
review files, document links and whitespace. That dry validation did not exercise
live review or browser persistence. The separate UI trial is recorded below;
shard publication and deployment remain outside its scope.

## First sequential batch: saved and verified

The operator approved starting `noun-semantic-gap-004` and saving exactly positions
1–10 through the local UI. Before activation, the register and visible loopback
workbench agreed that the tranche was planned with no decisions. Its source files
and the approved proposal matched their preparation hashes, and the writer's
health identity and lock PID matched the designated review worktree. These were
the fixed next candidates, not a selection of easier words.

This table records the operator-approved batch verified after saving. The review
files remain authoritative; this is validation evidence rather than a second
progress register. Both rejected decisions have grade and band cleared; the
workbench omits those optional keys rather than storing explicit nulls. All ten
are UK eligible and family-friendly; acceptance and obscurity remain separate.

| Position | Exact noun | UK eligible | Family-friendly | Decision | Grade | Intended band |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | autograft | true | true | Reject | — | — |
| 2 | autosome | true | true | Accept | rare | Body |
| 3 | axial skeleton | true | true | Accept | rare | Body |
| 4 | celestial longitude | true | true | Accept | rare | Measures and Relationships |
| 5 | aflatoxin | true | true | Accept | rare | Nature and Materials |
| 6 | agamete | true, inferred | true | Reject | — | — |
| 7 | axilla | true | true | Accept | rare | Body |
| 8 | battercake | true, inferred borrowing | true | Accept | rare | Food and Drink |
| 9 | celestial pole | true | true | Accept | rare | Places |
| 10 | afterdamp | true | true | Accept | rare | Nature and Materials |

### Evidence and final editorial judgements

Only four candidates have exact UK recognition estimates: autosome approximately
34.5%, axilla 41.0%, battercake 46.6% and afterdamp 39.3%. The six missing results
are not zero recognition. Exact subtitle matches exist for aflatoxin and axilla.
The component-based wordfreq estimates for the three compounds are not measured
phrase frequencies. No ESDB rarity suggestion determined these recommendations.

**Autograft and agamete are qualitative specialist exclusions.** Autograft names
a graft or treatment distinguished by using the patient's own tissue or cells.
Current British patient information establishes use in several treatments, which
the exclusion acknowledges. It remains a narrow clinical source distinction in
the checked definitions and contexts, with low general textual exposure and no
established separate general noun meaning found in those sources. This supports
the proposed exclusion rather than a rule against all medical terms.
[Cancer Research UK](https://www.cancerresearchuk.org/about-cancer/treatment/bone-marrow-stem-cell-transplants/your-own-stem-cells),
[Royal Marsden patient booklet](https://patientinfolibrary.royalmarsden.nhs.uk/sites/default/files/documents/MY-1255-05.pdf)

Agamete names a particular asexual reproductive cell or stage in microscopic
organisms. The current dictionary and original research retain that narrow
meaning; none supplies an ordinary alternative meaning. The final recommendation
applies the specialist boundary using that positive meaning evidence together
with the lack of observed general exposure in the checked sources. It does not
claim a measured population-familiarity percentage, or infer exclusion from a
missing frequency entry alone. UK true is an explicit shared-technical-English
inference from the unqualified British lexical entry and actual use in an
Oxford-published research journal. That publication context corroborates technical
currency; its Japanese and Norwegian author affiliations do not establish British
authorship or British public familiarity. This is the least certain eligibility
judgement in the batch and is exposed for adoption rather than silently defaulted.
[Collins definition](https://www.collinsdictionary.com/dictionary/english/agamete),
[Original Oxford-published research](https://academic.oup.com/gbe/article/11/8/2232/5536717)

The independent audit retained inclusion uncertainty for both nouns. The final
recommendation favours exclusion because of their narrow verified meanings and
weak general exposure, while acknowledging real patient-facing and scientific
use. Neither noun is described as obsolete. Their family-friendly true proposals
apply neutral non-intimate clinical or microscopic biology meanings; the fact
that a source discusses surgery or reproduction does not itself make the noun
graphic or intimate content. These are specific applications for approval, not
a new rule that all grafting or developmental-biology words are safe.

**Autosome, axial skeleton and axilla retain uncommon anatomy.** Autosome's 34.5%
recognition lies close to the initial guide and is materially above the fresh
validation's very low recognition exclusions. Current British A-level assessment
corroborates the basic genetics distinction. Axial skeleton names the broad
central framework of bones and occurs in British sport examinations. Its rare
grade is inferred. Axilla denotes the familiar non-intimate armpit and has actual
current NHS patient usage alongside the 41% recognition result. The retention
judgements combine meanings, education or patient contexts and available norms;
they do not admit every anatomical subdivision.
[Pearson biology assessment](https://qualifications.pearson.com/content/dam/pdf/A-Level/Biology/2015/Exam-materials/9bi0-02-rms-20230817.pdf),
[OCR sport examination](https://www.ocr.org.uk/Images/704554-question-paper-body-systems-and-the-effects-of-physical-activity.pdf),
[Plymouth patient information](https://www.plymouthhospitals.nhs.uk/display-pil/pil-ultrasound-guided-axilla-core-biopsy-9153)

**Celestial longitude and celestial pole retain established astronomy vocabulary.**
The former means angular position along the ecliptic. The pinned reference instead
describes right ascension along the equator, so its automatic Places suggestion
does not settle the intended meaning. Measures and Relationships is the researched
assignment for the angle. Actual British amateur observation and museum usage
support an uncommon current idea. Celestial pole has current public observing and
school use, and retains Places for its sky location. Both rare grades are inferred.
[Oxford meaning distinction](https://www.mhs.ox.ac.uk/astrolabe/catalogue/Glossary/glossary.html),
[British Astronomical Association observation](https://britastro.org/journal_contents_ite/selenehelion-imaging-the-sun-full-moon-at-the-same-time-with-one-camera),
[Greenwich observing guide](https://www.rmg.co.uk/stories/space-astronomy/astronomy/night-sky-highlights-february-2026)

**Aflatoxin and afterdamp retain uncommon natural substances.** British garden
bird-feeding guidance and retail peanut information use aflatoxin for a practical
consumer concern beyond laboratory classification. This supports a rare inference
without claiming measured recognition. Afterdamp has about 39% recognition and
current British hazard guidance plus public museum teaching. Its mining association
does not establish obsolescence. Neither dangerous substance inherently denotes
graphic violence or serious abuse.
[BTO consumer guidance](https://www.bto.org/learn/helping-birds/feeding),
[RSPB retail description](https://shopping.rspb.org.uk/bird-food/peanuts/rspb-premium-peanuts.html),
[Coal Authority guidance](https://www.gov.uk/government/publications/guidance-on-managing-the-risk-of-hazardous-gases/guidance-on-managing-the-risk-of-hazardous-gases-when-drilling-or-piling-near-coal),
[Amgueddfa Cymru teaching pack](https://museum.wales/media/45813/Coal--A-Teaching-Resource-Pack--English1.pdf)

**Battercake retains a researched British food meaning.** Regional dictionary
labels identify the pancake meaning as US dialect. Separate British food contexts
support a broader batter-cooked cake meaning, including waffle. Slater used the
noun in 2010. [Original food writing](https://www.theguardian.com/lifeandstyle/2010/jun/20/nigel-slater-recipes-summer-cakes)
The current search-cached Sheffield retailer page uses it in its waffle description.
Direct retrieval timed out, so a freshly retrieved live page is not claimed.
[Original retailer](https://sugardessertsandco.com/)
Together these support a borrowing inference, not a claim that it is Britain's
preferred pancake name. The university corpus page repeats the older occurrence
and is not an independent third use. The 46.6% recognition result guides rare;
it does not identify which food interpretation each respondent recognised.

### Audit, validation and save boundary

Two primary researchers assessed separate halves, followed by an independently
prepared audit. Additional evidence and final reconciliation are identified in
the local notes. The audit initially held several inclusion judgements open;
its additional checks supported the battercake borrowing proposal. The final
recommendations above take editorial responsibility for the explained judgement
calls rather than claiming unanimous audit agreement or measured accuracy.
The independent caution on agamete's British context remains a material limit.

Five accepted bands follow all exact pinned noun senses: autosome, axial skeleton,
aflatoxin, celestial pole and afterdamp. Three are researched assignments:
celestial longitude corrects the reference meaning; axilla selects the human
armpit despite additional bird and botanical meanings in current dictionaries;
battercake selects the verified broader food meaning. These are explicit review
assignments, not another automatic semantic source.

The existing workbench curation validator accepted all ten complete proposed rows.
Exact roster text and sequence were checked against the first ten unchanged null
decisions before activation. Local scratch at
`output/noun-review-pilot/ui-batch-001/` contains the source notes, independent
audit, derived evidence and `prepared-decisions.json`. That proposal file has
SHA-256 `4E8F1967D68611C9E9B7607A53A3103D593DBC73D8D20054B8D4AC1DB5DD6344`.

The visible UI started the tranche and saved only positions 1–10. Before every
save, the displayed noun and selected fields were checked against the approved
batch. After each save, the next noun and progress were checked in the UI and
the authoritative JSON was read to verify persisted fields. All ten matched:
eight Accept/rare and two Reject. The register is active, with 10 of 250 reviewed
(4%) at this validation snapshot. No Complete Tranche action was performed.

The batch stopped at position 11, agamid, with every control unselected. A page
reload returned to the register, which retained the active tranche and 4%
progress. First pending reopened agamid without changing it. All 240 later
candidate records were compared with their original committed records and were
unchanged; the five other review files still matched their pre-research hashes.
Only the register lifecycle and this tranche's first ten decisions changed.
`execution-validation.json` records the final checks and tranche hash, and
`workbench-after.png` shows the stopping point. Git whitespace checks passed.

An initial pointer selection did not check the intended UK radio after help
expanded. Keyboard Space selected it successfully. Subsequent form selections
used Space on the named radio controls, and Enter on Save and Next; selected-state
checks preceded every save. A future UI driver should use this verified keyboard
route and check the resulting state rather than assume pointer clicks selected
the requested value. The method avoided changing UI implementation in this task.

This was authorised operation of an existing tool. The ask-matt route was
reassessed; no software engineering or new code was needed, so no engineering
stages were bypassed. The research evidence and this execution result remain
separate. Review changes are local and uncommitted; there was no tranche-completion
checkpoint, push, shard publication or deployment. Issue #245 remains open and
no implementation ticket is completed by this ten-row trial.
