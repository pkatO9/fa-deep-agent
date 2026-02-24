import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  CheckCircle,
  Printer,
  RefreshCw,
  Gauge,
  ShieldAlert,
  BookOpen,
  FlaskConical,
  MessageCircle,
  ListChecks,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { normalizeMarkdownContent } from '../utils/jsonToMarkdown';
import { extractTopActions } from '../utils/markdown';
import { formatScoreMetric, getMetricTone } from '../utils/metrics';
import { MarkdownSection } from './MarkdownSection';
import { AdvisoryChatbot } from './AdvisoryChatbot';
import { SECTION_CONFIG } from '../constants/config';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'actions', label: 'Actions', icon: ListChecks },
  { id: 'scenarios', label: 'Scenarios', icon: FlaskConical },
  { id: 'chat', label: 'Copilot', icon: MessageCircle },
];

function toConfidenceTag(scoreValue) {
  const score = Number(String(scoreValue ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(score)) return 'Medium';
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
}

function buildDecisionCards(results) {
  const strategy = results?.strategy_recommendation_structured || {};
  const actions = Array.isArray(strategy.immediate_actions) ? strategy.immediate_actions : [];
  const confidence = toConfidenceTag(strategy.confidence_score);

  if (actions.length === 0) {
    return [{
      title: 'Review strategy recommendations',
      impact: 'Medium',
      urgency: 'This week',
      confidence,
      rationale: 'No structured immediate actions were found. Use technical detail to verify generated strategy.',
    }];
  }

  return actions.slice(0, 5).map((item, index) => ({
    title: item,
    impact: index < 2 ? 'High' : 'Medium',
    urgency: index < 2 ? 'Now' : 'This month',
    confidence,
    rationale: 'Pulled from strategy immediate actions and ordered for first-pass execution.',
  }));
}

function buildEvidence(results) {
  const risk = normalizeMarkdownContent(results?.risk_analysis, 'risk').markdown;
  const allocation = normalizeMarkdownContent(results?.allocation_analysis, 'allocation').markdown;
  const behavior = normalizeMarkdownContent(results?.behavior_analysis, 'behavior').markdown;

  return [
    { section: 'Risk', excerpt: extractTopActions(risk, 1)[0] || 'Risk section available in technical detail.' },
    { section: 'Allocation', excerpt: extractTopActions(allocation, 1)[0] || 'Allocation section available in technical detail.' },
    { section: 'Behavior', excerpt: extractTopActions(behavior, 1)[0] || 'Behavior section available in technical detail.' },
  ];
}

function ScenarioPanel({ results }) {
  const [tilt, setTilt] = useState(10);
  const [cashBuffer, setCashBuffer] = useState(15);
  const confidence = formatScoreMetric(results?.strategy_recommendation_structured?.confidence_score);
  const projected = Math.max(0, 100 - tilt * 0.6 + cashBuffer * 0.35).toFixed(1);

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>What-if Scenario Builder</h3>
      </div>
      <p className="muted-copy">Use quick sliders for client conversations. This is directional, not an execution engine.</p>

      <div className="scenario-grid">
        <label>
          Equity tilt delta: <strong>{tilt}%</strong>
          <input type="range" min="-20" max="20" value={tilt} onChange={(e) => setTilt(Number(e.target.value))} />
        </label>
        <label>
          Cash buffer target: <strong>{cashBuffer}%</strong>
          <input type="range" min="0" max="30" value={cashBuffer} onChange={(e) => setCashBuffer(Number(e.target.value))} />
        </label>
      </div>

      <div className="scenario-result" aria-live="polite">
        <h4>Scenario stability index</h4>
        <p>{projected}/100</p>
        <span>Model confidence baseline: {confidence}</span>
      </div>
    </section>
  );
}

ScenarioPanel.propTypes = {
  results: PropTypes.object.isRequired,
};

export function AnalysisWorkspace({
  run,
  activeTab,
  roleView,
  onRoleViewChange,
  onNavigateTab,
  onNewAnalysis,
  savedActions,
  onSaveAction,
}) {
  const [showEvidence, setShowEvidence] = useState(true);
  const [showTechnical, setShowTechnical] = useState(false);

  const results = run.results;
  const decisions = useMemo(() => buildDecisionCards(results), [results]);
  const evidence = useMemo(() => buildEvidence(results), [results]);

  const normalizedById = useMemo(() => ({
    risk: normalizeMarkdownContent(results?.risk_analysis, 'risk'),
    allocation: normalizeMarkdownContent(results?.allocation_analysis, 'allocation'),
    behavior: normalizeMarkdownContent(results?.behavior_analysis, 'behavior'),
    strategy: normalizeMarkdownContent(results?.strategy_recommendation, 'strategy'),
    executive: normalizeMarkdownContent(results?.executive_summary, 'executive', { validationScore: results?.validation_score }),
  }), [results]);

  const validationScore = formatScoreMetric(results?.validation_score);
  const confidenceScore = formatScoreMetric(results?.strategy_recommendation_structured?.confidence_score || results?.executive_summary_structured?.confidence_rating);

  const actionList = useMemo(() => {
    const strategyActions = extractTopActions(normalizedById.strategy.markdown, 5);
    const merged = [...strategyActions, ...savedActions];
    return [...new Set(merged)].slice(0, 8);
  }, [normalizedById.strategy.markdown, savedActions]);

  return (
    <main className="workspace" aria-label="Analysis workspace">
      <div className="workspace-toolbar panel">
        <div>
          <p className="kicker">Run ID: {run.run_id}</p>
          <h2><CheckCircle size={20} /> Advisory Workspace</h2>
          <p className="muted-copy">Created {new Date(run.created_at).toLocaleString()}</p>
        </div>

        <div className="workspace-toolbar-actions">
          <div className="mode-switch" role="radiogroup" aria-label="Viewer mode">
            {['Advisor', 'Investor'].map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={roleView === mode}
                className={`mode-chip ${roleView === mode ? 'is-active' : ''}`}
                onClick={() => onRoleViewChange(mode)}
              >
                {mode}
              </button>
            ))}
          </div>

          <button type="button" className="secondary-button" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button type="button" className="secondary-button" onClick={onNewAnalysis}><RefreshCw size={16} /> New Analysis</button>
        </div>
      </div>

      <nav className="workspace-tabs" aria-label="Analysis tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigateTab(tab.id)}
              className={`workspace-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="workspace-body">
        <section className="workspace-main">
          {activeTab === 'overview' && (
            <>
              <section className="panel">
                <div className="panel-header panel-header-between">
                  <div className="panel-header-inline">
                    <Sparkles size={18} />
                    <h3>Top Decisions</h3>
                  </div>
                  <span className="status-pill">{roleView} View</span>
                </div>
                <div className="decision-rail">
                  {decisions.map((card) => (
                    <article key={card.title} className="decision-card">
                      <h4>{card.title}</h4>
                      <p>{card.rationale}</p>
                      <div className="decision-meta">
                        <span>Impact: {card.impact}</span>
                        <span>Urgency: {card.urgency}</span>
                        <span>Confidence: {card.confidence}</span>
                      </div>
                      <button type="button" className="secondary-button" onClick={() => onSaveAction(card.title)}>
                        Save Action <ArrowRight size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel why-panel">
                <div className="panel-header">
                  <h3>Why This Matters</h3>
                </div>
                <p>
                  {roleView === 'Advisor'
                    ? 'Use this view to drive client meetings with clear sequencing: immediate actions, rebalance horizon, and long-term checkpoints.'
                    : 'Use this view to understand what to do first, what to monitor monthly, and how decisions connect to your goals.'}
                </p>
              </section>

              <section className="panel">
                <div className="panel-header panel-header-between">
                  <div className="panel-header-inline">
                    <BookOpen size={17} />
                    <h3>Evidence Drawer</h3>
                  </div>
                  <button type="button" className="toggle-details-btn" onClick={() => setShowEvidence((v) => !v)}>
                    {showEvidence ? 'Hide Evidence' : 'View Evidence'}
                  </button>
                </div>
                {showEvidence && (
                  <div className="evidence-list">
                    {evidence.map((item) => (
                      <article key={item.section} className="evidence-item">
                        <h4>{item.section}</h4>
                        <p>{item.excerpt}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === 'actions' && (
            <section className="panel">
              <div className="panel-header">
                <h3>Prioritized Action Plan</h3>
              </div>
              <ol className="action-list">
                {actionList.map((action) => <li key={action}>{action}</li>)}
              </ol>

              {roleView === 'Advisor' ? (
                <div className="panel callout-panel">
                  <h4>Advisor Meeting Checklist</h4>
                  <ul>
                    <li>Confirm client constraints and horizon assumptions.</li>
                    <li>Walk through top 3 actions with timeline and trade-offs.</li>
                    <li>Set follow-up review cadence and KPI ownership.</li>
                  </ul>
                </div>
              ) : (
                <div className="panel callout-panel">
                  <h4>Investor Next-Step Guide</h4>
                  <ul>
                    <li>Start with the first two immediate actions this week.</li>
                    <li>Track validation and confidence monthly.</li>
                    <li>Revisit scenario tab before major allocation changes.</li>
                  </ul>
                </div>
              )}
            </section>
          )}

          {activeTab === 'scenarios' && <ScenarioPanel results={results} />}

          {activeTab === 'chat' && (
            <AdvisoryChatbot
              runId={run.run_id}
              onConvertAction={onSaveAction}
            />
          )}

          <section className="panel technical-panel">
            <div className="panel-header panel-header-between">
              <div className="panel-header-inline">
                <ShieldAlert size={16} />
                <h3>Technical Detail</h3>
              </div>
              <button type="button" className="toggle-details-btn" onClick={() => setShowTechnical((v) => !v)}>
                {showTechnical ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {showTechnical && (
              <div className="report-stack">
                {SECTION_CONFIG.map((section) => (
                  <MarkdownSection
                    key={section.id}
                    sectionId={section.id}
                    icon={section.icon}
                    title={section.title}
                    content={normalizedById[section.id].markdown}
                    metricState={section.metricState}
                    expanded
                    onToggle={() => {}}
                    hideToggle
                    showFormattedBadge={normalizedById[section.id].coerced}
                  />
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="workspace-rail" aria-label="Trust and compliance rail">
          <section className="panel rail-card">
            <h3>Confidence Signals</h3>
            <p className={`rail-score tone-${getMetricTone(validationScore, 'score')}`}>Validation: {validationScore}</p>
            <p className={`rail-score tone-${getMetricTone(confidenceScore, 'score')}`}>Model confidence: {confidenceScore}</p>
          </section>

          <section className="panel rail-card">
            <h3>Assumptions</h3>
            <ul>
              <li>Role: {run.role_profile?.role || 'Investor'}</li>
              <li>Objective: {(run.role_profile?.objective || 'general_planning').replace(/_/g, ' ')}</li>
              <li>Liquidity horizon: {run.role_profile?.liquidity_horizon || 'Not provided'}</li>
            </ul>
          </section>

          <section className="panel rail-card">
            <h3>Compliance Notes</h3>
            <p>This advisory report is informational and should be reviewed before execution.</p>
          </section>
        </aside>
      </div>

      <div className="mobile-bottom-tabs" role="tablist" aria-label="Mobile navigation tabs">
        {TABS.filter((tab) => tab.id !== 'scenarios').map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`mobile-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => onNavigateTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </main>
  );
}

AnalysisWorkspace.propTypes = {
  run: PropTypes.shape({
    run_id: PropTypes.string.isRequired,
    created_at: PropTypes.string.isRequired,
    role_profile: PropTypes.object,
    results: PropTypes.object.isRequired,
  }).isRequired,
  activeTab: PropTypes.oneOf(['overview', 'actions', 'scenarios', 'chat']).isRequired,
  roleView: PropTypes.oneOf(['Advisor', 'Investor']).isRequired,
  onRoleViewChange: PropTypes.func.isRequired,
  onNavigateTab: PropTypes.func.isRequired,
  onNewAnalysis: PropTypes.func.isRequired,
  savedActions: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSaveAction: PropTypes.func.isRequired,
};
