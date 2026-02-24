/**
 * Metric extraction and formatting for advisory report display.
 */

import { toNumber } from './parsing';
import { stripMarkdownInline, normalizeLabel } from './markdown';
import { tryParseJson, isPlainObject } from './parsing';

export function getFirstNumber(value) {
  if (value == null) return null;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  return match ? toNumber(match[0]) : null;
}

export function formatScoreMetric(value) {
  const numeric = getFirstNumber(value);
  return numeric == null ? 'Not provided' : `${numeric}/100`;
}

function extractObjectMetric(data, aliases = [], jsonKeys = []) {
  if (!isPlainObject(data)) return null;
  const keySet = new Set([...aliases.map(normalizeLabel), ...jsonKeys.map(normalizeLabel)]);
  for (const [key, value] of Object.entries(data)) {
    if (value == null || value === '') continue;
    if (keySet.has(normalizeLabel(key))) return stripMarkdownInline(String(value));
  }
  return null;
}

export function extractMetricValue(markdown, aliases = [], jsonKeys = []) {
  if (typeof markdown !== 'string' || aliases.length === 0) return null;
  const aliasSet = new Set(aliases.map(normalizeLabel));

  const boldRegex = /\*\*\s*([^*:\n]+?)\s*\*\*\s*:\s*([^\n]+)/g;
  for (const match of markdown.matchAll(boldRegex)) {
    const label = normalizeLabel(match[1]);
    if (aliasSet.has(label)) return stripMarkdownInline(match[2]);
  }

  const lines = markdown.split('\n');
  for (const line of lines) {
    const cleanLine = stripMarkdownInline(line);
    if (!cleanLine || /^#{1,6}\s/.test(line.trim()) || cleanLine.startsWith('|')) continue;
    const pairMatch = cleanLine.match(/^([^:]{2,80}):\s*(.+)$/);
    if (!pairMatch) continue;
    const label = normalizeLabel(pairMatch[1]);
    if (aliasSet.has(label)) return stripMarkdownInline(pairMatch[2]);
  }

  const parsed = tryParseJson(markdown);
  return extractObjectMetric(parsed, aliases, jsonKeys);
}

export function getMetricTone(value, type = 'generic') {
  if (!value) return 'neutral';
  if (type === 'score') {
    const parsed = getFirstNumber(value);
    if (parsed == null) return 'neutral';
    if (parsed >= 80) return 'positive';
    if (parsed >= 60) return 'warn';
    return 'danger';
  }
  const normalized = String(value).toLowerCase();
  if (normalized.includes('low')) return 'positive';
  if (normalized.includes('moderate')) return 'warn';
  if (normalized.includes('high')) return 'danger';
  return 'neutral';
}

export function shouldShowFormattedBadge(normalized, meta) {
  if (normalized.coerced) return true;
  return meta?.source === 'coerced' || meta?.source === 'fallback';
}
