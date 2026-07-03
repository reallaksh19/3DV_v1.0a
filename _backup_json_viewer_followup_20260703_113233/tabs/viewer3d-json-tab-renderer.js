import { validateRvmStageModel, normalizeRenderQuality, RVM_STAGE_SCHEMA } from '../stage/contracts/RvmStageModelContract.js';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import { buildStageRenderPlan, STAGE_RENDER_PLAN_SCHEMA, validateStageRenderPlan } from '../stage/render/StageRenderPlan.js';
import { createRvmBinaryWorkerJob, createStageJsonWorkerJob } from '../stage/worker/StageWorkerJob.js';
import { createStageWorkerClient, disposeStageWorkerClient, runStageWorkerClientJob } from '../stage/worker/StageWorkerClient.js';
import { createStageThreePreviewRenderer, renderStagePreview, disposeStageThreePreviewRenderer, fitStagePreviewToRenderPlan, fitStagePreviewToSelection, resetStagePreview, updateStagePreviewSelection, setStagePreviewSelectionCallback, setStagePreviewHoverCallback, setStagePreviewMeasureCallback, setStagePreviewCanvasClickCallback, requestStagePreviewRender } from '../stage/render/StageThreePreviewRenderer.js';
import { setStagePreviewCameraMode, setStagePreviewView } from '../stage/render/StagePreviewCameraControls.js';
import { setStagePreviewMarqueeActive } from '../stage/render/StagePreviewMarqueeZoom.js';
import { setStagePreviewMeasureActive } from '../stage/render/StagePreviewMeasureTool.js';
import { applyStagePreviewVisibility, createStageVisibilityState, hiddenVisibilityRows, stageRefKey, visibilityStats } from '../stage/render/StagePreviewVisibilityTools.js';
import { applyStagePreviewClip, clipSummary, createStageClipState } from '../stage/render/StagePreviewClipTools.js';
import { renderStagePreviewTags, tagOverlaySummary } from '../stage/render/StagePreviewTagTools.js';
import { createJsonViewerShell } from '../stage/ui/JsonViewerShell.js';
import { renderHierarchyTree } from '../stage/ui/JsonViewerHierarchyTree.js';
import { renderProperties } from '../stage/ui/JsonViewerPropertiesPanel.js';
import { renderDiagnostics } from '../stage/ui/JsonViewerDiagnosticsPanel.js';
import { renderClipPanel, renderHiddenList, renderTagsPanel } from '../stage/ui/JsonViewerToolsPanels.js';
import { createJsonViewerInteractionController } from '../stage/ui/JsonViewerInteractionController.js';
import { classifyRvmWorkerResult, createRvmUiDiagnostics } from '../stage/ui/RvmUiHandoff.js';
import { buildStageModelDownload, deriveRvmStageUiSummary } from '../stage/ui/RvmStageModelUiSummary.js';

const EMPTY_CANVAS_TEXT = '3D Json Viewer — load RvmStageModel.v1 or RVM evidence';
const RVM_STAGE_SUCCESS_TEXT = 'RVM StageModel generated successfully.';
const PREVIEW_DIAGNOSTIC_TEXT = 'Preview rendering is diagnostic-only / not implemented yet.';
const ATT_NO_GEOMETRY_TEXT = 'No 3D geometry in this file. This is an ATT-managed hierarchy export (attributes only, no facet/mesh data).\nBrowse the Hierarchy tree on the left, or use "Open RVM Evidence" to load the RVM binary for 3D geometry.';
const SAMPLE_SOURCE_NAME = 'sample-rvm-stage-model-v1.js';
const WORKER_URL = new URL('../stage/worker/stage-worker.js', import.meta.url);

function diagnosticCount(state) { const model = state.model?.diagnostics?.messages?.length || 0; const plan = state.renderPlan?.diagnostics?.length || 0; return model + plan + state.validationErrors.length + state.previewDiagnostics.length + state.workerDiagnostics.length; }
function defaultSelection(model) { return model ? { type: 'root', id: model.hierarchy?.rootId || 'node-root' } : null; }
function updateRenderPlan(state) { state.renderPlan = state.model ? buildStageRenderPlan(state.model, state.renderQuality) : null; }
function activatePanel(handles, panel) {
  for (const [name, tab, body] of [['properties', handles.propertiesTab, handles.propertiesPanel], ['tags', handles.tagsTab, handles.tagsPanel], ['clip', handles.clipTab, handles.clipPanel], ['diagnostics', handles.diagnosticsTab, handles.diagnosticsPanel]]) {
    tab.classList.toggle('is-active', panel === name);
    body.hidden = panel !== name;
  }
}
function ensureWorkerClient(handles, state) { if (!state.workerClient) state.workerClient = createStageWorkerClient({ workerUrl: WORKER_URL, onMessage: (message) => handleWorkerMessage(message, handles, state) }); return state.workerClient; }
function disposeWorkerClient(state) { disposeStageWorkerClient(state.workerClient); state.workerClient = null; }
function disposePreview(state) { disposeStageThreePreviewRenderer(state.previewRenderer); state.previewRenderer = null; }
function previewDiagnostic(error) { return { severity: 'error', code: 'STAGE_PREVIEW_RENDER_FAILED', message: error?.message || String(error) }; }
function clearLoadedModel(state, sourceName = '') { state.model = null; state.renderPlan = null; state.selectedRef = null; state.sourceFileName = sourceName; state.validationErrors = []; state.previewDiagnostics = []; }

function previewText(plan, model) {
  if (!plan) return EMPTY_CANVAS_TEXT;
  if (model?.diagnostics?.messages?.some((message) => message.code === 'STAGE_ATT_HIERARCHY_NO_GEOMETRY')) return ATT_NO_GEOMETRY_TEXT;
  const byOutput = plan.summary?.byOutput || {};
  const hasDiagnosticEntries = (byOutput.bbox || 0) > 0 || plan.summary.diagnosticOnly > 0;
  return [RVM_STAGE_SUCCESS_TEXT, hasDiagnosticEntries ? PREVIEW_DIAGNOSTIC_TEXT : '', STAGE_RENDER_PLAN_SCHEMA, `Quality: ${plan.source.quality}`, `Entries: ${plan.summary.totalEntries}`, `Procedural: ${byOutput.procedural || 0}`, `BBox/diagnostic: ${byOutput.bbox || 0}`, `Hidden: ${plan.summary.hidden}`, `Diagnostic-only: ${plan.summary.diagnosticOnly}`].filter(Boolean).join('\n');
}

function handleWorkerMessage(message, handles, state) {
  const payload = message?.payload || {};
  if (message?.type === 'STAGE_WORKER_START' && payload.jobId && payload.jobId !== state.activeJobId) return;
  addWorkerMessageDiagnostic(message, state);
  state.statusText = message?.type === 'STAGE_WORKER_PROGRESS' ? `${payload.phase || 'worker'}: ${payload.message || ''}` : (message?.type || 'STAGE_WORKER_MESSAGE').replace('STAGE_WORKER_', '');
  updateStatus(handles, state);
}

function workerMessageDiagnostic(message) { const payload = message?.payload || {}; return { severity: message?.type === 'STAGE_WORKER_ERROR' ? 'error' : 'info', code: message?.type || 'STAGE_WORKER_MESSAGE', message: payload.message || payload.phase || payload.code || message?.type || 'worker message' }; }
function workerMessageKey(message) { const payload = message?.payload || {}; return [message?.type || '', payload.jobId || '', payload.phase || '', payload.code || '', payload.message || '', payload.percent ?? ''].join('|'); }
function addWorkerMessageDiagnostic(message, state) { const key = workerMessageKey(message); if (state.workerDiagnosticKeys.has(key)) return; state.workerDiagnosticKeys.add(key); state.workerDiagnostics.push(workerMessageDiagnostic(message)); }
function appendWorkerMessages(result, state) { for (const message of result?.messages || []) addWorkerMessageDiagnostic(message, state); }
function ensurePreviewRenderer(handles, state) {
  if (!state.previewRenderer) {
    state.previewRenderer = createStageThreePreviewRenderer(handles.canvasHost);
    setStagePreviewSelectionCallback(state.previewRenderer, (ref) => applyPreviewSelection(ref, handles, state));
    setStagePreviewHoverCallback(state.previewRenderer, (point) => updateHoverCoords(handles, point));
    setStagePreviewMeasureCallback(state.previewRenderer, (text) => { handles.measureReadout.hidden = false; handles.measureReadout.textContent = text; });
    setStagePreviewCanvasClickCallback(state.previewRenderer, (hit) => state.controller?.handleTagCanvasClick(hit));
  }
  return state.previewRenderer;
}

function updateHoverCoords(handles, point) {
  handles.coordText.textContent = point ? `XYZ: ${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}` : 'XYZ: —';
}

function renderPreview(handles, state) {
  handles.canvasHost.classList.toggle('has-model', Boolean(state.model)); handles.canvasMessage.textContent = previewText(state.renderPlan, state.model);
  if (!state.model || !state.renderPlan) return disposePreview(state);
  try { const preview = ensurePreviewRenderer(handles, state); preview.selectedRef = state.selectedRef; preview.forceFit = state.previewFitPending || preview.forceFit; renderStagePreview(preview, state.model, state.renderPlan); syncPreviewTools(preview, state); applyToolState(handles, state); state.previewFitPending = false; state.previewDiagnostics = []; }
  catch (error) { disposePreview(state); state.previewDiagnostics = [previewDiagnostic(error)]; state.activePanel = 'diagnostics'; handles.canvasMessage.textContent = `Preview renderer failed\n${previewText(state.renderPlan, state.model)}`; }
}

function syncPreviewTools(preview, state) {
  state.visibilityStats = applyStagePreviewVisibility(preview, state.model, state.visibility);
  state.clipResult = applyStagePreviewClip(preview, state.clip);
  renderStagePreviewTags(preview, state.tags, state.tagDraft);
  requestStagePreviewRender(preview);
}

function renderEvidencePanels(handles, state) {
  const summary = deriveRvmStageUiSummary(state.model, state.workerDiagnostics);
  renderSummary(handles.summaryPanel, summary, state.model);
  renderCoverage(handles.coveragePanel, summary.coverage);
  handles.downloadButton.disabled = !state.model;
}

function renderSummary(target, summary, model) {
  target.replaceChildren();
  const title = document.createElement('h2'); title.className = 'json-viewer-panel-title'; title.textContent = 'StageModel Summary';
  const grid = document.createElement('dl'); grid.className = 'json-viewer-summary-grid';
  for (const [key, value] of [['fileName', summary.source.fileName || '—'], ['kind', summary.source.kind || '—'], ['attAvailable', summary.source.attAvailable], ['schema', model?.schema || RVM_STAGE_SCHEMA], ['nodes', summary.counts.hierarchyNodes], ['primitives', summary.counts.totalPrimitives], ['decoded', summary.counts.decodedPrimitives], ['unsupported', summary.counts.unsupportedPrimitives], ['failed', summary.counts.failedPrimitives], ['parserComplete', summary.parser.parserComplete], ['visualParityClaimed', summary.parser.visualParityClaimed]]) addPair(grid, key, value);
  target.append(title, grid);
}

function renderCoverage(target, rows) {
  target.replaceChildren(); const title = document.createElement('h2'); title.className = 'json-viewer-panel-title'; title.textContent = 'Primitive Code Coverage';
  const table = document.createElement('table'); table.className = 'json-viewer-coverage-table'; const body = document.createElement('tbody');
  const header = document.createElement('tr'); for (const text of ['Code', 'Kind', 'Status', 'Count']) { const th = document.createElement('th'); th.textContent = text; header.appendChild(th); } table.appendChild(header);
  for (const row of rows) { const tr = document.createElement('tr'); for (const value of [row.code, row.kind, row.status, row.count]) { const td = document.createElement('td'); td.textContent = String(value); tr.appendChild(td); } body.appendChild(tr); }
  table.appendChild(body); target.append(title, table);
}

function addPair(grid, key, value) { const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = key; dd.textContent = String(value); grid.append(dt, dd); }

function updateStatus(handles, state) {
  const model = state.model, summary = deriveRvmStageUiSummary(model, state.workerDiagnostics);
  handles.statusText.textContent = state.statusText; handles.schemaText.textContent = `schema: ${model?.schema || RVM_STAGE_SCHEMA}`; handles.sourceText.textContent = `source: ${state.sourceFileName || model?.source?.fileName || '—'}`;
  handles.nodeText.textContent = `nodes: ${summary.counts.hierarchyNodes}`; handles.componentText.textContent = `components: ${model?.components?.length || 0}`; handles.primitiveText.textContent = `primitives: ${summary.counts.totalPrimitives}`;
  handles.decodedText.textContent = `decoded: ${summary.counts.decodedPrimitives}`; handles.unsupportedText.textContent = `unsupported: ${summary.counts.unsupportedPrimitives}`; handles.failedText.textContent = `failed: ${summary.counts.failedPrimitives}`;
  handles.diagnosticsText.textContent = `diagnostics: ${diagnosticCount(state)}`; handles.qualityText.textContent = `quality: ${state.renderQuality}`; handles.planEntryText.textContent = `plan entries: ${state.renderPlan?.summary?.totalEntries || 0}`; handles.planDiagnosticText.textContent = `render diagnostic: ${state.renderPlan?.summary?.diagnosticOnly || 0}`;
  handles.selectedText.textContent = state.selectedRef ? `selected: ${state.selectedRef.type} ${state.selectedRef.id}` : 'selected: none';
  handles.objectsText.textContent = `objects: ${(state.renderPlan?.entries || []).filter((entry) => entry.output !== 'hidden').length}`;
  const stats = state.visibilityStats || visibilityStats(state.previewRenderer);
  handles.visibleText.textContent = `visible: ${stats.visible || 0}/${stats.total || 0}`;
  handles.hiddenText.textContent = `hidden: ${state.visibility?.hiddenKeys?.size || stats.hidden || 0}`;
  handles.clipText.textContent = state.clipResult?.summary || clipSummary(state.clip);
  handles.tagText.textContent = `tags: ${tagOverlaySummary(state.tags, state.tagDraft)}`;
  handles.unitsText.textContent = `units: ${model?.source?.units || 'mm'}`;
}

function acceptModel(model, sourceName, state, statusText = `Loaded ${sourceName}`) {
  const validation = validateRvmStageModel(model); state.sourceFileName = sourceName; state.previewDiagnostics = []; state.previewFitPending = true;
  if (!validation.valid) return rejectModel(validation.errors, state); state.model = model; state.selectedRef = defaultSelection(model); state.validationErrors = []; state.activePanel = 'properties'; state.statusText = statusText; updateRenderPlan(state); return true;
}
function rejectModel(errors, state) { clearLoadedModel(state); state.validationErrors = errors; state.activePanel = 'diagnostics'; state.statusText = 'Invalid staged model'; return false; }
function renderSidePanels(handles, state) {
  const tagKeySet = new Set(state.tags.map((tag) => stageRefKey(tag.ref)).filter(Boolean));
  renderHierarchyTree(handles.hierarchyList, state.model, state.selectedRef, { hiddenKeys: state.visibility.hiddenKeys, isolateKey: state.visibility.isolateKey, tags: state.tags, tagKeySet, componentFilter: state.componentFilter });
  renderHiddenList(handles.hiddenList, hiddenVisibilityRows(state.model, state.visibility));
  renderProperties(handles.propertiesPanel, state.model, state.selectedRef);
  renderTagsPanel(handles.tagsPanel, state.tags, state.tagDraft, state.tagCapture, state.sourceFileName || state.model?.source?.fileName);
  renderClipPanel(handles.clipPanel, state.clip, state.clipResult);
  renderDiagnostics(handles.diagnosticsPanel, state.model?.diagnostics, state.validationErrors, [...(state.renderPlan?.diagnostics || []), ...state.previewDiagnostics], state.workerDiagnostics);
  for (const button of handles.shell.querySelectorAll('[data-component-filter]')) button.classList.toggle('is-active', button.dataset.componentFilter === state.componentFilter);
  updateStatus(handles, state); activatePanel(handles, state.activePanel);
}
function renderAll(handles, state) { renderEvidencePanels(handles, state); renderPreview(handles, state); renderSidePanels(handles, state); }
function applyPreviewSelection(ref, handles, state) { if (!ref?.type || !ref?.id) return; state.selectedRef = ref; if (!state.tagCapture?.active && !state.tagDraft) state.activePanel = 'properties'; state.statusText = `Selected ${ref.type} ${ref.id}`; if (state.previewRenderer) { state.previewRenderer.selectedRef = ref; updateStagePreviewSelection(state.previewRenderer, state.model); } renderSidePanels(handles, state); }

function applyWorkerResult(result, sourceName, handles, state, mode = 'stage-json') {
  appendWorkerMessages(result, state); if (!result?.ok) return applyWorkerFailure(result, handles, state, mode);
  const handoff = mode === 'rvm-binary' ? classifyRvmWorkerResult(result) : null; const accepted = acceptModel(result.stageModel, sourceName, state, handoff?.statusText || 'Worker accepted Stage JSON');
  const planCheck = validateStageRenderPlan(result.renderPlan); if (accepted && planCheck.valid && result.renderPlan?.source?.quality === state.renderQuality) state.renderPlan = result.renderPlan;
  if (!planCheck.valid) state.workerDiagnostics.push({ severity: 'warning', code: 'STAGE_WORKER_RENDER_PLAN_FALLBACK', message: planCheck.errors.join('; ') }); if (handoff) state.workerDiagnostics.push(...createRvmUiDiagnostics(result)); renderAll(handles, state);
}
function applyWorkerFailure(result, handles, state, mode = 'stage-json') { appendWorkerMessages(result, state); clearLoadedModel(state, state.sourceFileName); state.validationErrors = result?.validationErrors || []; state.workerDiagnostics.push({ severity: 'error', code: result?.error?.code || 'STAGE_WORKER_FAILED', message: result?.error?.message || 'Stage worker failed' }); appendRvmDiagnostics(result, state, mode); state.activePanel = 'diagnostics'; state.statusText = mode === 'rvm-binary' ? classifyRvmWorkerResult(result).statusText : 'Worker rejected Stage JSON'; renderAll(handles, state); }
function appendRvmDiagnostics(result, state, mode) { if (mode !== 'rvm-binary') return; const context = result?.error?.context || {}; const items = [...(context.preflight?.errors || []), ...(context.preflight?.warnings || []), ...(context.warnings || [])]; for (const item of items) state.workerDiagnostics.push({ severity: 'warning', code: item.code || 'STAGE_RVM_PREFLIGHT_DETAIL', message: item.message || String(item) }); state.workerDiagnostics.push(...createRvmUiDiagnostics(result)); }

function runPreviewCommand(action, handles, state) { if (!state.model || !state.renderPlan || !state.previewRenderer) { state.statusText = `${action} requested — no preview loaded`; return renderAll(handles, state); } if (action === 'fit') { fitStagePreviewToRenderPlan(state.previewRenderer, state.renderPlan); state.statusText = 'Fit applied to preview'; } if (action === 'reset') { resetStagePreview(state.previewRenderer); state.statusText = 'Preview camera reset'; } if (action === 'fit-selection') { fitStagePreviewToSelection(state.previewRenderer, state.model, state.selectedRef); state.statusText = 'Fit applied to selection'; } updateStatus(handles, state); }
function loadSample(handles, state) { try { resetToolState(state); state.workerDiagnostics = []; state.workerDiagnosticKeys = new Set(); state.activeJobId = ''; acceptModel(createSampleRvmStageModelV1(), SAMPLE_SOURCE_NAME, state); } catch (error) { clearLoadedModel(state, SAMPLE_SOURCE_NAME); state.validationErrors = [`Sample load failed: ${error?.message || error}`]; state.activePanel = 'diagnostics'; state.statusText = 'Sample load failed'; } renderAll(handles, state); }
async function loadStageFile(file, handles, state) { resetForWorkerFile(state, file.name, `reading-file: ${file.name}`); renderAll(handles, state); const text = await file.text(); const fileHash = await hashStageJsonText(file, text); const job = createStageJsonWorkerJob({ text, fileName: file.name, fileSize: file.size, fileHash }); await runWorkerJob(job, handles, state, (result) => applyWorkerResult(result, file.name, handles, state)); handles.fileInput.value = ''; }
async function loadRvmFile(file, handles, state) { resetForWorkerFile(state, file.name, `RVM binary selected: ${file.name}`); renderAll(handles, state); const arrayBuffer = await file.arrayBuffer(); const fileHash = await hashArrayBuffer(file, arrayBuffer, 'rvm-binary'); const job = createRvmBinaryWorkerJob({ arrayBuffer, fileName: file.name, fileSize: file.size, fileHash }); await runWorkerJob(job, handles, state, (result) => applyWorkerResult(result, file.name, handles, state, 'rvm-binary')); handles.rvmFileInput.value = ''; }
function resetForWorkerFile(state, fileName, statusText) { disposeWorkerClient(state); resetToolState(state); clearLoadedModel(state, fileName); state.workerDiagnostics = []; state.workerDiagnosticKeys = new Set(); state.activePanel = 'diagnostics'; state.statusText = statusText; }
function resetToolState(state) { state.visibility = createStageVisibilityState(); state.clip = createStageClipState(); state.clipResult = null; state.visibilityStats = { total: 0, visible: 0, hidden: 0 }; state.tags = []; state.tagDraft = null; state.tagCapture = { active: false, anchor: null }; state.componentFilter = 'all'; }
async function runWorkerJob(job, handles, state, applyResult) { state.activeJobId = job.jobId; try { const result = await runStageWorkerClientJob(ensureWorkerClient(handles, state), job); if (state.activeJobId === job.jobId) applyResult(result); } catch (error) { if (state.activeJobId === job.jobId) applyWorkerFailure({ error: { code: 'STAGE_WORKER_CLIENT_ERROR', message: error?.message || String(error) } }, handles, state, job.kind); } }
async function hashStageJsonText(file, text) { return hashBytes(file, new TextEncoder().encode(text), 'stage-json'); }
async function hashArrayBuffer(file, arrayBuffer, kind) { return hashBytes(file, new Uint8Array(arrayBuffer), kind); }
async function hashBytes(file, bytes, kind) { const cryptoApi = globalThis.crypto?.subtle; if (!cryptoApi) return `sha256-${kind}-${file.name}-${file.size}-${bytes.byteLength}`; const digest = await cryptoApi.digest('SHA-256', bytes); return `sha256-${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`; }
function downloadStageModel(handles, state) { if (!state.model) return; const download = buildStageModelDownload(state.model, state.sourceFileName); const url = URL.createObjectURL(new Blob([download.text], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = download.fileName; a.click(); URL.revokeObjectURL(url); state.statusText = `Downloaded ${download.fileName}`; updateStatus(handles, state); }

const TOOL_ACTIONS = { 'tool-select': 'select', 'tool-orbit': 'orbit', 'tool-pan': 'pan' };
function setActiveTool(action, handles, state) {
  state.activeTool = TOOL_ACTIONS[action] || 'select';
  state.marqueeActive = false; state.measureActive = false;
  applyToolState(handles, state);
  state.statusText = `Tool: ${state.activeTool}`;
  updateStatus(handles, state);
}
function toggleMarquee(handles, state) {
  state.marqueeActive = !state.marqueeActive; state.measureActive = false;
  applyToolState(handles, state);
  state.statusText = state.marqueeActive ? 'Marquee Zoom: drag a window' : `Tool: ${state.activeTool}`;
  updateStatus(handles, state);
}
function toggleMeasure(handles, state) {
  state.measureActive = !state.measureActive; state.marqueeActive = false;
  applyToolState(handles, state);
  if (!state.measureActive) { handles.measureReadout.hidden = true; handles.measureReadout.textContent = ''; }
  state.statusText = state.measureActive ? 'Measure: select first point' : `Tool: ${state.activeTool}`;
  updateStatus(handles, state);
}
function applyToolState(handles, state) {
  const cameraMode = state.marqueeActive || state.measureActive ? 'select' : state.activeTool;
  if (state.previewRenderer) { setStagePreviewCameraMode(state.previewRenderer, cameraMode); setStagePreviewMarqueeActive(state.previewRenderer, state.marqueeActive); setStagePreviewMeasureActive(state.previewRenderer, state.measureActive); }
  for (const [button, tool] of [[handles.selectToolButton, 'select'], [handles.orbitToolButton, 'orbit'], [handles.panToolButton, 'pan']]) button.classList.toggle('is-active', !state.marqueeActive && !state.measureActive && state.activeTool === tool);
  handles.marqueeZoomButton.classList.toggle('is-active', state.marqueeActive);
  handles.measureToolButton.classList.toggle('is-active', state.measureActive);
}
const VIEW_ACTIONS = { 'view-iso': 'iso', 'view-top': 'top', 'view-front': 'front', 'view-side': 'side' };
function applyViewPreset(action, handles, state) { if (!state.previewRenderer) return; setStagePreviewView(state.previewRenderer, VIEW_ACTIONS[action]); state.statusText = `View: ${VIEW_ACTIONS[action]}`; updateStatus(handles, state); }

export function renderViewer3DJson(root) {
  const handles = createJsonViewerShell(root);
  const state = { model: null, renderPlan: null, previewRenderer: null, workerClient: null, previewDiagnostics: [], workerDiagnostics: [], workerDiagnosticKeys: new Set(), previewFitPending: false, activeJobId: '', sourceFileName: '', selectedRef: null, validationErrors: [], renderQuality: 'full', activePanel: 'properties', statusText: 'Ready', activeTool: 'select', marqueeActive: false, measureActive: false };
  resetToolState(state);
  const api = {
    renderSidePanels: () => renderSidePanels(handles, state),
    syncPreviewTools: () => { if (state.previewRenderer) syncPreviewTools(state.previewRenderer, state); },
    updateStatus: () => updateStatus(handles, state),
    setPanel: (panel) => { state.activePanel = panel; },
    loadStageFile: (file) => loadStageFile(file, handles, state),
    loadRvmFile: (file) => loadRvmFile(file, handles, state),
    loadSample: () => loadSample(handles, state),
    downloadStageModel: () => downloadStageModel(handles, state),
    runPreviewCommand: (action) => runPreviewCommand(action, handles, state),
    setActiveTool: (action) => setActiveTool(action, handles, state),
    toggleMarquee: () => toggleMarquee(handles, state),
    toggleMeasure: () => toggleMeasure(handles, state),
    applyViewPreset: (action) => applyViewPreset(action, handles, state),
    applyPreviewSelection: (ref) => applyPreviewSelection(ref, handles, state),
    changeQuality: (value) => { state.renderQuality = normalizeRenderQuality(value); state.statusText = `Render quality: ${state.renderQuality}`; updateRenderPlan(state); renderAll(handles, state); },
  };
  state.controller = createJsonViewerInteractionController(handles, state, api);
  handles.qualitySelect.value = state.renderQuality; const cleanup = state.controller.wireEvents(); renderAll(handles, state);
  return () => { cleanup(); disposeWorkerClient(state); disposePreview(state); };
}
