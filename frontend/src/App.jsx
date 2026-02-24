import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Upload,
  PieChart,
  Shield,
  TrendingUp,
  User,
  CheckCircle,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Compass,
  Sparkles,
  Circle,
} from 'lucide-react';
import { AdvisoryChatbot } from './components/AdvisoryChatbot';
import './App.css';

const API_BASE =  'http://localhost:8000';

const SECTION_CONFIG = [
  { id: 'risk', title: 'Risk Assessment', icon: Shield, resultKey: 'risk_analysis', metaKey: 'risk_analysis_meta', metricState: 'warn' },
  { id: 'allocation', title: 'Allocation Strategy', icon: PieChart, resultKey: 'allocation_analysis', metaKey: 'allocation_analysis_meta', metricState: 'positive' },
  { id: 'behavior', title: 'Behavioral Analysis', icon: User, resultKey: 'behavior_analysis', metaKey: 'behavior_analysis_meta', metricState: 'neutral' },
  { id: 'strategy', title: 'Chief Strategy Recommendation', icon: TrendingUp, resultKey: 'strategy_recommendation', metaKey: 'strategy_recommendation_meta', metricState: 'positive' },
  { id: 'executive', title: 'Executive Summary', icon: CheckCircle, resultKey: 'executive_summary', metaKey: 'executive_summary_meta', metricState: 'positive' },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function tryParseJson(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw !== 'string') {
    return null;
  }

  const text = raw.trim();
  if (!text) {
    return null;
  }

  const tryParse = (candidate) => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) {
    return direct;
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const fenced = tryParse(fencedMatch[1].trim());
    if (fenced) {
      return fenced;
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParse(text.slice(firstBrace, lastBrace + 1));
  }

  return null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLabel(label) {
  if (typeof label !== 'string') {
    return '';
  }

  return label
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdownInline(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/^\s*[-*]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .trim();
}

function getFirstNumber(value) {
  if (value == null) {
    return null;
  }

  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  return toNumber(match[0]);
}

function formatScoreMetric(value) {
  const numeric = getFirstNumber(value);
  if (numeric == null) {
    return 'Not provided';
  }
  return `${numeric}/100`;
}

function looksLikeMarkdown(text) {
  if (typeof text !== 'string') {
    return false;
  }
  return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(^\|.+\|\s*$)/m.test(text);
}

function createFallbackMarkdown(rawText, sectionName) {
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

function allocationTable(currentAllocation, targetAllocation) {
  const current = currentAllocation && typeof currentAllocation === 'object' ? currentAllocation : {};
  const target = targetAllocation && typeof targetAllocation === 'object' ? targetAllocation : {};
  const categories = Array.from(new Set([...Object.keys(current), ...Object.keys(target)])).sort();

  if (categories.length === 0) {
    return 'No allocation data available.';
  }

  const lines = ['| Category | Current | Target |', '|---|---:|---:|'];
  categories.forEach((category) => {
    lines.push(`| ${category} | ${current[category] ?? '-'} | ${target[category] ?? '-'} |`);
  });

  return lines.join('\n');
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
    keyFindings.length ? keyFindings.map((item) => `- ${item}`).join('\n') : '- Not available',
    '### Age & Goal Alignment',
    data.age_alignment || data.diversification_risk_analysis || 'Profile alignment data unavailable.',
    '### Immediate Actions',
    actions.length ? actions.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No immediate actions provided.',
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
    issues.length ? issues.map((item) => `- ${item}`).join('\n') : '- Not available',
    '### Recommended Shifts',
    shifts.length ? shifts.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No shift guidance provided.',
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
    issues.length ? issues.map((item) => `- ${item}`).join('\n') : '- No discipline issues detected.',
    '### Action Plan (0-30 Days)',
    nearTerm.length ? nearTerm.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No near-term actions provided.',
    '### Action Plan (3-12 Months)',
    mediumTerm.length ? mediumTerm.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No medium-term actions provided.',
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
    immediate.length ? immediate.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No immediate actions provided.',
    '### Rebalance Plan (3-12 Months)',
    rebalance.length ? rebalance.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No rebalance steps provided.',
    '### Long-Term Plan (1-5 Years)',
    longTerm.length ? longTerm.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No long-term plan provided.',
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
    nextSteps.length ? nextSteps.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No next steps provided.',
    '### Key Metrics To Track',
    metrics.length ? metrics.map((item) => `- ${item}`).join('\n') : '- No key metrics provided.',
    '### Confidence',
    `- **Confidence Rating:** ${confidenceDisplay}`,
  ].join('\n\n');
}

function normalizeMarkdownContent(value, sectionName, context = {}) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = tryParseJson(value);
    if (isPlainObject(parsed) && Object.keys(parsed).length > 0) {
      return {
        markdown: convertJsonToMarkdown(parsed, sectionName, context),
        coerced: true,
      };
    }

    if (looksLikeMarkdown(value)) {
      return { markdown: value, coerced: false };
    }

    return { markdown: createFallbackMarkdown(value, sectionName), coerced: true };
  }

  if (value && typeof value === 'object') {
    return {
      markdown: convertJsonToMarkdown(value, sectionName, context),
      coerced: true,
    };
  }

  return {
    markdown: createFallbackMarkdown('', sectionName),
    coerced: true,
  };
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

function extractObjectMetric(data, aliases = [], jsonKeys = []) {
  if (!isPlainObject(data)) {
    return null;
  }

  const keySet = new Set([
    ...aliases.map(normalizeLabel),
    ...jsonKeys.map(normalizeLabel),
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (value == null || value === '') {
      continue;
    }
    if (keySet.has(normalizeLabel(key))) {
      return stripMarkdownInline(String(value));
    }
  }

  return null;
}

function extractMetricValue(markdown, aliases = [], jsonKeys = []) {
  if (typeof markdown !== 'string' || aliases.length === 0) {
    return null;
  }

  const aliasSet = new Set(aliases.map(normalizeLabel));

  const boldRegex = /\*\*\s*([^*:\n]+?)\s*\*\*\s*:\s*([^\n]+)/g;
  for (const match of markdown.matchAll(boldRegex)) {
    const label = normalizeLabel(match[1]);
    if (aliasSet.has(label)) {
      return stripMarkdownInline(match[2]);
    }
  }

  const lines = markdown.split('\n');
  for (const line of lines) {
    const cleanLine = stripMarkdownInline(line);
    if (!cleanLine || /^#{1,6}\s/.test(line.trim()) || cleanLine.startsWith('|')) {
      continue;
    }

    const pairMatch = cleanLine.match(/^([^:]{2,80}):\s*(.+)$/);
    if (!pairMatch) {
      continue;
    }

    const label = normalizeLabel(pairMatch[1]);
    if (aliasSet.has(label)) {
      return stripMarkdownInline(pairMatch[2]);
    }
  }

  const parsed = tryParseJson(markdown);
  return extractObjectMetric(parsed, aliases, jsonKeys);
}

function shouldShowFormattedBadge(normalized, meta) {
  if (normalized.coerced) {
    return true;
  }
  return meta?.source === 'coerced' || meta?.source === 'fallback';
}

function isStructuralBlock(block) {
  const trimmed = block.trim();
  if (!trimmed) {
    return true;
  }
  if (/^#{1,6}\s/.test(trimmed) || trimmed.startsWith('|')) {
    return true;
  }

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return true;
  }

  const allListLines = lines.every((line) => /^[-*]\s+|^\d+\.\s+/.test(line));
  if (allListLines) {
    return true;
  }

  const allShortLabels = lines.every((line) => {
    const cleaned = stripMarkdownInline(line);
    if (!cleaned.endsWith(':')) {
      return false;
    }
    return cleaned.split(/\s+/).length <= 6;
  });

  return allShortLabels;
}

function extractSummaryAndDetails(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return { summary: 'No summary available.', details: '' };
  }

  const blocks = markdown
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  let summary = '';
  let summaryIndex = -1;

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (isStructuralBlock(block)) {
      continue;
    }

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
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+|^\d+\.\s+/.test(line))
      .map(stripMarkdownInline)
      .filter((line) => line && line.length > 24 && !/^(summary|confidence|validation)\b/i.test(line));

    if (listCandidates.length > 0) {
      summary = listCandidates.slice(0, 2).join(' ');
    } else {
      summary = 'No summary available.';
    }
  }

  const details = blocks
    .filter((_, idx) => idx !== summaryIndex)
    .join('\n\n');

  return { summary, details };
}

function extractTopActions(markdown, maxItems = 3) {
  if (typeof markdown !== 'string') {
    return ['Review section details for prioritized actions.'];
  }

  const actions = [];
  const seen = new Set();
  const lines = markdown.split('\n').map((line) => line.trim()).filter(Boolean);

  const tryAddAction = (candidate) => {
    const cleaned = stripMarkdownInline(candidate);
    if (!cleaned) {
      return false;
    }

    if (/^(summary|confidence|validation|deep dive)\b/i.test(cleaned)) {
      return false;
    }

    const key = normalizeLabel(cleaned);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    actions.push(cleaned);
    return actions.length >= maxItems;
  };

  for (const line of lines) {
    const ordered = line.match(/^\d+\.\s+(.+)/);
    if (ordered?.[1]) {
      if (tryAddAction(ordered[1])) {
        break;
      }
    }
  }

  for (const line of lines) {
    if (actions.length >= maxItems) {
      break;
    }
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet?.[1]) {
      tryAddAction(bullet[1]);
    }
  }

  if (actions.length === 0) {
    return ['Review section details for prioritized actions.'];
  }

  return actions;
}

function getMetricTone(value, type = 'generic') {
  if (!value) {
    return 'neutral';
  }

  if (type === 'score') {
    const parsed = getFirstNumber(value);
    if (parsed == null) {
      return 'neutral';
    }
    if (parsed >= 80) {
      return 'positive';
    }
    if (parsed >= 60) {
      return 'warn';
    }
    return 'danger';
  }

  const normalized = String(value).toLowerCase();
  if (normalized.includes('low')) {
    return 'positive';
  }
  if (normalized.includes('moderate')) {
    return 'warn';
  }
  if (normalized.includes('high')) {
    return 'danger';
  }
  return 'neutral';
}

function SectionNav() {
  return (
    <nav className="section-nav" aria-label="Report sections">
      <a href="#snapshot" className="section-nav-link"><Compass size={14} /> Snapshot</a>
      <a href="#risk" className="section-nav-link">Risk</a>
      <a href="#allocation" className="section-nav-link">Allocation</a>
      <a href="#behavior" className="section-nav-link">Behavior</a>
      <a href="#strategy" className="section-nav-link">Strategy</a>
      <a href="#executive" className="section-nav-link">Executive</a>
    </nav>
  );
}

function ExecutiveSnapshot({ validationScore, riskLevel, severityScore, confidenceScore, topActions }) {
  return (
    <section id="snapshot" className="snapshot-band panel" aria-label="Executive snapshot">
      <header className="snapshot-header">
        <div className="snapshot-title-group">
          <Sparkles size={18} />
          <h3>Executive Snapshot</h3>
        </div>
        <p>Understand the portfolio signal and top actions at a glance.</p>
      </header>

      <div className="snapshot-kpis">
        <div className="kpi-card">
          <span className="kpi-label">Validation</span>
          <span className={`kpi-value tone-${getMetricTone(validationScore, 'score')}`}>{validationScore}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Risk Level</span>
          <span className={`kpi-value tone-${getMetricTone(riskLevel)}`}>{riskLevel || 'Not provided'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Severity</span>
          <span className={`kpi-value tone-${getMetricTone(severityScore, 'score')}`}>{severityScore || 'Not provided'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Confidence</span>
          <span className={`kpi-value tone-${getMetricTone(confidenceScore, 'score')}`}>{confidenceScore || 'Not provided'}</span>
        </div>
      </div>

      <div className="snapshot-actions">
        <h4><ListChecks size={16} /> Priority Actions</h4>
        <ol>
          {topActions.length > 0 ? (
            topActions.map((action) => <li key={action}>{action}</li>)
          ) : (
            <li>No actions detected. Review strategy details.</li>
          )}
        </ol>
      </div>
    </section>
  );
}

ExecutiveSnapshot.propTypes = {
  validationScore: PropTypes.string,
  riskLevel: PropTypes.string,
  severityScore: PropTypes.string,
  confidenceScore: PropTypes.string,
  topActions: PropTypes.arrayOf(PropTypes.string).isRequired,
};

ExecutiveSnapshot.defaultProps = {
  validationScore: null,
  riskLevel: null,
  severityScore: null,
  confidenceScore: null,
};

function MarkdownSection({
  sectionId,
  icon: Icon,
  title,
  content,
  className = '',
  showFormattedBadge = false,
  metricState = 'neutral',
  expanded = false,
  onToggle,
}) {
  const { summary, details } = useMemo(() => extractSummaryAndDetails(content), [content]);
  const isOpen = expanded;

  return (
    <section id={sectionId} className={`panel metric-${metricState} report-section ${className}`.trim()}>
      <header className="panel-header panel-header-between">
        <div className="panel-header-inline">
          <span className="panel-icon-wrap" aria-hidden="true">
            <Icon size={18} />
          </span>
          <h3>{title}</h3>
        </div>
        <div className="header-pill-group">
          {showFormattedBadge && <span className="format-badge">Formatted from structured response</span>}
          <button
            type="button"
            className="toggle-details-btn"
            onClick={() => onToggle(sectionId)}
            aria-expanded={isOpen}
            aria-controls={`${sectionId}-deep-dive`}
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isOpen ? 'Hide Details' : 'View Details'}
          </button>
        </div>
      </header>

      <div className="section-summary" aria-label={`${title} summary`}>
        <h4>Summary</h4>
        <p>{summary}</p>
      </div>

      {isOpen && details && (
        <div id={`${sectionId}-deep-dive`} className="section-details" aria-label={`${title} detailed analysis`}>
          <h4>Deep Dive</h4>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{details}</ReactMarkdown>
          </div>
        </div>
      )}
    </section>
  );
}

MarkdownSection.propTypes = {
  sectionId: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  content: PropTypes.string,
  className: PropTypes.string,
  showFormattedBadge: PropTypes.bool,
  metricState: PropTypes.oneOf(['neutral', 'positive', 'warn']),
  expanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
};

MarkdownSection.defaultProps = {
  content: '',
  className: '',
  showFormattedBadge: false,
  metricState: 'neutral',
  expanded: false,
};

function App() {
  const [file, setFile] = useState(null);
  const [profile, setProfile] = useState({
    age: '35',
    income: '₹35,00,000 / year',
    risk_appetite: 'Aggressive',
    goals: 'Early retirement by 45',
  });
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    risk: false,
    allocation: false,
    behavior: false,
    strategy: true,
    executive: false,
  });

  const handleFileUpload = (e) => {
    setFile(e.target.files[0]);
  };

  const handleToggleSection = (sectionId) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const expandAllSections = () => {
    setExpandedSections({
      risk: true,
      allocation: true,
      behavior: true,
      strategy: true,
      executive: true,
    });
  };

  const collapseAllSections = () => {
    setExpandedSections({
      risk: false,
      allocation: false,
      behavior: false,
      strategy: true,
      executive: false,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please upload a portfolio file');
      return;
    }

    setLoading(true);
    setResults(null);
    setError(null);
    setProgressSteps([]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_profile', JSON.stringify(profile));

    try {
      const response = await fetch(`${API_BASE}/upload/stream`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        let detail = `HTTP ${response.status}`;
        try {
          const errBody = JSON.parse(text);
          detail = errBody.detail || detail;
        } catch {
          if (text) detail = text.slice(0, 200);
        }
        throw new Error(detail);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const chunk of lines) {
          const match = chunk.match(/^data:\s*(.+)$/m);
          if (!match) continue;
          try {
            const event = JSON.parse(match[1]);
            if (event.event === 'phase') {
              setProgressSteps((prev) => {
                const markedDone = prev.map((s) => (s.status === 'active' ? { ...s, status: 'done' } : s));
                const without = markedDone.filter((s) => s.id !== event.phase);
                return [...without, { id: event.phase, label: event.message, status: 'active' }];
              });
            } else if (event.event === 'node') {
              setProgressSteps((prev) => {
                const without = prev.filter((s) => s.id !== event.node);
                const completed = without.map((s) => (s.status === 'active' ? { ...s, status: 'done' } : s));
                return [...completed, { id: event.node, label: event.message, status: 'done' }];
              });
            } else if (event.event === 'complete') {
              setProgressSteps((prev) =>
                prev.map((s) => ({ ...s, status: 'done' }))
              );
              setResults(event.results);
              setExpandedSections({
                risk: false,
                allocation: false,
                behavior: false,
                strategy: true,
                executive: false,
              });
            }
          } catch {
            // ignore parse errors for partial chunks
          }
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred during processing.');
    } finally {
      setLoading(false);
      setProgressSteps([]);
    }
  };

  const normalizedRisk = normalizeMarkdownContent(results?.risk_analysis, 'risk');
  const normalizedAllocation = normalizeMarkdownContent(results?.allocation_analysis, 'allocation');
  const normalizedBehavior = normalizeMarkdownContent(results?.behavior_analysis, 'behavior');
  const normalizedStrategy = normalizeMarkdownContent(results?.strategy_recommendation, 'strategy');
  const normalizedExecutive = normalizeMarkdownContent(results?.executive_summary, 'executive', {
    validationScore: toNumber(results?.validation_score),
  });

  const normalizedById = {
    risk: normalizedRisk,
    allocation: normalizedAllocation,
    behavior: normalizedBehavior,
    strategy: normalizedStrategy,
    executive: normalizedExecutive,
  };

  const riskLevel = extractMetricValue(normalizedRisk.markdown, ['risk level', 'risk'], ['risk_level']) || 'Not provided';
  const severityScore = extractMetricValue(normalizedRisk.markdown, ['severity score', 'severity'], ['severity_score']);
  const confidenceScore =
    extractMetricValue(normalizedStrategy.markdown, ['confidence score', 'confidence rating', 'confidence'], ['confidence_score', 'confidence_rating']) ||
    extractMetricValue(normalizedExecutive.markdown, ['confidence score', 'confidence rating', 'confidence'], ['confidence_score', 'confidence_rating']) ||
    extractMetricValue(normalizedBehavior.markdown, ['confidence score', 'confidence'], ['confidence_score']) ||
    extractMetricValue(normalizedAllocation.markdown, ['confidence score', 'confidence'], ['confidence_score']);
  const topActions = extractTopActions(normalizedStrategy.markdown, 3);
  const validationDisplay = formatScoreMetric(results?.validation_score);
  const severityDisplay = formatScoreMetric(severityScore);
  const confidenceDisplay = formatScoreMetric(confidenceScore);

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="kicker">Private Wealth Office</p>
        <h1>Portfolio Deep Advisor</h1>
        <p className="subtitle">Precision multi-agent advisory, presented in client-ready markdown reports.</p>
      </header>

      {!results ? (
        <section className="panel form-panel">
          <div className="panel-header">
            <span className="panel-icon-wrap" aria-hidden="true">
              <Briefcase size={18} />
            </span>
            <h2>Investor Intake</h2>
          </div>

          <form onSubmit={handleSubmit} className="form-layout">
            <div className="field-group two-col">
              <div className="field">
                <label htmlFor="age">Age</label>
                <input
                  id="age"
                  placeholder="Age"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="income">Annual Income</label>
                <input
                  id="income"
                  placeholder="Annual Income"
                  value={profile.income}
                  onChange={(e) => setProfile({ ...profile, income: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="goals">Financial Goals</label>
              <textarea
                id="goals"
                placeholder="Financial Goals"
                rows="3"
                value={profile.goals}
                onChange={(e) => setProfile({ ...profile, goals: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="risk_appetite">Risk Appetite</label>
              <select
                id="risk_appetite"
                value={profile.risk_appetite}
                onChange={(e) => setProfile({ ...profile, risk_appetite: e.target.value })}
              >
                <option>Conservative</option>
                <option>Moderate</option>
                <option>Aggressive</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="file-upload">Portfolio Attachment (Excel)</label>
              <input
                type="file"
                id="file-upload"
                className="file-input-hidden"
                onChange={handleFileUpload}
                accept=".xlsx,.xls"
              />
              <label className="upload-dropzone" htmlFor="file-upload">
                <span className="upload-icon-wrap" aria-hidden="true">
                  <FileSpreadsheet size={22} />
                </span>
                <span className="upload-title">{file ? file.name : 'Upload portfolio workbook'}</span>
                <span className="upload-subtitle">Supported: .xlsx, .xls</span>
              </label>
            </div>

            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? (
                <span className="button-content">
                  <Loader2 size={18} className="spin" />
                  Analyzing Portfolio
                </span>
              ) : (
                <span className="button-content">
                  <Upload size={18} />
                  Generate Advisory Strategy
                </span>
              )}
            </button>

            {loading && progressSteps.length > 0 && (
              <div className="pipeline-progress" role="status" aria-live="polite">
                <p className="pipeline-progress-title">Pipeline progress</p>
                <ul className="pipeline-progress-list">
                  {progressSteps.map((step) => (
                    <li key={step.id} className={`pipeline-progress-step pipeline-progress-step--${step.status}`}>
                      {step.status === 'done' ? (
                        <CheckCircle size={16} className="pipeline-progress-icon" aria-hidden />
                      ) : step.status === 'active' ? (
                        <Loader2 size={16} className="pipeline-progress-icon spin" aria-hidden />
                      ) : (
                        <Circle size={16} className="pipeline-progress-icon" aria-hidden />
                      )}
                      <span>{step.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="error-text">{error}</p>}
          </form>
        </section>
      ) : (
        <main className="results-layout">
          <div className="results-toolbar">
            <div className="results-toolbar-title">
              <h2>
                <CheckCircle size={20} /> Advisory Report Ready
              </h2>
            </div>
            <button className="secondary-button" onClick={() => setResults(null)}>
              <RefreshCw size={16} /> New Analysis
            </button>
          </div>

          <SectionNav />

          <ExecutiveSnapshot
            validationScore={validationDisplay}
            riskLevel={riskLevel}
            severityScore={severityDisplay}
            confidenceScore={confidenceDisplay}
            topActions={topActions}
          />

          <div className="section-controls" aria-label="Section detail controls">
            <button type="button" className="secondary-button" onClick={expandAllSections}>Expand All</button>
            <button type="button" className="secondary-button" onClick={collapseAllSections}>Collapse All</button>
          </div>

          <div className="report-stack">
            {SECTION_CONFIG.map((section) => {
              const normalized = normalizedById[section.id];
              const meta = results?.[section.metaKey];
              return (
                <MarkdownSection
                  key={section.id}
                  sectionId={section.id}
                  icon={section.icon}
                  title={section.title}
                  content={normalized.markdown}
                  metricState={section.metricState}
                  expanded={expandedSections[section.id]}
                  onToggle={handleToggleSection}
                  showFormattedBadge={shouldShowFormattedBadge(normalized, meta)}
                  className={section.id === 'strategy' ? 'strategy-panel' : section.id === 'executive' ? 'executive-panel' : ''}
                />
              );
            })}
          </div>

          <AdvisoryChatbot advisoryResults={results} />
        </main>
      )}
    </div>
  );
}

export default App;
