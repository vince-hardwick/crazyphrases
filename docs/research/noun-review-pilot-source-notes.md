# Noun review pilot: source checks

## Status and scope

Verified on 2 October 2026 for the proposed dry-run noun review. These notes
describe research evidence and its limits; they do not establish a curation
policy. No saved human decisions or pilot nouns were inspected for this check.

## Recognition evidence

Brysbaert and colleagues' study reports 61,858 tested words and over 220,000
participants. It was published online on 2 July 2018, with a 2019 issue date.
The publisher provides two supplementary Excel files. Both downloaded from the
official links; ESM 2 is the complete prevalence workbook, while ESM 1 contains
analysis data. [Publisher article and supplementary downloads](https://link.springer.com/article/10.3758/s13428-018-1077-9)

The manuscript describes self-reported recognition by native speakers from the
UK and US, averaging 106 UK respondents per word. This is recognition of the
spelling and most familiar meaning, not a test of every noun sense or a measure
of current usage. Its vocabulary is mostly uninflected forms. [Accepted manuscript](https://pure.royalholloway.ac.uk/ws/portalfiles/portal/38776763/Accepted_Manuscript.pdf)

Inspection of the downloaded ESM 2 workbook found these sheets:

| Sheet | Columns |
| --- | --- |
| `Prevalence` | `Word`, `Pknown`, `Nobs`, `Prevalence`, `FreqZipfUS` |
| `UK vs US` | `Word`, `Prevalence_UK`, `Prevalence_US` |
| `Male vs Female` | `Word`, `Prevalence_Male`, `Prevalence_Female` |

Each has 61,855 data rows plus a header. Use this observed file count rather than
assuming that every tested word appears in the published workbook. `Pknown` is
the pooled recognition proportion; `FreqZipfUS` is American subtitle frequency,
not recognition. The UK sheet gives transformed recognition scores. To derive
an approximate UK recognition proportion from score `z`, use
`(Phi(z) - 0.005) / 0.99`, where `Phi` is the standard normal cumulative
distribution. This reverses the authors' stated transformation; label the result
as derived. Frequency scores must never be converted into recognition
percentages. [Publisher's transformation note](https://link.springer.com/article/10.3758/s13428-018-1077-9#Notes)

The paper and publisher page identify the data as available supplementary
material, but an explicit dataset redistribution licence was not established.
Keep the original files and citations with research evidence; this check does
not authorise republishing the complete dataset. The OSF page returned HTTP 403
through the web tool and its API returned HTTP 500 through PowerShell; the
official publisher downloads succeeded.

## British usage evidence

SUBTLEX-UK counts words in BBC subtitles from January 2010 to December 2012.
It therefore provides British exposure evidence, with an age limitation. The
cleaned word file has total frequency, contextual diversity, children's-channel
counts, noun and other part-of-speech counts, capitalisation, spelling and
compound fields. These are observations of usage, not percentages of people
who recognise words. [SUBTLEX-UK paper](https://www.tandfonline.com/doi/full/10.1080/17470218.2013.850521)

The official download page supplies cleaned Excel/text files, an uncleaned file,
and bigrams. The cleaned Excel and text archives downloaded successfully. The
text file has 160,024 data records and 27 columns; the download page describes
160,022 word types. Record this discrepancy without changing upstream data.
The downloaded header uses `FreqCount`, `LogFreq(Zipf)`, `CD_count`, `CD`,
`DomPoS`, `DomPoSFreq`, `AllPoS`, `AllPoSFreq` and `CapitFreq`, among others.
`AllPoS` and `AllPoSFreq` are corresponding dot-separated sequences. Isolate
the `noun` count; do not assume that a spelling's dominant use is a noun.
[Official download page](https://psychology.nottingham.ac.uk/subtlex-uk/)

Open compounds need exact phrase evidence or the bigram source. The cleaned
word list alone cannot establish their full-expression frequency. Spelling
variants and proper-name use can distort overall counts. The current search
page requests citation of the 2014 publication. The article has a CC BY 3.0
licence; a separate explicit licence for the standalone downloaded dataset was
not verified. [Official search and citation page](https://shiny.psychology.nottingham.ac.uk/lpzwjv/SUBTLEX-UK/),
[Article rights statement](https://journals.sagepub.com/doi/10.1080/17470218.2013.850521)

## Broader frequency cross-check

`wordfreq` supplies a general English frequency estimate, without noun-sense
separation or a distinct British corpus. Its data is a snapshot through about
2021. Missing entries and its minimum returned value do not demonstrate zero
real-world usage. Multi-token estimates assume the components occur together
and can greatly overestimate an uncommon combination. SUBTLEX-US and SUBTLEX-UK
are included sources, so agreement with SUBTLEX-UK is not independent
corroboration. [Official wordfreq documentation](https://github.com/rspeer/wordfreq)

The code uses Apache licensing and bundled data uses CC BY-SA 4.0 with upstream
attribution. The maintainer explicitly discourages republishing a stripped CSV
of the database. Use the library with its notices intact and retain attribution
with any pilot evidence derived from it. This source check did not install or
download `wordfreq`; the main pilot owns that step.
[wordfreq licence and attribution guidance](https://github.com/rspeer/wordfreq#license)

## Download evidence

Original files are local scratch under `output/noun-review-pilot/sources/`.
They are not production Word Bank assets. SHA-256 hashes below identify the
downloaded bytes.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `prevalence-publisher-ESM1.xlsx` | 3,840,405 | `36E236E5ADE4A9D6EB484BC2C704F57773C9F3D230ED0D67FF7B84600A191204` |
| `prevalence-publisher-ESM2.xlsx` | 8,453,860 | `3B2CBEE33F7A4EAB50E71A7A09461FE28C32BB16C53435327B94CF7B951B76AF` |
| `SUBTLEX-UK.xlsx.zip` | 22,054,700 | `7EF764B34D4A764A52D651B2EBBA0EFDDA054061EC1D10B3AD5820B65BC3BC6B` |
| `SUBTLEX-UK.txt.zip` | 3,488,497 | `E40D83AF55EB85E9E2BC0D72E1022B10E47E31FF2086AD2EDCC18292D6BD6616` |
| `subtlex-uk-text/SUBTLEX-UK.txt` | 18,218,234 | `9CC02E83EFCE5C606606578122B792E364DCEE52799115218F2CFD596E0FE0F3` |

The exact prevalence download URLs are
[ESM 1](https://media.springernature.com/original/springer-static/esm/art%3A10.3758%2Fs13428-018-1077-9/MediaObjects/13428_2018_1077_MOESM1_ESM.xlsx)
and [ESM 2](https://media.springernature.com/original/springer-static/esm/art%3A10.3758%2Fs13428-018-1077-9/MediaObjects/13428_2018_1077_MOESM2_ESM.xlsx).
The British frequency download URLs are
[Excel archive](https://psychology.nottingham.ac.uk/subtlex-uk/SUBTLEX-UK.xlsx.zip)
and [text archive](https://psychology.nottingham.ac.uk/subtlex-uk/SUBTLEX-UK.txt.zip).

The completed blind comparisons and proposed full-field workflow are recorded
in [the automation pilot report](noun-review-automation-pilot.md). These source
checks remain supporting research rather than an accepted curation policy.
