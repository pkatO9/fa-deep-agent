import PropTypes from 'prop-types';
import { Sparkles, ListChecks } from 'lucide-react';
import { getMetricTone } from '../utils/metrics';

export function ExecutiveSnapshot({
  validationScore,
  riskLevel,
  severityScore,
  confidenceScore,
  topActions,
}) {
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
