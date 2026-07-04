import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStageRenderPlan } from '../stage/render/StageRenderPlan.js';
import {
  createJsonViewerZoneDensityPlan,
  createJsonViewerZoneDensityResult,
} from '../stage/ui/JsonViewerZoneDensitySelector.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const sample = JSON.parse(fs.readFileSync(path.join(root, 'stage/samples/sample-rvm-stage-model-v1.json'), 'utf8'));

const hierarchyPlan = createJsonViewerZoneDensityPlan(sample, {
  defaultQuality: 'full',
  outsideQuality: 'hidden',
  selectedQuality: 'full',
});

assert.equal(hierarchyPlan.sourceMode, 'hierarchy-zone');
assert.ok(hierarchyPlan.rows.length > 1);

const selectedNodeRow = hierarchyPlan.rows[0];
const hierarchySelection = createJsonViewerZoneDensityResult(hierarchyPlan, {
  defaultQuality: 'hidden',
  selectedQuality: 'full',
  selectedRowIds: [selectedNodeRow.id],
  qualityByRowId: { [selectedNodeRow.id]: 'full' },
});

assert.equal(hierarchySelection.quality, 'hidden');
assert.equal(hierarchySelection.qualityOverrides[`node:${selectedNodeRow.ref.id}`], 'full');

const hierarchyRenderPlan = buildStageRenderPlan(sample, hierarchySelection.quality, {
  qualityOverrides: hierarchySelection.qualityOverrides,
});
assert.equal(hierarchyRenderPlan.summary.hidden, sample.primitives.length - selectedNodeRow.primitiveCount);

const collapsed = {
  ...sample,
  hierarchy: {
    rootId: 'rvm-node-root',
    nodes: [{
      id: 'rvm-node-000001',
      parentId: 'rvm-node-root',
      name: 'COLLAPSED_RVM_ROOT',
      path: '/COLLAPSED_RVM_ROOT',
      primitiveIds: sample.primitives.map((primitive) => primitive.id),
    }],
  },
  components: [],
  primitives: sample.primitives.map((primitive) => ({ ...primitive, nodeId: 'rvm-node-000001', componentId: '' })),
};

const spatialPlan = createJsonViewerZoneDensityPlan(collapsed, {
  defaultQuality: 'full',
  outsideQuality: 'hidden',
  selectedQuality: 'full',
  tileTargetPrimitives: 1,
  maxSpatialRows: 4,
});

assert.equal(spatialPlan.rootId, 'rvm-node-root');
assert.equal(spatialPlan.sourceMode, 'spatial-area');
assert.ok(spatialPlan.rows.length > 1);

const selectedArea = spatialPlan.rows[0];
const spatialSelection = createJsonViewerZoneDensityResult(spatialPlan, {
  defaultQuality: 'hidden',
  selectedQuality: 'full',
  selectedRowIds: [selectedArea.id],
  qualityByRowId: { [selectedArea.id]: 'full' },
});

assert.ok(Object.keys(spatialSelection.qualityOverrides).every((key) => key.startsWith('primitive:')));

const spatialRenderPlan = buildStageRenderPlan(collapsed, spatialSelection.quality, {
  qualityOverrides: spatialSelection.qualityOverrides,
});
assert.equal(spatialRenderPlan.summary.hidden, collapsed.primitives.length - selectedArea.primitiveCount);

console.log('3D Json Viewer zone density selector tests passed');
