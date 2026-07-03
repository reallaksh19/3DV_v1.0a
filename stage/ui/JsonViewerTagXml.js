import { RvmTagXmlStore } from '../../rvm/RvmTagXmlStore.js';

/**
 * Functionality: bridges JSON-viewer tag records to the RVM viewer Navis XML
 * exchange format. Parameters: canvas tag records and source identity.
 * Outputs: Navis-style <exchange> XML or imported canvas tag records.
 * Fallback: imported tags without 3D positions are placed at the origin so the
 * tag remains visible and editable rather than being discarded silently.
 */

export function serializeJsonViewerTags(tags, sourceName) {
  const store = new RvmTagXmlStore(null, `json-viewer-export-${Date.now()}`);
  for (const tag of tags || []) store.createTag(toRvmTag(tag, sourceName));
  return store.exportToXml();
}

export function parseJsonViewerTags(xmlText) {
  if (typeof DOMParser === 'undefined') return [];
  try {
    const store = new RvmTagXmlStore(null, `json-viewer-import-${Date.now()}`);
    return store.importFromXml(String(xmlText || '')).map(fromRvmTag);
  } catch (error) {
    return [];
  }
}

function toRvmTag(tag, sourceName) {
  const anchor = point(tag.anchor) || { x: 0, y: 0, z: 0 };
  const labelPoint = point(tag.labelPoint) || anchor;
  const colour = severityColour(tag.severity);
  return {
    id: tag.id || `TAG-${Date.now()}`,
    text: tag.text || '',
    severity: tag.severity || 'info',
    canonicalObjectId: refId(tag.ref),
    sourceObjectId: refId(tag.ref),
    anchorType: tag.ref?.type || 'object',
    worldPosition: anchor,
    cameraState: tag.cameraState || null,
    navis: {
      format: 'navisworks-exchange-12.0',
      rootAttrs: { filename: sourceName || 'stage-json-viewer' },
      comment: { status: 'new', user: 'PCF_GLB_Viewer_Conv', body: tag.text || '' },
      redline: { colour, pos1: screenPoint(anchor), pos2: screenPoint(labelPoint) },
    },
  };
}

function fromRvmTag(tag) {
  const anchor = point(tag.worldPosition) || point(tag.navis?.redline?.pos3d) || { x: 0, y: 0, z: 0 };
  return {
    id: tag.id || `tag-${Date.now()}`,
    text: tag.text || tag.navis?.comment?.body || 'Imported tag',
    severity: tag.severity || 'info',
    ref: refFromTag(tag),
    anchor,
    labelPoint: offsetLabel(anchor),
    cameraState: tag.cameraState || null,
    navis: tag.navis || null,
  };
}

function refId(ref) {
  return ref?.type && ref?.id ? `${ref.type}:${ref.id}` : '';
}

function refFromTag(tag) {
  const raw = tag.canonicalObjectId || tag.sourceObjectId || '';
  const [type, ...idParts] = String(raw).split(':');
  const id = idParts.join(':');
  return type && id ? { type, id } : null;
}

function severityColour(severity) {
  if (severity === 'high') return { red: 1, green: 0, blue: 0 };
  if (severity === 'warning') return { red: 1, green: 0.75, blue: 0 };
  return { red: 0, green: 0.45, blue: 1 };
}

function screenPoint(worldPoint) {
  const x = Number(worldPoint?.x), y = Number(worldPoint?.y);
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

function offsetLabel(anchor) {
  return { x: anchor.x + 1, y: anchor.y + 1, z: anchor.z + 1 };
}

function point(value) {
  const out = { x: Number(value?.x), y: Number(value?.y), z: Number(value?.z) };
  return Object.values(out).every(Number.isFinite) ? out : null;
}
