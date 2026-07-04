const MAX_RESULTS = 500;

export function buildJsonSearchIndex(model) {
  const entries = [];
  for (const node of model?.hierarchy?.nodes || []) {
    entries.push({ kind: 'NODE', id: node.id, label: node.name || node.id,
      searchText: normalize(`${node.id} ${node.name} ${node.path || ''}`),
      ref: { type: 'node', id: node.id } });
  }
  for (const component of model?.components || []) {
    entries.push({ kind: component.semanticType || 'COMP', id: component.id,
      label: component.name || component.id,
      searchText: normalize(`${component.id} ${component.name} ${component.semanticType}`),
      ref: { type: 'component', id: component.id } });
  }
  return entries;
}

export function searchJsonIndex(entries, query, kindFilter = 'all') {
  const q = normalize(query);
  return (entries || []).filter(entry =>
    (!q || entry.searchText.includes(q)) &&
    (kindFilter === 'all' || normalize(entry.kind).includes(kindFilter))
  ).slice(0, MAX_RESULTS);
}

function normalize(v) { return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
