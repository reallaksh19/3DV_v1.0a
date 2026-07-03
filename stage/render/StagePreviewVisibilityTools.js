/**
 * Stage JSON preview visibility helpers.
 * Parameters: renderer state, StageModel, selection refs, and a visibility state with hidden/isolate keys.
 * Outputs: updated Three.js object visibility, row summaries, and display stats.
 * Fallback: missing renderer/model data returns empty objects and leaves geometry unchanged.
 */

export function createStageVisibilityState() {
  return { hiddenKeys: new Set(), isolateKey: '' };
}

export function stageRefKey(ref) {
  if (!ref?.type || !ref?.id) return '';
  return `${ref.type}:${ref.id}`;
}

export function createNextVisibilityState(visibility, command, ref) {
  const next = { hiddenKeys: new Set(visibility?.hiddenKeys || []), isolateKey: visibility?.isolateKey || '' };
  const key = stageRefKey(ref);
  if (command === 'hide' && key) next.hiddenKeys.add(key);
  if (command === 'unhide' && key) next.hiddenKeys.delete(key);
  if (command === 'isolate' && key) next.isolateKey = key;
  if (command === 'show-all') {
    next.hiddenKeys.clear();
    next.isolateKey = '';
  }
  if (command === 'clear-isolate') next.isolateKey = '';
  return next;
}

export function applyStagePreviewVisibility(rendererState, model, visibility) {
  if (!rendererState?.objectIndex) return visibilityStats(rendererState);
  const allObjects = collectAllObjects(rendererState);
  const isolateObjects = collectObjectsForKey(rendererState, model, visibility?.isolateKey || '');
  const isolateSet = new Set(isolateObjects);
  const hiddenSet = new Set();
  for (const key of visibility?.hiddenKeys || []) {
    for (const object of collectObjectsForKey(rendererState, model, key)) hiddenSet.add(object);
  }
  for (const object of allObjects) {
    object.visible = visibility?.isolateKey ? isolateSet.has(object) && !hiddenSet.has(object) : !hiddenSet.has(object);
  }
  return visibilityStats(rendererState);
}

export function collectObjectsForRef(rendererState, model, ref) {
  return collectObjectsForKey(rendererState, model, stageRefKey(ref));
}

export function collectObjectsForKey(rendererState, model, key) {
  if (!rendererState?.objectIndex || !key) return [];
  const [type, id] = key.split(':');
  if (type === 'root') return collectAllObjects(rendererState);
  if (type === 'primitive') return asArray(rendererState.objectIndex.primitiveId.get(id));
  if (type === 'component') return asArray(rendererState.objectIndex.componentId.get(id));
  if (type === 'node') return collectNodeObjects(rendererState, model, id);
  return [];
}

export function visibilityStats(rendererState) {
  const objects = collectAllObjects(rendererState);
  let visible = 0;
  for (const object of objects) if (object.visible !== false) visible += 1;
  return { total: objects.length, visible, hidden: Math.max(objects.length - visible, 0) };
}

export function hiddenVisibilityRows(model, visibility) {
  const rows = [];
  for (const key of visibility?.hiddenKeys || []) {
    const ref = refFromKey(key);
    const item = itemForRef(model, ref);
    rows.push({ key, ref, label: labelForItem(item, ref) });
  }
  return rows;
}

export function isRefHiddenByVisibility(ref, visibility) {
  const key = stageRefKey(ref);
  if (!key) return false;
  return visibility?.hiddenKeys?.has?.(key) || (visibility?.isolateKey && visibility.isolateKey !== key);
}

function collectNodeObjects(rendererState, model, nodeId) {
  const ids = descendantNodeIds(model, nodeId);
  const objects = [];
  for (const id of ids) objects.push(...asArray(rendererState.objectIndex.nodeId.get(id)));
  return uniqueObjects(objects);
}

function descendantNodeIds(model, nodeId) {
  const ids = new Set([nodeId]);
  const children = new Map();
  for (const node of model?.hierarchy?.nodes || []) {
    const parent = node.parentId || model?.hierarchy?.rootId || 'node-root';
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node.id);
  }
  const stack = [...(children.get(nodeId) || [])];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    stack.push(...(children.get(id) || []));
  }
  return ids;
}

function collectAllObjects(rendererState) {
  const values = [];
  rendererState?.rootGroup?.traverse?.((object) => {
    if (object?.userData?.stageRenderEntryId) values.push(object);
  });
  return uniqueObjects(values);
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function uniqueObjects(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function refFromKey(key) {
  const [type, ...rest] = String(key || '').split(':');
  const id = rest.join(':');
  return type && id ? { type, id } : null;
}

function itemForRef(model, ref) {
  if (!model || !ref) return null;
  if (ref.type === 'root') return { id: ref.id, name: ref.id };
  if (ref.type === 'node') return model.hierarchy?.nodes?.find((node) => node.id === ref.id) || null;
  if (ref.type === 'component') return model.components?.find((component) => component.id === ref.id) || null;
  if (ref.type === 'primitive') return model.primitives?.find((primitive) => primitive.id === ref.id) || null;
  return null;
}

function labelForItem(item, ref) {
  return item?.name || item?.semanticType || item?.kind || item?.id || ref?.id || 'hidden item';
}
