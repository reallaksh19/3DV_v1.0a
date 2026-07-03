import assert from 'node:assert/strict';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';
import { buildStageRenderPlan, classifyStageRenderSupport, validateStageRenderPlan } from '../stage/render/StageRenderPlan.js';
import {
  SAMPLE_CODE4_ELBOW_STAGE_MODEL_NOTE,
  createIncompleteCode4ElbowPrimitiveFixture,
  createSampleCode4ElbowStageModelV1,
} from '../stage/samples/sample-code4-elbow-stage-model-v1.js';

assert.match(SAMPLE_CODE4_ELBOW_STAGE_MODEL_NOTE, /Staged fixture only/);
assert.match(SAMPLE_CODE4_ELBOW_STAGE_MODEL_NOTE, /not binary decoded/);

const model = createSampleCode4ElbowStageModelV1();
const modelValidation = validateRvmStageModel(model);
assert.equal(model.schema, 'RvmStageModel.v1');
assert.equal(modelValidation.valid, true, modelValidation.errors.join('\n'));
assert.equal(model.primitives.length, 1);
assert.equal(model.primitives[0].renderKind, 'ELBOW');
assert.equal(model.primitives[0].nativeRecord.recordType, 'RVM_PRIMITIVE');
assert.equal(model.primitives[0].nativeRecord.nativeCode, 4);
assert.equal(model.primitives[0].nativeRecord.decoded, true);
assert.equal(model.primitives[0].nativeGeometry.provenance, 'native');
assert.equal(model.primitives[0].confidence.geometry, 'native');

const plan = buildStageRenderPlan(model, 'full');
const planValidation = validateStageRenderPlan(plan);
assert.equal(planValidation.valid, true, planValidation.errors.join('\n'));
assert.equal(plan.entries.length, 1);
const entry = plan.entries[0];
assert.equal(entry.renderKind, 'ELBOW');
assert.equal(entry.supportLevel, 'supported');
assert.equal(entry.recipeSource, 'native');
assert.equal(entry.output, 'procedural');
assert.equal(entry.diagnosticOnly, false);
assert.ok(entry.nativeGeometryRef);
assert.equal(plan.summary.byRenderKind.ELBOW, 1);
assert.equal(plan.summary.bySupportLevel.supported, 1);

const incomplete = createIncompleteCode4ElbowPrimitiveFixture();
const incompleteSupport = classifyStageRenderSupport({ primitive: incomplete, renderKind: 'ELBOW', quality: 'full', output: 'procedural' });
assert.equal(incompleteSupport.supportLevel, 'diagnostic-only');
assert.equal(incompleteSupport.recipeSource, 'diagnostic-fallback');
assert.equal(incompleteSupport.output, 'bbox');
assert.ok(incompleteSupport.reasonCodes.includes('STAGE_CODE4_ELBOW_NATIVE_PARAMS_REQUIRED'));

const incompleteModel = createSampleCode4ElbowStageModelV1();
incomplete.id = incompleteModel.primitives[0].id;
incompleteModel.primitives[0] = incomplete;
const incompleteModelValidation = validateRvmStageModel(incompleteModel);
assert.equal(incompleteModelValidation.valid, true, incompleteModelValidation.errors.join('\n'));
const incompletePlan = buildStageRenderPlan(incompleteModel, 'full');
assert.equal(validateStageRenderPlan(incompletePlan).valid, true);
assert.equal(incompletePlan.entries[0].supportLevel, 'diagnostic-only');
assert.equal(incompletePlan.entries[0].recipeSource, 'diagnostic-fallback');

console.log('Code 4 staged elbow render readiness tests passed');
