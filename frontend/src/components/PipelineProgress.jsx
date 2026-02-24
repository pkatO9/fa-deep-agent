import PropTypes from 'prop-types';
import { Loader2, CheckCircle, Circle } from 'lucide-react';

export function PipelineProgress({ progressSteps, error }) {
  return (
    <section className="panel form-panel pipeline-progress-panel">
      <div className="panel-header">
        <span className="panel-icon-wrap" aria-hidden="true">
          <Loader2 size={18} className="spin" />
        </span>
        <h2>Pipeline progress</h2>
      </div>
      <div className="pipeline-progress" role="status" aria-live="polite">
        {progressSteps.length === 0 ? (
          <p className="pipeline-progress-title">Starting analysis...</p>
        ) : (
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
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}

PipelineProgress.propTypes = {
  progressSteps: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      label: PropTypes.string,
      status: PropTypes.oneOf(['done', 'active', 'pending']),
    })
  ).isRequired,
  error: PropTypes.string,
};

PipelineProgress.defaultProps = {
  error: null,
};
