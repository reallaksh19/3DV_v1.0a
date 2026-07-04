import { deriveLineKeyFromBranchName } from '../../converters/xml-cii2019-core/regex-line-key.js';
import { buildPipingClassIndex } from '../../converters/xml-cii2019-core/piping-class-resolver.js';
import { resolveBranchProcessData } from '../../converters/xml-cii2019-core/branch-process-resolver.js';
import {
  derivePipingClassFromBranchName,
  deriveBoreFromBranchName,
  findLineListRow,
} from '../../enrichment/selected-geometry-branch-helpers.js';
import { parseXmlCiiEnrichmentConfig } from '../../converters/xml-cii2019-core/config.js';
import { rowNumber } from '../../enrichment/selected-geometry-shared.js';

export function runJsonViewerEnrichment(model, enrichmentState) {
  const config = buildConfig(enrichmentState);
  const pipingClassIndex = buildPipingClassIndex(enrichmentState.masters.pipingClass || []);

  const enrichedAttributes = new Map(); // nodeId → EnrichedPipingAttributes

  const nodeGroups = groupComponentsByNode(model);

  for (const [nodeId, { node }] of nodeGroups.entries()) {
    const branchName = node.name || node.path || nodeId;
    const lineKey = deriveLineKeyFromBranchName(branchName, config);
    const lineRow = findLineListRow(lineKey, config);

    const pipingClassFromBranch = derivePipingClassFromBranchName(branchName, config);
    let boreMm = deriveBoreFromBranchName(branchName, config);
    if (boreMm == null && lineRow) {
      boreMm = rowNumber(lineRow, ['bore', 'DN', 'NB', 'NPS']);
    }

    const resolved = resolveBranchProcessData({
      branchName,
      lineKey,
      lineRow: { ...(lineRow || {}), pipingClass: pipingClassFromBranch },
      boreMm,
      componentType: 'PIPE',
      rating: '',
      materialMap: enrichmentState.masters.materialMap || [],
      pipingClassIndex,
      overrides: config.overrides || {},
      xmlNode: null,
      xmlBranch: null,
      config,
    });

    // Normalize to unified schema
    enrichedAttributes.set(nodeId, {
      lineNo:                   resolved.lineNo || lineKey,
      pipingClass:              resolved.pipingClass,
      pressureRating:           resolved.rating,
      designPressureMpa:        toMpa(resolved.p1),
      designTemperatureC:       toNumber(resolved.t1),
      operatingTemperatureC:    toNumber(resolved.t2),
      minimumTemperatureC:      toNumber(resolved.t3),
      nominalBoreMm:            boreMm,
      schedule:                 resolved.schedule,
      wallThicknessMm:          resolved.wallThicknessMm,
      corrosionAllowanceMm:     resolved.corrosionAllowanceMm,
      material:                 resolved.material,
      materialCode:             resolved.materialCode,
      fluidService:             resolved.fluid || resolved.service,
      componentWeightKg:        resolved.bestWeightKg,
      pipeWeightKgPerM:         resolved.unitPipeWeightKgPerM,
      // Audit
      enrichmentConfidence:     resolved.confidence || 'missing',
      needsReview:              resolved.needsReview || false,
      conflicts:                resolved.conflicts || [],
    });
  }

  return enrichedAttributes;
}

function buildConfig(state) {
  const rawConfig = {
    linelist: {
      tokenDelimiter: state.delimiter || '-',
      lineKeyTokenPositions: String(state.lineKeyPosition || 4),
    },
    rating: {
      tokenDelimiter: state.delimiter || '-',
      pipingClassTokenIndex: String(state.pipingClassPosition || 5),
    },
    weight: {
      tokenDelimiter: state.delimiter || '-',
      boreTokenIndex: String(state.sizePosition || 3),
    }
  };
  const config = parseXmlCiiEnrichmentConfig(JSON.stringify(rawConfig));
  config.linelist.masterRows = state.masters.lineList || [];
  return config;
}

function groupComponentsByNode(model) {
  const groups = new Map();
  const nodesById = model?.hierarchy?.nodesById || {};
  for (const comp of model?.components || []) {
    if (!comp.nodeId) continue;
    if (!groups.has(comp.nodeId)) {
      groups.set(comp.nodeId, { node: nodesById[comp.nodeId] || { name: comp.nodeId }, components: [] });
    }
    groups.get(comp.nodeId).components.push(comp);
  }
  return groups;
}

function toMpa(raw) {
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function toNumber(raw) {
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function summarizeEnrichmentCoverage(enrichedMap) {
  let full = 0;
  let partial = 0;
  let missing = 0;
  let conflicts = 0;

  for (const attrs of enrichedMap.values()) {
    if (attrs.conflicts && attrs.conflicts.length > 0) {
      conflicts++;
    } else if (attrs.enrichmentConfidence === 'missing' || !attrs.lineNo) {
      missing++;
    } else if (attrs.needsReview) {
      partial++;
    } else {
      full++;
    }
  }
  return { full, partial, missing, conflicts, total: enrichedMap.size };
}
