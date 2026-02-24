import { useState } from 'react';
import { API_BASE } from './constants/config';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InvestorIntakeForm } from './components/InvestorIntakeForm';
import { PipelineProgress } from './components/PipelineProgress';
import { ReportResults } from './components/ReportResults';
import './App.css';

const DEFAULT_PROFILE = {
  age: '35',
  income: '₹35,00,000 / year',
  risk_appetite: 'Aggressive',
  goals: 'Early retirement by 45',
};

const DEFAULT_EXPANDED = {
  risk: false,
  allocation: false,
  behavior: false,
  strategy: true,
  executive: false,
};

function App() {
  const [file, setFile] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(DEFAULT_EXPANDED);

  const handleFileUpload = (e) => {
    setFile(e.target.files[0]);
    setError(null);
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
      setError('Please upload a portfolio file');
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
              setProgressSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
              setResults(event.results);
              setExpandedSections(DEFAULT_EXPANDED);
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

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <header className="hero">
        <p className="kicker">Private Wealth Office</p>
        <h1>Portfolio Deep Advisor</h1>
        <p className="subtitle">Precision multi-agent advisory, presented in client-ready markdown reports.</p>
      </header>

      {loading ? (
        <PipelineProgress progressSteps={progressSteps} error={error} />
      ) : !results ? (
        <InvestorIntakeForm
          profile={profile}
          setProfile={setProfile}
          file={file}
          onFileUpload={handleFileUpload}
          onSubmit={handleSubmit}
          error={error}
        />
      ) : (
        <ReportResults
          results={results}
          expandedSections={expandedSections}
          onToggleSection={handleToggleSection}
          onExpandAll={expandAllSections}
          onCollapseAll={collapseAllSections}
          onNewAnalysis={() => setResults(null)}
        />
      )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
