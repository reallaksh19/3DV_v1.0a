import { fitStagePreviewToSelection, updateStagePreviewSelection } from '../render/StageThreePreviewRenderer.js';
import { clipSummary, createNextClipState } from '../render/StagePreviewClipTools.js';
import { createNextVisibilityState, isRefHiddenByVisibility } from '../render/StagePreviewVisibilityTools.js';
import { parseJsonViewerTags, serializeJsonViewerTags } from './JsonViewerTagXml.js';

/**
 * Wires Stage JSON viewer commands to renderer state.
 * Parameters: shell handles, mutable tab state, and bound renderer callbacks.
 * Outputs: cleanup and canvas tag-capture handlers used by the tab renderer.
 * Fallback: commands with no loaded model update status instead of throwing.
 */

const TOOL_ACTIONS = { 'tool-select': 'select', 'tool-orbit': 'orbit', 'tool-pan': 'pan' };
const VIEW_ACTIONS = { 'view-iso': 'iso', 'view-top': 'top', 'view-front': 'front', 'view-side': 'side' };
const VISIBILITY_ACTIONS = { 'hide-selection': 'hide', 'unhide-selection': 'unhide', 'isolate-selection': 'isolate', 'show-all': 'show-all' };
const CLIP_ACTIONS = new Set(['clip-box-selection', 'clip-box-model', 'clip-plane', 'clip-clear']);

export function createJsonViewerInteractionController(handles, state, api) {
  const onToolbarClick = (event) => {
    const action = event.target?.closest?.('[data-action]')?.dataset?.action; if (!action) return;
    if (action === 'open-stage-json') return handles.fileInput.click();
    if (action === 'open-rvm') return handles.rvmFileInput.click();
    if (action === 'download-stage-model') return api.downloadStageModel();
    if (action === 'load-sample') return api.loadSample();
    if (action === 'show-diagnostics') return setPanel('diagnostics', api);
    if (action === 'clear-selection') return clearSelection(state, api);
    if (applyVisibilityAction(action, state, api)) return;
    if (CLIP_ACTIONS.has(action)) return applyClipAction(action, state, api);
    if (handleTagAction(action, handles, state, api)) return;
    if (action === 'fit' || action === 'reset' || action === 'fit-selection') return api.runPreviewCommand(action);
    if (TOOL_ACTIONS[action]) return api.setActiveTool(action);
    if (action === 'tool-marquee') return api.toggleMarquee();
    if (action === 'tool-measure') return api.toggleMeasure();
    if (VIEW_ACTIONS[action]) return api.applyViewPreset(action);
  };
  const onFileChange = (event) => { const file = event.target.files?.[0]; if (file) api.loadStageFile(file); };
  const onRvmFileChange = (event) => { const file = event.target.files?.[0]; if (file) api.loadRvmFile(file); };
  const onTagFileChange = (event) => { const file = event.target.files?.[0]; if (file) importTagsFile(file, handles, state, api); handles.tagFileInput.value = ''; };
  const onQualityChange = () => api.changeQuality(handles.qualitySelect.value);
  const onTreeClick = (event) => {
    const toggle = event.target.closest?.('[data-visibility-toggle-type]');
    if (toggle) return toggleObjectVisibility(state, { type: toggle.dataset.visibilityToggleType, id: toggle.dataset.visibilityToggleId }, api);
    const tagRow = event.target.closest?.('[data-tag-row-type]');
    if (tagRow) { state.selectedRef = { type: tagRow.dataset.tagRowType, id: tagRow.dataset.tagRowId }; return startTagCapture(state, api); }
    const row = event.target.closest?.('[data-ref-type][data-ref-id]'); if (!row) return;
    api.applyPreviewSelection({ type: row.dataset.refType, id: row.dataset.refId });
    if (state.previewRenderer) fitStagePreviewToSelection(state.previewRenderer, state.model, state.selectedRef);
  };
  const onTreeFilter = () => {
    const query = handles.treeFilterInput.value.trim().toLowerCase();
    for (const item of handles.hierarchyList.querySelectorAll('.json-viewer-tree-item')) item.style.display = !query || item.textContent.toLowerCase().includes(query) ? '' : 'none';
  };
  const onShellClick = (event) => {
    const filter = event.target?.closest?.('[data-component-filter]')?.dataset?.componentFilter;
    if (filter) { state.componentFilter = filter; api.renderSidePanels(); }
  };
  const onHiddenClick = (event) => {
    const row = event.target?.closest?.('[data-restore-ref-type]'); if (!row) return;
    state.visibility = createNextVisibilityState(state.visibility, 'unhide', { type: row.dataset.restoreRefType, id: row.dataset.restoreRefId });
    api.syncPreviewTools(); api.renderSidePanels();
  };
  const onRightClick = (event) => {
    const panel = event.target?.dataset?.panel; if (panel) return setPanel(panel, api);
    const axis = event.target?.closest?.('[data-clip-axis]')?.dataset?.clipAxis; if (axis) { state.clip = createNextClipState(state.clip, 'axis', { value: axis }); return applyClipAction('clip-plane', state, api); }
    const focusId = event.target?.closest?.('[data-tag-focus]')?.dataset?.tagFocus; if (focusId) return focusTag(focusId, state, api);
    const deleteId = event.target?.closest?.('[data-tag-delete]')?.dataset?.tagDelete; if (deleteId) return deleteTag(deleteId, state, api);
    const action = event.target?.closest?.('[data-action]')?.dataset?.action; if (action) onToolbarClick(event);
  };
  const onRightInput = (event) => {
    if (event.target?.matches?.('[data-clip-percent], [data-clip-percent-number]')) { state.clip = createNextClipState(state.clip, 'percent', { value: event.target.value }); applyClipAction('clip-plane', state, api); }
    if (event.target?.matches?.('[data-clip-invert]')) { state.clip = createNextClipState(state.clip, 'invert', { value: event.target.checked }); applyClipAction('clip-plane', state, api); }
  };
  const onRightSubmit = (event) => { const form = event.target?.closest?.('[data-tag-draft-form]'); if (form) { event.preventDefault(); saveTagDraft(form, state, api); } };
  const onDrop = (event) => { event.preventDefault(); const file = event.dataTransfer?.files?.[0]; if (!file) return; file.name.toLowerCase().endsWith('.rvm') ? api.loadRvmFile(file) : api.loadStageFile(file); };
  const onDragOver = (event) => event.preventDefault();
  return { wireEvents: () => wire(handles, { onToolbarClick, onFileChange, onRvmFileChange, onTagFileChange, onQualityChange, onTreeClick, onTreeFilter, onShellClick, onHiddenClick, onRightClick, onRightInput, onRightSubmit, onDrop, onDragOver }), handleTagCanvasClick: (hit) => handleTagCanvasClick(hit, state, api) };
}

function wire(handles, events) {
  handles.toolbar.addEventListener('click', events.onToolbarClick); handles.navRow.addEventListener('click', events.onToolbarClick); handles.fileInput.addEventListener('change', events.onFileChange); handles.rvmFileInput.addEventListener('change', events.onRvmFileChange); handles.tagFileInput.addEventListener('change', events.onTagFileChange); handles.qualitySelect.addEventListener('change', events.onQualityChange); handles.hierarchyList.addEventListener('click', events.onTreeClick); handles.hiddenList.addEventListener('click', events.onHiddenClick); handles.treeFilterInput.addEventListener('input', events.onTreeFilter); handles.shell.addEventListener('click', events.onShellClick); handles.rightPanel.addEventListener('click', events.onRightClick); handles.rightPanel.addEventListener('input', events.onRightInput); handles.rightPanel.addEventListener('change', events.onRightInput); handles.rightPanel.addEventListener('submit', events.onRightSubmit); handles.shell.addEventListener('drop', events.onDrop); handles.shell.addEventListener('dragover', events.onDragOver);
  return () => { handles.toolbar.removeEventListener('click', events.onToolbarClick); handles.navRow.removeEventListener('click', events.onToolbarClick); handles.fileInput.removeEventListener('change', events.onFileChange); handles.rvmFileInput.removeEventListener('change', events.onRvmFileChange); handles.tagFileInput.removeEventListener('change', events.onTagFileChange); handles.qualitySelect.removeEventListener('change', events.onQualityChange); handles.hierarchyList.removeEventListener('click', events.onTreeClick); handles.hiddenList.removeEventListener('click', events.onHiddenClick); handles.treeFilterInput.removeEventListener('input', events.onTreeFilter); handles.shell.removeEventListener('click', events.onShellClick); handles.rightPanel.removeEventListener('click', events.onRightClick); handles.rightPanel.removeEventListener('input', events.onRightInput); handles.rightPanel.removeEventListener('change', events.onRightInput); handles.rightPanel.removeEventListener('submit', events.onRightSubmit); handles.shell.removeEventListener('drop', events.onDrop); handles.shell.removeEventListener('dragover', events.onDragOver); };
}

function setPanel(panel, api) { api.setPanel(panel); api.renderSidePanels(); }
function clearSelection(state, api) { state.selectedRef = null; if (state.previewRenderer) { state.previewRenderer.selectedRef = null; updateStagePreviewSelection(state.previewRenderer, state.model); } state.statusText = 'Selection cleared'; api.renderSidePanels(); }
function applyVisibilityAction(action, state, api) { const command = VISIBILITY_ACTIONS[action]; if (!command) return false; if (!state.model) return status('Visibility: load a model first', state, api); if (command !== 'show-all' && !state.selectedRef) return status('Visibility: select a row or object first', state, api); state.visibility = createNextVisibilityState(state.visibility, command, state.selectedRef); state.statusText = command === 'show-all' ? 'Visibility: show all' : `Visibility: ${command} ${state.selectedRef.type} ${state.selectedRef.id}`; api.syncPreviewTools(); api.renderSidePanels(); return true; }
function toggleObjectVisibility(state, ref, api) { const command = isRefHiddenByVisibility(ref, state.visibility) ? 'unhide' : 'hide'; state.visibility = createNextVisibilityState(state.visibility, command, ref); state.statusText = `${command === 'hide' ? 'Hidden' : 'Unhidden'} ${ref.type} ${ref.id}`; api.syncPreviewTools(); api.renderSidePanels(); }
function applyClipAction(action, state, api) { const command = action === 'clip-clear' ? 'clear' : action.replace('clip-', ''); state.clip = createNextClipState(state.clip, command, { rendererState: state.previewRenderer, model: state.model, selectedRef: state.selectedRef }); state.activePanel = 'clip'; state.statusText = state.clip.mode === 'off' ? 'Clip: off' : clipSummary(state.clip); api.syncPreviewTools(); api.renderSidePanels(); }
function startTagCapture(state, api) { state.tagCapture = state.tagCapture.active ? { active: false, anchor: null } : { active: true, anchor: null }; state.tagDraft = state.tagCapture.active ? state.tagDraft : null; state.activePanel = 'tags'; state.statusText = state.tagCapture.active ? 'Tag: click anchor point' : 'Tag creation cancelled'; api.renderSidePanels(); }
function handleTagCanvasClick(hit, state, api) { if (!state.tagCapture.active) return; if (!hit?.point) return status('Tag: click directly on model geometry', state, api); state.activePanel = 'tags'; if (!state.tagCapture.anchor) { state.tagCapture = { active: true, anchor: hit.point }; state.statusText = 'Tag: anchor set, click label point'; } else { state.tagDraft = { anchor: state.tagCapture.anchor, labelPoint: hit.point, ref: state.selectedRef }; state.tagCapture = { active: false, anchor: null }; state.statusText = 'Tag: draft ready'; } api.syncPreviewTools(); api.renderSidePanels(); }
function saveTagDraft(form, state, api) { if (!state.tagDraft) return; const text = form.querySelector('[data-tag-draft-text]')?.value || 'Manual tag'; const severity = form.querySelector('[data-tag-draft-severity]')?.value || 'info'; state.tags = [...state.tags, { id: `tag-${Date.now()}`, text, severity, ref: state.tagDraft.ref || state.selectedRef, anchor: state.tagDraft.anchor, labelPoint: state.tagDraft.labelPoint }]; state.tagDraft = null; state.statusText = `Tag saved: ${text}`; api.syncPreviewTools(); api.renderSidePanels(); }
function handleTagAction(action, handles, state, api) { if (action === 'tag-create') { startTagCapture(state, api); return true; } if (action === 'tag-view') { state.activePanel = 'tags'; api.renderSidePanels(); return true; } if (action === 'tag-import') { handles.tagFileInput.click(); return true; } if (action === 'tag-export') { exportTags(state, api); return true; } if (action === 'tag-cancel-draft') { state.tagDraft = null; api.renderSidePanels(); return true; } return false; }
function exportTags(state, api) { const xml = serializeJsonViewerTags(state.tags, state.sourceFileName || state.model?.source?.fileName); const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); const a = document.createElement('a'); a.href = url; a.download = 'json-viewer-tags.xml'; a.click(); URL.revokeObjectURL(url); state.statusText = `Exported ${state.tags.length} tag(s)`; api.updateStatus(); }
async function importTagsFile(file, handles, state, api) { if (!file) return; const imported = parseJsonViewerTags(await file.text()); state.tags = [...state.tags, ...imported]; state.activePanel = 'tags'; state.statusText = `Imported ${imported.length} tag(s) from ${file.name}`; api.syncPreviewTools(); api.renderSidePanels(); }
function focusTag(id, state, api) { const tag = state.tags.find((item) => item.id === id); if (!tag) return; state.selectedRef = tag.ref || state.selectedRef; if (state.previewRenderer && state.selectedRef) fitStagePreviewToSelection(state.previewRenderer, state.model, state.selectedRef); state.statusText = `Focused tag: ${tag.text || tag.id}`; api.renderSidePanels(); }
function deleteTag(id, state, api) { state.tags = state.tags.filter((tag) => tag.id !== id); state.statusText = `Deleted tag ${id}`; api.syncPreviewTools(); api.renderSidePanels(); }
function status(text, state, api) { state.statusText = text; api.updateStatus(); return true; }
