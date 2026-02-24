import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, RefreshCw, Printer } from 'lucide-react';
import { SectionNav } from './SectionNav';
import { ExecutiveSnapshot } from './ExecutiveSnapshot';
import { MarkdownSection } from './MarkdownSection';
import { AdvisoryChatbot } from './AdvisoryChatbot';
import { SECTION_CONFIG } from '../constants/config';
import {
  normalizeMarkdownContent,
} from '../utils/jsonToMarkdown';
import {
  extractMetricValue,
  formatScoreMetric,
  shouldShowFormattedBadge,
} from '../utils/metrics';
import { extractTopActions } from '../utils/markdown';
import { toNumber } from '../utils/parsing';

export function ReportResults({
  results,
  expandedSections,
  onToggleSection,
  onExpandAll,
  onCollapseAll,
  onNewAnalysis,
}) {
  const mainRef = useRef(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

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
    <main
      ref={mainRef}
      className="results-layout"
      tabIndex={-1}
      aria-label="Advisory report results"
    >
      <div className="results-toolbar">
        <div className="results-toolbar-title">
          <h2>
            <CheckCircle size={20} /> Advisory Report Ready
          </h2>
        </div>
        <div className="results-toolbar-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.print()}
            aria-label="Print report"
          >
            <Printer size={16} /> Print
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onNewAnalysis}
            aria-label="Start new analysis"
          >
            <RefreshCw size={16} /> New Analysis
          </button>
        </div>
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
        <button type="button" className="secondary-button" onClick={onExpandAll}>
          Expand All
        </button>
        <button type="button" className="secondary-button" onClick={onCollapseAll}>
          Collapse All
        </button>
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
              onToggle={onToggleSection}
              showFormattedBadge={shouldShowFormattedBadge(normalized, meta)}
              className={section.id === 'strategy' ? 'strategy-panel' : section.id === 'executive' ? 'executive-panel' : ''}
            />
          );
        })}
      </div>

      <AdvisoryChatbot advisoryResults={results} />
    </main>
  );
}

ReportResults.propTypes = {
  results: PropTypes.object.isRequired,
  expandedSections: PropTypes.object.isRequired,
  onToggleSection: PropTypes.func.isRequired,
  onExpandAll: PropTypes.func.isRequired,
  onCollapseAll: PropTypes.func.isRequired,
  onNewAnalysis: PropTypes.func.isRequired,
};
