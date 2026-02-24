/**
 * Markdown detection and parsing utilities for advisory report display.
 */

/**
 * Returns true if text appears to contain markdown syntax (headings, lists, bold, links, tables).
 * @param {string} text - Raw text to check
 * @returns {boolean}
 */
export function looksLikeMarkdown(text) {
  if (typeof text !== 'string') return false;
  return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(^\|.+\|\s*$)/m.test(text);
}

/**
 * Strips markdown formatting from inline text for display.
 * @param {string} text - Text with markdown
 * @returns {string}
 */
export function stripMarkdownInline(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/^\s*[-*]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .trim();
}

/**
 * Normalizes a label for comparison (lowercase, collapse whitespace).
 * @param {string} label - Raw label
 * @returns {string}
 */
export function normalizeLabel(label) {
  if (typeof label !== 'string') return '';
  return label
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStructuralBlock(block) {
  const trimmed = block.trim();
  if (!trimmed) return true;
  if (/^#{1,6}\s/.test(trimmed) || trimmed.startsWith('|')) return true;
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  const allListLines = lines.every((l) => /^[-*]\s+|^\d+\.\s+/.test(l));
  if (allListLines) return true;
  const allShortLabels = lines.every((l) => {
    const cleaned = stripMarkdownInline(l);
    if (!cleaned.endsWith(':')) return false;
    return cleaned.split(/\s+/).length <= 6;
  });
  return allShortLabels;
}

/**
 * Extracts a summary sentence and remaining details from markdown content.
 * @param {string} markdown - Full markdown text
 * @returns {{ summary: string, details: string }}
 */
export function extractSummaryAndDetails(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return { summary: 'No summary available.', details: '' };
  }
  const blocks = markdown.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let summary = '';
  let summaryIndex = -1;

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (isStructuralBlock(block)) continue;
    const cleaned = stripMarkdownInline(block.replace(/\n/g, ' '));
    const sentenceLike = /[.!?]\s*$/.test(cleaned) || /[.!?]\s/.test(cleaned);
    if (cleaned.length >= 40 || sentenceLike) {
      summary = cleaned;
      summaryIndex = i;
      break;
    }
  }

  if (!summary) {
    const listCandidates = markdown
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+|^\d+\.\s+/.test(l))
      .map(stripMarkdownInline)
      .filter((l) => l && l.length > 24 && !/^(summary|confidence|validation)\b/i.test(l));
    summary = listCandidates.length > 0 ? listCandidates.slice(0, 2).join(' ') : 'No summary available.';
  }

  const details = blocks.filter((_, idx) => idx !== summaryIndex).join('\n\n');
  return { summary, details };
}

/**
 * Extracts top action items from markdown (numbered or bullet lists).
 * @param {string} markdown - Markdown text
 * @param {number} maxItems - Max items to return
 * @returns {string[]}
 */
export function extractTopActions(markdown, maxItems = 3) {
  if (typeof markdown !== 'string') return ['Review section details for prioritized actions.'];
  const actions = [];
  const seen = new Set();
  const lines = markdown.split('\n').map((l) => l.trim()).filter(Boolean);

  const tryAddAction = (candidate) => {
    const cleaned = stripMarkdownInline(candidate);
    if (!cleaned) return false;
    if (/^(summary|confidence|validation|deep dive)\b/i.test(cleaned)) return false;
    const key = normalizeLabel(cleaned);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    actions.push(cleaned);
    return actions.length >= maxItems;
  };

  for (const line of lines) {
    const ordered = line.match(/^\d+\.\s+(.+)/);
    if (ordered?.[1] && tryAddAction(ordered[1])) break;
  }
  for (const line of lines) {
    if (actions.length >= maxItems) break;
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet?.[1]) tryAddAction(bullet[1]);
  }

  return actions.length > 0 ? actions : ['Review section details for prioritized actions.'];
}
