# 3D Json Viewer Agent Guardrails

These guardrails protect the Phase 0 `RvmStageModel.v1` contract from UI, parser, bridge, and renderer drift. Phase 0 exists to make the staged JSON model strict before any 3D Json Viewer tab or renderer shell is added.

## Phase boundary

Phase 0 is contract-only work. Agents may change only:

- `docs/`
- `viewer/stage/contracts/`
- `viewer/stage/samples/`
- `viewer/tests/`

Agents must not create a UI tab, route, toolbar, viewer panel, renderer adapter, parser adapter, bridge shim, cache-bust patch, or browser hotfix during Phase 0.

## Import rules

Allowed imports in contract modules:

- Other modules in `viewer/stage/contracts/`
- Standard ECMAScript language features only

Allowed imports in samples:

- `viewer/stage/contracts/` only

Allowed imports in tests:

- Node built-ins such as `node:assert/strict`, `node:test`, `node:fs`
- `viewer/stage/contracts/`
- `viewer/stage/samples/`

Disallowed imports:

- Do not import existing RVM Viewer bridge/hotfix modules.
- Do not import existing RVM parser, renderer, worker, tab, toolbar, route, or cache-key modules.
- Do not import Three.js from contracts, samples, or tests.
- Do not import DOM helpers from contracts or samples.
- Do not import app bootstrap modules.

## Geometry and semantics rule

Native geometry decides shape. Semantic names such as `/PS-*`, `VALVE`, `TEE`, `FLANGE`, `SUPPORT`, or line names are metadata only. They may decide grouping, icon, label, search text, render policy, and fallback behavior, but they must not become geometry by themselves.

A primitive whose native geometry is missing or undecoded must not silently become a visible support, valve, tee, flange, or pipe based on a name rule. It must be downgraded to `UNKNOWN_DIAGNOSTIC` or rejected by validation.

## Required diagnostics rule

Every fallback must produce a diagnostic. The diagnostic must include a stable reference when available:

- `nodeId`
- `componentId`
- `primitiveId`
- `nativeCode`
- `recordOffset`

Fallback diagnostics must use `STAGE_*` codes such as:

- `STAGE_FALLBACK_UNKNOWN_NATIVE_CODE`
- `STAGE_FALLBACK_SEMANTIC_ONLY_GEOMETRY`
- `STAGE_UNDECODED_NATIVE_PRIMITIVE`

Diagnostics must increment severity and fallback counts so the UI can show conversion quality without parsing raw RVM again.

## Stable identity rule

Every visible or selectable object must have stable IDs:

- hierarchy node: stable node ID
- component: stable component ID and node ID
- primitive: stable primitive ID and node ID

Components must list their primitive IDs. Primitives must reference a component ID where applicable.

## File and code shape rules

No JS file over 300 lines. Keep functions small, named, and testable. Prefer pure functions. Use named exports only. Avoid broad `utils` modules; use focused modules such as constants, diagnostics, identity, factory, and validation.

## Runtime boundaries

- No raw RVM parsing in UI.
- No Three.js import in contracts.
- No DOM access in contracts/workers except UI shell.
- No Web Worker code in Phase 0 contracts.
- No global mutable state.
- Browser/static page behavior is the first priority; CLI support is later.
- Renderer and UI must consume `RvmStageModel.v1` only.

## Per-agent boundaries

### Phase 0 contract hardening agent

Owns schema constants, factories, validation, diagnostics, identity helpers, samples, tests, and guardrail docs. Must not touch UI, routing, existing viewer bridges, existing RVM parser, or renderer code.

### Phase 1 renderer/UI shell agent

Consumes only the sample staged model and contract helpers. Must not parse raw RVM. Must not import existing bridge or hotfix modules. Must surface diagnostics from the staged model.

### Parser/reconstruction agent

May create staged models later, but must emit `RvmStageModel.v1` and diagnostics. Native decoded geometry must decide render shape. Semantic-only fallbacks must be diagnostic.

### CLI agent

Runs later. Must reuse the same staged model contract and must not introduce a separate schema for command-line output.

## PR checklist

- [ ] Scope limited to Phase 0 allowed paths.
- [ ] No UI tab, route, renderer, parser, bridge, or hotfix code created.
- [ ] No import of existing RVM Viewer bridge/hotfix modules.
- [ ] No raw RVM parsing in UI or contracts.
- [ ] No Three.js import in contracts.
- [ ] No DOM access in contracts or samples.
- [ ] No JS file over 300 lines.
- [ ] All exports are named exports.
- [ ] `RvmStageModel.v1` sample validates.
- [ ] Invalid render kinds are rejected.
- [ ] Invalid bounding boxes are rejected.
- [ ] Missing render-policy qualities are rejected.
- [ ] Semantic-only visible geometry is rejected or downgraded to `UNKNOWN_DIAGNOSTIC` with a diagnostic.
- [ ] Fallback diagnostics increment severity and fallback counts.
- [ ] Node ESM tests pass.
