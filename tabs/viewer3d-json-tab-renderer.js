import { validateRvmStageModel, normalizeRenderQuality, RVM_STAGE_SCHEMA } from '../stage/contracts/RvmStageModelContract.js';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import { buildStageRenderPlan, STAGE_RENDER_PLAN_SCHEMA, validateStageRenderPlan } from '../stage/render/StageRenderPlan.js';
import { createRvmBinaryWorkerJob, createStageJsonWorkerJob } from '../stage/worker/StageWorkerJob.js';
import { createStageWorkerClient, disposeStageWorkerClient, runStageWorkerClientJob } from '../stage/worker/StageWorkerClient.js';
import { createStageThreePreviewRenderer, renderStagePreview, disposeStageThreePreviewRenderer, fitStagePreviewToRenderPlan, fitStagePreviewToSelection, resetStagePreview, updateStagePreviewSelection, setStagePreviewSelectionCallback, setStagePreviewBoxSelectCallback, setStagePreviewHoverCallback, setStagePreviewMeasureCallback, setStagePreviewCanvasClickCallback, requestStagePreviewRender } from '../stage/render/StageThreePreviewRenderer.js';
import { setStagePreviewCameraMode, setStagePreviewView } from '../stage/render/StagePreviewCameraControls.js';
import { setStagePreviewMarqueeActive } from '../stage/render/StagePreviewMarqueeZoom.js';
import { setStagePreviewBoxSelectActive } from '../stage/render/StagePreviewBoxSelect.js';
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
import { createJsonViewerHistory, pushJsonViewerUndo, undoJsonViewerState, redoJsonViewerState } from '../stage/ui/JsonViewerUndoHistory.js';
import { createJsonViewerEnrichmentState, renderJsonViewerEnrichmentPanel } from '../stage/ui/JsonViewerEnrichmentPanel.js';
import { classifyRvmWorkerResult, createRvmUiDiagnostics } from '../stage/ui/RvmUiHandoff.js';
import { buildStageModelDownload, deriveRvmStageUiSummary } from '../stage/ui/RvmStageModelUiSummary.js';

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
function clearLoadedModel(state, sourceName = '') { state.model = null; state.renderPlan = null; state.selectedRef = null; state.selectedRefs = []; state.sourceFileName = sourceName; state.validationErrors = []; state.previewDiagnostics = []; }

function previewText() { return ''; }

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
    setStagePreviewBoxSelectCallback(state.previewRenderer, (refs) => applyPreviewSelection(refs, handles, state));
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
  const message = previewText(state.renderPlan, state.model); handles.canvasHost.classList.toggle('has-model', Boolean(state.model)); handles.canvasMessage.textContent = message; handles.canvasMessage.hidden = !message;
  if (!state.model || !state.renderPlan) return disposePreview(state);
  try { const preview = ensurePreviewRenderer(handles, state); preview.selectedRef = state.selectedRef; preview.selectedRefs = state.selectedRefs || []; preview.forceFit = state.previewFitPending || preview.forceFit; renderStagePreview(preview, state.model, state.renderPlan); syncPreviewTools(preview, state); applyToolState(handles, state); state.previewFitPending = false; state.previewDiagnostics = []; }
  catch (error) { disposePreview(state); state.previewDiagnostics = [previewDiagnostic(error)]; state.activePanel = 'diagnostics'; handles.canvasMessage.hidden = false; handles.canvasMessage.textContent = 'Preview renderer failed'; }
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
  handles.selectedText.textContent = state.selectedRefs?.length > 1 ? `selected: ${state.selectedRefs.length}` : state.selectedRef ? `selected: ${state.selectedRef.type} ${state.selectedRef.id}` : 'selected: none';
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
  if (!validation.valid) return rejectModel(validation.errors, state); state.model = model; state.selectedRef = defaultSelection(model); state.selectedRefs = state.selectedRef ? [state.selectedRef] : []; state.validationErrors = []; state.activePanel = 'properties'; state.statusText = statusText; updateRenderPlan(state); return true;
}
function rejectModel(errors, state) { clearLoadedModel(state); state.validationErrors = errors; state.activePanel = 'diagnostics'; state.statusText = 'Invalid staged model'; return false; }
function renderSidePanels(handles, state) {
  const tagKeySet = new Set(state.tags.map((tag) => stageRefKey(tag.ref)).filter(Boolean));
  const selectedKeys = new Set((state.selectedRefs || []).map(stageRefKey).filter(Boolean));
  renderHierarchyTree(handles.hierarchyList, state.model, state.selectedRef, { hiddenKeys: state.visibility.hiddenKeys, isolateKey: state.visibility.isolateKey, tags: state.tags, tagKeySet, selectedKeys, componentFilter: state.componentFilter });
  renderHiddenList(handles.hiddenList, hiddenVisibilityRows(state.model, state.visibility));
  renderProperties(handles.propertiesPanel, state.model, state.selectedRef);
  renderTagsPanel(handles.tagsPanel, state.tags, state.tagDraft, state.tagCapture, state.sourceFileName || state.model?.source?.fileName);
  renderClipPanel(handles.clipPanel, state.clip, state.clipResult);
  renderDiagnostics(handles.diagnosticsPanel, state.model?.diagnostics, state.validationErrors, [...(state.renderPlan?.diagnostics || []), ...state.previewDiagnostics], state.workerDiagnostics);
  renderJsonViewerEnrichmentPanel(handles.enrichmentPanel, state.model, state.selectedRef, state.enrichment);
  for (const button of handles.shell.querySelectorAll('[data-component-filter]')) button.classList.toggle('is-active', button.dataset.componentFilter === state.componentFilter);
  updateStatus(handles, state); activatePanel(handles, state.activePanel);
}
function renderAll(handles, state) { renderEvidencePanels(handles, state); renderPreview(handles, state); renderSidePanels(handles, state); }
function applyPreviewSelection(input, handles, state) {
  const refs = normalizeSelectionInput(input); if (!refs.length) return;
  pushJsonViewerUndo(state);
  if (Array.isArray(input)) state.selectedRefs = uniqueRefs(refs);
  else if (input.additive) state.selectedRefs = toggleSelectionRef(state.selectedRefs || [], refs[0]);
  else state.selectedRefs = refs;
  state.selectedRef = state.selectedRefs[state.selectedRefs.length - 1] || null;
  if (!state.tagCapture?.active && !state.tagDraft) state.activePanel = 'properties';
  state.statusText = state.selectedRefs.length === 1 ? selectedLabel(state.selectedRef) : `Selected ${state.selectedRefs.length} objects`;
  if (state.previewRenderer) { state.previewRenderer.selectedRef = state.selectedRef; state.previewRenderer.selectedRefs = state.selectedRefs; updateStagePreviewSelection(state.previewRenderer, state.model); }
  renderSidePanels(handles, state);
}
function normalizeSelectionInput(input) { return (Array.isArray(input) ? input : [input]).filter((ref) => ref?.type && ref?.id).map((ref) => ({ type: ref.type, id: ref.id, additive: ref.additive })); }
function selectedLabel(ref) { return `Selected ${ref.type} ${ref.id}`; }
function uniqueRefs(refs) { const out = new Map(); for (const ref of refs) out.set(`${ref.type}:${ref.id}`, { type: ref.type, id: ref.id }); return Array.from(out.values()); }
function toggleSelectionRef(selectedRefs, ref) { const key = `${ref.type}:${ref.id}`; const next = new Map((selectedRefs || []).map((item) => [`${item.type}:${item.id}`, item])); next.has(key) ? next.delete(key) : next.set(key, { type: ref.type, id: ref.id }); return Array.from(next.values()); }

function applyWorkerResult(result, sourceName, handles, state, mode = 'stage-json') {
  appendWorkerMessages(result, state); if (!result?.ok) return applyWorkerFailure(result, handles, state, mode);
  const handoff = mode === 'rvm-binary' ? classifyRvmWorkerResult(result) : null; const accepted = acceptModel(result.stageModel, sourceName, state, handoff?.statusText || 'Worker accepted Stage JSON');
  const planCheck = validateStageRenderPlan(result.renderPlan); if (accepted && planCheck.valid && result.renderPlan?.source?.quality === state.renderQuality) state.renderPlan = result.renderPlan;
  if (!planCheck.valid) state.workerDiagnostics.push({ severity: 'warning', code: 'STAGE_WORKER_RENDER_PLAN_FALLBACK', message: planCheck.errors.join('; ') }); if (handoff) state.workerDiagnostics.push(...createRvmUiDiagnostics(result)); renderAll(handles, state);
}
function applyWorkerFailure(result, handles, state, mode = 'stage-json') { appendWorkerMessages(result, state); clearLoadedModel(state, state.sourceFileName); state.validationErrors = result?.validationErrors || []; state.workerDiagnostics.push({ severity: 'error', code: result?.error?.code || 'STAGE_WORKER_FAILED', message: result?.error?.message || 'Stage worker failed' }); appendRvmDiagnostics(result, state, mode); state.activePanel = 'diagnostics'; state.statusText = mode === 'rvm-binary' ? classifyRvmWorkerResult(result).statusText : 'Worker rejected Stage JSON'; renderAll(handles, state); }
function appendRvmDiagnostics(result, state, mode) { if (mode !== 'rvm-binary') return; const context = result?.error?.context || {}; const items = [...(context.preflight?.errors || []), ...(context.preflight?.warnings || []), ...(context.warnings || [])]; for (const item of items) state.workerDiagnostics.push({ severity: 'warning', code: item.code || 'STAGE_RVM_PREFLIGHT_DETAIL', message: item.message || String(item) }); state.workerDiagnostics.push(...createRvmUiDiagnostics(result)); }

function runPreviewCommand(action, handles, state) { if (!state.model || !state.renderPlan || !state.previewRenderer) { state.statusText = `${action} requested - no preview loaded`; return renderAll(handles, state); } if (action === 'fit') { state.selectedRef ? fitStagePreviewToSelection(state.previewRenderer, state.model, state.selectedRef) : fitStagePreviewToRenderPlan(state.previewRenderer, state.renderPlan); state.statusText = state.selectedRef ? 'Fit applied to selection' : 'Fit applied to preview'; } if (action === 'reset') { resetStagePreview(state.previewRenderer); state.statusText = 'Preview camera reset'; } if (action === 'fit-selection') { fitStagePreviewToSelection(state.previewRenderer, state.model, state.selectedRef); state.statusText = 'Fit applied to selection'; } updateStatus(handles, state); }
function restoreHistory(direction, handles, state) { const ok = direction === 'undo' ? undoJsonViewerState(state) : redoJsonViewerState(state); if (!ok) { state.statusText = `${direction}: no command`; return updateStatus(handles, state); } if (state.previewRenderer) { state.previewRenderer.selectedRef = state.selectedRef; state.previewRenderer.selectedRefs = state.selectedRefs || []; updateStagePreviewSelection(state.previewRenderer, state.model); syncPreviewTools(state.previewRenderer, state); } state.statusText = `${direction}: restored`; renderSidePanels(handles, state); }
function loadSample(handles, state) { try { resetToolState(state); state.workerDiagnostics = []; state.workerDiagnosticKeys = new Set(); state.activeJobId = ''; acceptModel(createSampleRvmStageModelV1(), SAMPLE_SOURCE_NAME, state); } catch (error) { clearLoadedModel(state, SAMPLE_SOURCE_NAME); state.validationErrors = [`Sample load failed: ${error?.message || error}`]; state.activePanel = 'diagnostics'; state.statusText = 'Sample load failed'; } renderAll(handles, state); }
async function loadStageFile(file, handles, state) { resetForWorkerFile(state, file.name, `reading-file: ${file.name}`); renderAll(handles, state); const text = await file.text(); const fileHash = await hashStageJsonText(file, text); const job = createStageJsonWorkerJob({ text, fileName: file.name, fileSize: file.size, fileHash }); await runWorkerJob(job, handles, state, (result) => applyWorkerResult(result, file.name, handles, state)); handles.fileInput.value = ''; }
async function loadRvmFile(file, handles, state) { resetForWorkerFile(state, file.name, `RVM binary selected: ${file.name}`); renderAll(handles, state); const arrayBuffer = await file.arrayBuffer(); const fileHash = await hashArrayBuffer(file, arrayBuffer, 'rvm-binary'); const job = createRvmBinaryWorkerJob({ arrayBuffer, fileName: file.name, fileSize: file.size, fileHash }); await runWorkerJob(job, handles, state, (result) => applyWorkerResult(result, file.name, handles, state, 'rvm-binary')); handles.rvmFileInput.value = ''; }
function resetForWorkerFile(state, fileName, statusText) { disposeWorkerClient(state); resetToolState(state); clearLoadedModel(state, fileName); state.workerDiagnostics = []; state.workerDiagnosticKeys = new Set(); state.activePanel = 'diagnostics'; state.statusText = statusText; }
function resetToolState(state) { state.visibility = createStageVisibilityState(); state.clip = createStageClipState(); state.clipResult = null; state.visibilityStats = { total: 0, visible: 0, hidden: 0 }; state.tags = []; state.tagDraft = null; state.tagCapture = { active: false, anchor: null }; state.componentFilter = 'all'; state.boxSelectActive = false; state.marqueeActive = false; state.measureActive = false; }
async function runWorkerJob(job, handles, state, applyResult) { state.activeJobId = job.jobId; try { const result = await runStageWorkerClientJob(ensureWorkerClient(handles, state), job); if (state.activeJobId === job.jobId) applyResult(result); } catch (error) { if (state.activeJobId === job.jobId) applyWorkerFailure({ error: { code: 'STAGE_WORKER_CLIENT_ERROR', message: error?.message || String(error) } }, handles, state, job.kind); } }
async function hashStageJsonText(file, text) { return hashBytes(file, new TextEncoder().encode(text), 'stage-json'); }
async function hashArrayBuffer(file, arrayBuffer, kind) { return hashBytes(file, new Uint8Array(arrayBuffer), kind); }
async function hashBytes(file, bytes, kind) { const cryptoApi = globalThis.crypto?.subtle; if (!cryptoApi) return `sha256-${kind}-${file.name}-${file.size}-${bytes.byteLength}`; const digest = await cryptoApi.digest('SHA-256', bytes); return `sha256-${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`; }
function downloadStageModel(handles, state) { if (!state.model) return; const download = buildStageModelDownload(state.model, state.sourceFileName); const url = URL.createObjectURL(new Blob([download.text], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = download.fileName; a.click(); URL.revokeObjectURL(url); state.statusText = `Downloaded ${download.fileName}`; updateStatus(handles, state); }
function downloadSelectionJson(handles, state) { const refs = state.selectedRefs?.length ? state.selectedRefs : state.selectedRef ? [state.selectedRef] : []; const rows = refs.map((ref) => ({ ref, item: itemForRef(state.model, ref) })); downloadBlob('json-viewer-selection.json', JSON.stringify({ source: state.sourceFileName, selected: rows }, null, 2), 'application/json'); state.statusText = `Exported ${rows.length} selected item(s)`; updateStatus(handles, state); }
function downloadSnapshot(handles, state) { const dataUrl = state.previewRenderer?.renderer?.domElement?.toDataURL?.('image/png'); if (!dataUrl) { state.statusText = 'Snapshot unavailable'; return updateStatus(handles, state); } const a = document.createElement('a'); a.href = dataUrl; a.download = 'json-viewer-snapshot.png'; a.click(); state.statusText = 'Exported viewport snapshot'; updateStatus(handles, state); }
function downloadBlob(name, text, type) { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function itemForRef(model, ref) { if (!model || !ref) return null; if (ref.type === 'root') return { id: ref.id, schema: model.schema, source: model.source }; if (ref.type === 'node') return model.hierarchy?.nodes?.find((item) => item.id === ref.id) || null; if (ref.type === 'component') return model.components?.find((item) => item.id === ref.id) || null; if (ref.type === 'primitive') return model.primitives?.find((item) => item.id === ref.id) || null; return null; }

const TOOL_ACTIONS = { 'tool-select': 'select', 'tool-orbit': 'orbit', 'tool-pan': 'pan' };
function setActiveTool(action, handles, state) {
  state.activeTool = TOOL_ACTIONS[action] || 'select';
  state.marqueeActive = false; state.measureActive = false; state.boxSelectActive = false;
  applyToolState(handles, state);
  state.statusText = `Tool: ${state.activeTool}`;
  updateStatus(handles, state);
}
function toggleMarquee(handles, state) {
  state.marqueeActive = !state.marqueeActive; state.measureActive = false; state.boxSelectActive = false;
  applyToolState(handles, state);
  state.statusText = state.marqueeActive ? 'Marquee Zoom: drag a window' : `Tool: ${state.activeTool}`;
  updateStatus(handles, state);
}
function toggleBoxSelect(handles, state) {
  state.boxSelectActive = !state.boxSelectActive; state.marqueeActive = false; state.measureActive = false;
  applyToolState(handles, state);
  state.statusText = state.boxSelectActive ? 'Box Select: drag a window' : `Tool: ${state.activeTool}`;
  updateStatus(handles, state);
}
function toggleMeasure(handles, state) {
  state.measureActive = !state.measureActive; state.marqueeActive = false; state.boxSelectActive = false;
  applyToolState(handles, state);
  if (!state.measureActive) { handles.measureReadout.hidden = true; handles.measureReadout.textContent = ''; }
  state.statusText = state.measureActive ? 'Measure: select first point' : `Tool: ${state.activeTool}`;
  updateStatus(handles, state);
}
function cancelActiveModes(handles, state) {
  state.marqueeActive = false; state.measureActive = false; state.boxSelectActive = false; state.tagCapture = { active: false, anchor: null }; state.tagDraft = null;
  state.enrichment.open = false; handles.measureReadout.hidden = true; handles.measureReadout.textContent = '';
  applyToolState(handles, state); state.statusText = 'Esc: active tools cancelled'; renderSidePanels(handles, state);
}
function applyToolState(handles, state) {
  const cameraMode = state.marqueeActive || state.measureActive || state.boxSelectActive ? 'select' : state.activeTool;
  if (state.previewRenderer) { setStagePreviewCameraMode(state.previewRenderer, cameraMode); setStagePreviewMarqueeActive(state.previewRenderer, state.marqueeActive); setStagePreviewBoxSelectActive(state.previewRenderer, state.boxSelectActive); setStagePreviewMeasureActive(state.previewRenderer, state.measureActive); }
  for (const [button, tool] of [[handles.selectToolButton, 'select'], [handles.orbitToolButton, 'orbit'], [handles.panToolButton, 'pan']]) button.classList.toggle('is-active', !state.marqueeActive && !state.measureActive && !state.boxSelectActive && state.activeTool === tool);
  handles.boxSelectButton.classList.toggle('is-active', state.boxSelectActive);
  handles.marqueeZoomButton.classList.toggle('is-active', state.marqueeActive);
  handles.measureToolButton.classList.toggle('is-active', state.measureActive);
}
const VIEW_ACTIONS = { 'view-iso': 'iso', 'view-top': 'top', 'view-front': 'front', 'view-side': 'side' };
function applyViewPreset(action, handles, state) { if (!state.previewRenderer) return; setStagePreviewView(state.previewRenderer, VIEW_ACTIONS[action]); state.statusText = `View: ${VIEW_ACTIONS[action]}`; updateStatus(handles, state); }

export function renderViewer3DJson(root) {
  const handles = createJsonViewerShell(root);
  const state = { model: null, renderPlan: null, previewRenderer: null, workerClient: null, previewDiagnostics: [], workerDiagnostics: [], workerDiagnosticKeys: new Set(), previewFitPending: false, activeJobId: '', sourceFileName: '', selectedRef: null, selectedRefs: [], validationErrors: [], renderQuality: 'full', activePanel: 'properties', statusText: 'Ready', activeTool: 'select', marqueeActive: false, measureActive: false, boxSelectActive: false, history: createJsonViewerHistory(), enrichment: createJsonViewerEnrichmentState() };
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
    downloadSelectionJson: () => downloadSelectionJson(handles, state),
    downloadSnapshot: () => downloadSnapshot(handles, state),
    recordUndo: () => pushJsonViewerUndo(state),
    restoreHistory: (direction) => restoreHistory(direction, handles, state),
    runPreviewCommand: (action) => runPreviewCommand(action, handles, state),
    setActiveTool: (action) => setActiveTool(action, handles, state),
    toggleBoxSelect: () => toggleBoxSelect(handles, state),
    toggleMarquee: () => toggleMarquee(handles, state),
    toggleMeasure: () => toggleMeasure(handles, state),
    cancelActiveModes: () => cancelActiveModes(handles, state),
    applyViewPreset: (action) => applyViewPreset(action, handles, state),
    applyPreviewSelection: (ref) => applyPreviewSelection(ref, handles, state),
    changeQuality: (value) => { state.renderQuality = normalizeRenderQuality(value); state.statusText = `Render quality: ${state.renderQuality}`; updateRenderPlan(state); renderAll(handles, state); },
  };
  state.controller = createJsonViewerInteractionController(handles, state, api);
  handles.qualitySelect.value = state.renderQuality; const cleanup = state.controller.wireEvents(); renderAll(handles, state);
  return () => { cleanup(); disposeWorkerClient(state); disposePreview(state); };
}
