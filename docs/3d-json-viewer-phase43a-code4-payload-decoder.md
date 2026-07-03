# 3D Json Viewer Phase 4.3A Code 4 Payload Decoder Layer

This phase adds a pure code-4 elbow payload decoder. It consumes bounded PRIM payload-slice evidence and returns a structured decode report only.

## Why this is decoder-layer work only

The decoder does not run inside the worker, does not emit stage/package ready, and does not create a stage model, render plan, manifest, or geometry chunk. It only proves whether one bounded code-4 PRIM slice satisfies the explicit MVP layout used by tests.

## Supported MVP layout

The only supported layout is:

- PRIM header with native code 4 and payload length
- payload starts at PRIM offset plus 12
- 12 float32 values for transform3x4
- 6 float32 values for bboxLocal
- 4 float32 elbow params: radius, bendRadius, angleDeg, sweepRadians
- minimum payload length is 88 bytes

## What remains unsupported

This phase does not decode code 11, does not prove benchmark compatibility, does not infer geometry from names, and does not claim full code-4 coverage. Unsupported payloads return `decoded.ok: false` with reason codes.

## Report guarantees

Every report keeps `decoderComplete: false` and `visualParityClaimed: false`. Malformed input, non-code-4 slices, unbounded slices, short payloads, and invalid numeric evidence are rejected without throwing.

## Future integration

A later parser phase can consume successful code-4 decode reports and map them into staged native geometry only after stage contracts and benchmark evidence are satisfied. That integration is intentionally outside this PR.

## Old viewer leakage remains forbidden

The decoder is independent of old viewer parser, bridge, renderer, and hotfix modules. It avoids worker, UI, renderer, browser cache, and browser 3D library dependencies.
