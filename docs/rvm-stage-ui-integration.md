# RVM evidence UI integration

## Purpose

This phase exposes the RVM evidence StageModel pipeline in the 3D Json Viewer UI.

A user can open or drop a `.rvm` file and see:

```text
RVM binary selected
→ worker runs RVM evidence pipeline
→ RvmStageModel.v1 accepted
→ summary displayed
→ hierarchy displayed
→ primitive decode coverage displayed
→ diagnostics displayed
→ StageModel JSON downloadable
```

This PR does not implement full 3D rendering and does not replace the production 3D RVM Viewer.

The canvas/preview area must distinguish evidence import from rendering:

```text
RVM StageModel generated successfully.
Preview rendering is diagnostic-only / not implemented yet.
```

## How to test with RMSS.rvm

1. Open the app.
2. Open **3D Json Viewer**.
3. Click **Open RVM Evidence**.
4. Select `RMSS.rvm`.
5. Confirm:

```text
RVM StageModel generated successfully.
```

6. Confirm summary, hierarchy, coverage, and diagnostics are populated.
7. Download StageModel JSON.
8. Open the downloaded StageModel JSON through **Open Stage JSON** and confirm it loads.
9. Open the ATT-managed hierarchy JSON and confirm it is rejected clearly.

The summary panel should show:

```text
schema: RvmStageModel.v1
source kind: rvm-binary
attAvailable: false
parserComplete: false
visualParityClaimed: false
```

The coverage table derives primitive code counts from the emitted StageModel. Do not expect hard-coded RMSS or ASIM counts.

The download file name for `RMSS.rvm` is:

```text
RMSS.stage-model.json
```

## Input types

### RVM binary

Use **Open RVM Evidence** for `.rvm` files. RVM binary remains the geometry source.

### Valid RvmStageModel.v1 JSON

Use **Open Stage JSON** for a valid `RvmStageModel.v1` JSON file. The same summary, hierarchy, diagnostics, coverage, and download controls are shown.

### ATT-managed hierarchy JSON

A JSON array shaped like the ATT-managed hierarchy export is not accepted as StageModel:

```json
[
  {
    "name": "/LINE/B1",
    "type": "BRANCH",
    "children": []
  }
]
```

The UI surfaces the worker rejection:

```text
This JSON is an ATT-managed hierarchy export, not RvmStageModel.v1. Load a valid RvmStageModel.v1 JSON, or import the RVM binary through the RVM evidence pipeline.
```

This PR does not convert ATT-managed hierarchy JSON.

## Panels

### Summary

The summary panel displays file name, source kind, ATT availability, schema, hierarchy node count, primitive count, decoded/unsupported/failed counts, and parser/visual parity flags.

### Hierarchy

The hierarchy panel shows CNTB-derived StageModel nodes, child counts, primitive counts, and weak/fallback node markers where available. The tree is not flattened into primitives.

### Coverage

The primitive coverage table groups primitives by native code and status:

```text
Code | Kind | Status | Count
```

Codes 2, 4, 8, 9, and 11 appear as decoded when evidence is available. Codes 1, 5, 6, 7, and 10 remain diagnostics until future decode phases.

### Diagnostics

The diagnostics panel shows worker lifecycle messages, StageModel diagnostics, render-plan dry-run diagnostics, and validation errors. Unsupported primitive codes are diagnostics, not fatal failures.

## Non-goals

This PR does not add:

- full 3D rendering;
- Navisworks parity;
- AVEVA Review parity;
- visual parity claims;
- parser-complete claims;
- ATT binding;
- production 3D RVM Viewer replacement;
- production 3D RVM Viewer changes;
- model converter runtime changes;
- ATT converter runtime changes.

The UI and emitted StageModel must not claim:

```text
parserComplete: true
visualParityClaimed: true
renderReady: true
```

## Future work

A later phase may add explicit StageModel rendering and UI selection behavior. That must remain separate from this evidence visibility phase and must include renderer acceptance gates.
