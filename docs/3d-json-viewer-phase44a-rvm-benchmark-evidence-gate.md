# 3D Json Viewer Phase 4.4A RVM Benchmark Evidence Gate

This phase adds a current benchmark evidence gate for the post-Phase 4.3 pipeline. It supersedes the older PR #658 diagnostics-only acceptance harness because the current pipeline now has record-reader evidence, parser reports, code-4 decoder summaries, and optional worker result envelopes.

## Diagnostics evidence is not parser success

Diagnostics scanner output can prove that conservative candidate signatures were observed. It cannot prove native decoding, staged graph validity, render-plan readiness, or real benchmark compatibility. The gate keeps diagnostics-only evidence separate from parser success.

## Synthetic code-4 success is not real compatibility

Synthetic code-4 success means only that the current MVP layout and staged worker path can produce valid staged output for synthetic evidence. It does not prove real plant benchmark compatibility, Review visual matching, or Navis matching.

## Code 11 remains evidence-only

Code 11 candidates are counted as evidence only. The gate does not treat code 11 counts as decoded mesh, geometry chunk readiness, or visual parity.

## Real compatibility remains false

The gate always keeps `realCompatibilityProven: false` and `visualParityClaimed: false`. Those claims require future real benchmark evidence that is outside this phase.

## Future RMSS/GAS evidence judgment

Future real benchmark reports should feed preflight, diagnostics, record-reader, parser, decoder summaries, and worker envelope evidence into this gate. The gate can then classify evidence level and reject accidental parity claims while still reporting candidate counts and synthetic-only stage readiness honestly.

## Scope boundary

This phase does not decode new RVM layouts, add rendering, add UI, or change parser/worker behavior. It is a benchmark evidence classifier only.
