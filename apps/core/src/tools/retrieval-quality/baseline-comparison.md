# Retrieval-quality before/after comparison

Generated 2026-09-14 from the same version 1 fixture set and metric definitions. The live
after run uses the documented `retrieval-quality` command and the current
`text-embedding-3-small` / 1536-dimension profile. The before report is the historical run captured
before the EPIC changes at 16 dimensions.

## Aggregate results

| Profile                 |  Recall@3 |  Recall@7 |  Recall@9 |       MRR |
| ----------------------- | --------: | --------: | --------: | --------: |
| Before — 16 dimensions  |  1.000000 |  1.000000 |  1.000000 |  0.722222 |
| After — 1536 dimensions |  1.000000 |  1.000000 |  1.000000 |  0.916667 |
| Delta                   | +0.000000 | +0.000000 | +0.000000 | +0.194445 |

Recall was saturated at every product cutoff in this six-fixture sample. MRR improved by 0.194445,
but the result is not uniformly better at rank 1: `clara-medical-case` improved from rank 3 to 1 and
`winter-garden-location` from 2 to 1, while `crime-scene-digitalis` moved from 1 to 2. The other
three fixtures remained at rank 1. The harness therefore supports a meaningful ranking improvement
for this sample, not a claim of universal retrieval improvement.

## Reproduction

See [README.md](README.md) for the opt-in live command. The source reports are
[`baseline-before.json`](baseline-before.json) and
[`baseline-after-1536.json`](baseline-after-1536.json); this comparison contains scores and stable
fixture IDs only, never query text, source content, vectors, credentials, or provider payloads.
