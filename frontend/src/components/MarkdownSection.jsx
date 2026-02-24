import { useMemo } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { extractSummaryAndDetails } from '../utils/markdown';

export function MarkdownSection({
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
