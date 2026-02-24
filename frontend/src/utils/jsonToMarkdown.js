/**
 * Converts JSON advisory outputs to markdown for display.
 * Handles structured backend responses and coerced/fallback formats.
 */

import { toList, tryParseJson, isPlainObject } from './parsing';
import { looksLikeMarkdown } from './markdown';

function allocationTable(currentAllocation, targetAllocation) {
  const current = currentAllocation && typeof currentAllocation === 'object' ? currentAllocation : {};
  const target = targetAllocation && typeof targetAllocation === 'object' ? targetAllocation : {};
  const categories = Array.from(new Set([...Object.keys(current), ...Object.keys(target)])).sort();
  if (categories.length === 0) return 'No allocation data available.';
  const lines = ['| Category | Current | Target |', '|---|---:|---:|'];
  categories.forEach((cat) => {
    lines.push(`| ${cat} | ${current[cat] ?? '-'} | ${target[cat] ?? '-'} |`);
  });
  return lines.join('\n');
}

export function createFallbackMarkdown(rawText, sectionName) {
  const summary = typeof rawText === 'string' && rawText.trim() ? rawText.trim() : 'The section was generated in an unstructured format.';
  return [
    `## ${sectionName}`,
    '### Summary',
    summary,
    '### Key Points',
    '- Response was reformatted to maintain readability.',
    '- Some structured fields were missing from the source output.',
    '### Actions',
    '1. Review this section with portfolio context.',
    '2. Regenerate the report if more precision is needed.',
  ].join('\n\n');
}

function jsonToRiskMarkdown(data) {
  const keyFindings = toList(data.key_findings || data.issues);
  const actions = toList(data.immediate_actions || data.recommended_actions);
  const severity = data.severity_score != null ? `${data.severity_score}/100` : 'Not provided';
  return [
    '## Risk Assessment',
    data.concentration_risk_analysis || data.summary || 'Risk review completed.',
    '### Risk Snapshot',
    `- **Risk Level:** ${data.risk_level || 'Not provided'}`,
    `- **Severity Score:** ${severity}`,
    '### Key Findings',
    keyFindings.length ? keyFindings.map((i) => `- ${i}`).join('\n') : '- Not available',
    '### Age & Goal Alignment',
    data.age_alignment || data.diversification_risk_analysis || 'Profile alignment data unavailable.',
    '### Immediate Actions',
    actions.length ? actions.map((i, idx) => `${idx + 1}. ${i}`).join('\n') : '1. No immediate actions provided.',
  ].join('\n\n');
}

function jsonToAllocationMarkdown(data) {
  const issues = toList(data.issues);
  const shifts = toList(data.recommended_shifts || data.immediate_actions);
  const confidence = data.confidence_score != null ? `${data.confidence_score}/100` : 'Not provided';
  return [
    '## Allocation Strategy',
    data.allocation_summary || data.summary || 'Current allocation shows imbalances across major buckets and requires targeted shifts.',
    '### Allocation Map',
    allocationTable(data.current_allocation, data.target_allocation),
    '### Issues',
    issues.length ? issues.map((i) => `- ${i}`).join('\n') : '- Not available',
    '### Recommended Shifts',
    shifts.length ? shifts.map((i, idx) => `${idx + 1}. ${i}`).join('\n') : '1. No shift guidance provided.',
    '### Confidence',
    `- **Confidence Score:** ${confidence}`,
  ].join('\n\n');
}

function jsonToBehaviorMarkdown(data) {
  const issues = toList(data.discipline_issues || data.issues);
  const nearTerm = toList(data.action_plan_0_30_days || data.immediate_actions);
  const mediumTerm = toList(data.action_plan_3_12_months || data.rebalance_plan_12m);
  const confidence = data.confidence_score != null ? `${data.confidence_score}/100` : 'Not provided';
  return [
    '## Behavioral Analysis',
    data.behavior_summary || data.summary || 'Behavioral analysis completed.',
    '### Discipline Issues',
    issues.length ? issues.map((i) => `- ${i}`).join('\n') : '- No discipline issues detected.',
    '### Action Plan (0-30 Days)',
    nearTerm.length ? nearTerm.map((i, idx) => `${idx + 1}. ${i}`).join('\n') : '1. No near-term actions provided.',
    '### Action Plan (3-12 Months)',
    mediumTerm.length ? mediumTerm.map((i, idx) => `${idx + 1}. ${i}`).join('\n') : '1. No medium-term actions provided.',
    '### Confidence',
    `- **Confidence Score:** ${confidence}`,
  ].join('\n\n');
}

function jsonToStrategyMarkdown(data) {
  const immediate = toList(data.immediate_actions);
  const rebalance = toList(data.rebalance_plan_12m);
  const longTerm = toList(data.long_term_plan_5y);
  const confidence = data.confidence_score != null ? `${data.confidence_score}/100` : 'Not provided';
  return [
    '## Chief Strategy Recommendation',
    data.summary || 'Personalized strategy generated.',
    '### Immediate Actions (0-30 Days)',
    immediate.length ? immediate.map((i, idx) => `${idx + 1}. ${i}`).join('\n') : '1. No immediate actions provided.',
    '### Rebalance Plan (3-12 Months)',
    rebalance.length ? rebalance.map((i, idx) => `${idx + 1}. ${i}`).join('\n') : '1. No rebalance steps provided.',
    '### Long-Term Plan (1-5 Years)',
    longTerm.length ? longTerm.map((i, idx) => `${idx + 1}. ${i}`).join('\n') : '1. No long-term plan provided.',
    '### Confidence',
    `- **Confidence Score:** ${confidence}`,
  ].join('\n\n');
}

function jsonToExecutiveMarkdown(data, validationScore) {
  const nextSteps = toList(data.next_steps || data.immediate_actions);
  const metrics = toList(data.key_metrics || data.expected_outcomes);
  const confidence = data.confidence_rating ?? data.confidence_score;
  const confidenceDisplay = confidence != null ? `${confidence}/100` : 'Not provided';
  return [
    '## Executive Summary',
    validationScore != null ? `- **Validation Score:** ${validationScore}/100` : '- **Validation Score:** Not provided',
    data.summary_text || data.summary || 'Executive brief generated.',
    '### Next Steps',
    nextSteps.length ? nextSteps.map((i, idx) => `${idx + 1}. ${i}`).join('\n') : '1. No next steps provided.',
    '### Key Metrics To Track',
    metrics.length ? metrics.map((i) => `- ${i}`).join('\n') : '- No key metrics provided.',
    '### Confidence',
    `- **Confidence Rating:** ${confidenceDisplay}`,
  ].join('\n\n');
}

function convertJsonToMarkdown(data, sectionName, context = {}) {
  switch (sectionName) {
    case 'risk':
      return jsonToRiskMarkdown(data);
    case 'allocation':
      return jsonToAllocationMarkdown(data);
    case 'behavior':
      return jsonToBehaviorMarkdown(data);
    case 'strategy':
      return jsonToStrategyMarkdown(data);
    case 'executive':
      return jsonToExecutiveMarkdown(data, context.validationScore);
    default:
      return createFallbackMarkdown(JSON.stringify(data, null, 2), 'Advisory Section');
  }
}

export function normalizeMarkdownContent(value, sectionName, context = {}) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = tryParseJson(value);
    if (isPlainObject(parsed) && Object.keys(parsed).length > 0) {
      return { markdown: convertJsonToMarkdown(parsed, sectionName, context), coerced: true };
    }
    if (looksLikeMarkdown(value)) return { markdown: value, coerced: false };
    return { markdown: createFallbackMarkdown(value, sectionName), coerced: true };
  }
  if (value && typeof value === 'object') {
    return { markdown: convertJsonToMarkdown(value, sectionName, context), coerced: true };
  }
  return { markdown: createFallbackMarkdown('', sectionName), coerced: true };
}
