/**
 * Stage JSON viewer tag XML helpers.
 * Parameters: in-memory tag records or XML text from the file input.
 * Outputs: a compact XML string or parsed tag records with world-space points.
 * Fallback: malformed XML returns an empty parsed list instead of mutating viewer state.
 */

export function serializeJsonViewerTags(tags, sourceName) {
  const rows = (tags || []).map((tag) => [
    `  <tag id="${esc(tag.id)}" severity="${esc(tag.severity || 'info')}" refType="${esc(tag.ref?.type || '')}" refId="${esc(tag.ref?.id || '')}">`,
    `    <text>${esc(tag.text || '')}</text>`,
    pointXml('anchor', tag.anchor),
    pointXml('labelPoint', tag.labelPoint),
    '  </tag>',
  ].join('\n'));
  return [`<?xml version="1.0" encoding="UTF-8"?>`, `<jsonViewerTags source="${esc(sourceName || 'stage-json-viewer')}">`, ...rows, '</jsonViewerTags>'].join('\n');
}

export function parseJsonViewerTags(xmlText) {
  if (typeof DOMParser === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
    if (doc.querySelector('parsererror')) return [];
    return [...doc.querySelectorAll('tag')].map(tagFromElement).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function tagFromElement(element) {
  const anchor = pointFromElement(element.querySelector('anchor'));
  const labelPoint = pointFromElement(element.querySelector('labelPoint'));
  if (!anchor || !labelPoint) return null;
  const refType = element.getAttribute('refType') || '';
  const refId = element.getAttribute('refId') || '';
  return {
    id: element.getAttribute('id') || `tag-${Date.now()}`,
    text: element.querySelector('text')?.textContent || 'Imported tag',
    severity: element.getAttribute('severity') || 'info',
    ref: refType && refId ? { type: refType, id: refId } : null,
    anchor,
    labelPoint,
  };
}

function pointXml(name, point) {
  return `    <${name} x="${num(point?.x)}" y="${num(point?.y)}" z="${num(point?.z)}" />`;
}

function pointFromElement(element) {
  if (!element) return null;
  const point = { x: Number(element.getAttribute('x')), y: Number(element.getAttribute('y')), z: Number(element.getAttribute('z')) };
  return Object.values(point).every(Number.isFinite) ? point : null;
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '0';
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
