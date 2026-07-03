/**
 * Functionality: snapshots JSON viewer interaction state for undo/redo.
 * Parameters: the mutable tab state before or after a user command.
 * Outputs: restored selection, visibility, clipping, tag, and tool state.
 * Fallback: invalid history entries are ignored without changing the model.
 */

export function createJsonViewerHistory() {
  return { undo: [], redo: [] };
}

export function pushJsonViewerUndo(state) {
  if (!state?.history) return;
  state.history.undo.push(snapshot(state));
  if (state.history.undo.length > 60) state.history.undo.shift();
  state.history.redo = [];
}

export function undoJsonViewerState(state) {
  if (!state?.history?.undo?.length) return false;
  state.history.redo.push(snapshot(state));
  restore(state, state.history.undo.pop());
  return true;
}

export function redoJsonViewerState(state) {
  if (!state?.history?.redo?.length) return false;
  state.history.undo.push(snapshot(state));
  restore(state, state.history.redo.pop());
  return true;
}

function snapshot(state) {
  return {
    selectedRef: cloneRef(state.selectedRef),
    selectedRefs: (state.selectedRefs || []).map(cloneRef).filter(Boolean),
    visibility: { hiddenKeys: [...(state.visibility?.hiddenKeys || [])], isolateKey: state.visibility?.isolateKey || '' },
    clip: plain(state.clip),
    tags: plain(state.tags || []),
    tagDraft: plain(state.tagDraft),
    tagCapture: plain(state.tagCapture || { active: false, anchor: null }),
    activePanel: state.activePanel,
    componentFilter: state.componentFilter,
  };
}

function restore(state, snap) {
  if (!snap || typeof snap !== 'object') return;
  state.selectedRef = cloneRef(snap.selectedRef);
  state.selectedRefs = (snap.selectedRefs || []).map(cloneRef).filter(Boolean);
  state.visibility = { hiddenKeys: new Set(snap.visibility?.hiddenKeys || []), isolateKey: snap.visibility?.isolateKey || '' };
  state.clip = snap.clip || state.clip;
  state.tags = snap.tags || [];
  state.tagDraft = snap.tagDraft || null;
  state.tagCapture = snap.tagCapture || { active: false, anchor: null };
  state.activePanel = snap.activePanel || state.activePanel;
  state.componentFilter = snap.componentFilter || 'all';
}

function cloneRef(ref) {
  return ref?.type && ref?.id ? { type: ref.type, id: ref.id } : null;
}

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
