import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from './constants/config';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PipelineProgress } from './components/PipelineProgress';
import { OnboardingWizard } from './components/OnboardingWizard';
import { AnalysisWorkspace } from './components/AnalysisWorkspace';
import './App.css';

const DEFAULT_PROFILE = {
  role: 'Advisor',
  objective: 'retirement_growth',
  age: '35',
  income: '₹35,00,000 / year',
  risk_appetite: 'Aggressive',
  goals: 'Early retirement by 45',
  liquidity_horizon: '3-5 years',
  tax_context: 'No special constraints',
  risk_tolerance_confirmed: false,
};

function parseRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return { page: 'onboarding' };
  const match = clean.match(/^\/analysis\/([^/]+)(?:\/(overview|actions|scenarios|chat))?$/);
  if (!match) return { page: 'onboarding' };
  return { page: 'analysis', runId: match[1], tab: match[2] || 'overview' };
}

function pushRoute(nextPath) {
  window.history.pushState({}, '', nextPath);
}

function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [file, setFile] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [analysisRun, setAnalysisRun] = useState(null);
  const [roleView, setRoleView] = useState('Advisor');
  const [savedActions, setSavedActions] = useState([]);
  const [error, setError] = useState(null);

  const activeTab = route.page === 'analysis' ? route.tab : 'overview';

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((nextPath) => {
    pushRoute(nextPath);
    setRoute(parseRoute(nextPath));
  }, []);

  const startNewAnalysis = useCallback(() => {
    setAnalysisRun(null);
    setSavedActions([]);
    setError(null);
    setProgressSteps([]);
    navigate('/');
  }, [navigate]);

  const loadRun = useCallback(async (runId) => {
    if (!runId) return;
    if (analysisRun?.run_id === runId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/analysis/${runId}`);
      if (!response.ok) {
        throw new Error(`Unable to load analysis (${response.status})`);
      }
      const payload = await response.json();
      setAnalysisRun(payload);
      const role = payload?.role_profile?.role === 'Investor' ? 'Investor' : 'Advisor';
      setRoleView(role);
    } catch (err) {
      setError(err.message || 'Failed to load analysis.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [analysisRun?.run_id, navigate]);

  useEffect(() => {
    if (route.page === 'analysis' && route.runId) {
      loadRun(route.runId);
    }
  }, [route, loadRun]);

  const handleFileUpload = useCallback((uploadedFile) => {
    setFile(uploadedFile);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) {
      setError('Please upload a portfolio workbook.');
      return;
    }

    setLoading(true);
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

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
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
            const payload = {
              run_id: event.run_id,
              created_at: event.created_at,
              role_profile: event.role_profile,
              results: event.results,
            };
            setProgressSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
            setAnalysisRun(payload);
            setRoleView(payload?.role_profile?.role === 'Investor' ? 'Investor' : 'Advisor');
            navigate(`/analysis/${payload.run_id}/overview`);
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Analysis failed.');
    } finally {
      setLoading(false);
      setProgressSteps([]);
    }
  }, [file, navigate, profile]);

  const addSavedAction = useCallback((actionText) => {
    if (!actionText) return;
    setSavedActions((prev) => {
      if (prev.includes(actionText)) return prev;
      return [...prev, actionText];
    });
  }, []);

  const shellClass = useMemo(
    () => `app-shell ${route.page === 'analysis' ? 'analysis-shell' : 'onboarding-shell'}`,
    [route.page]
  );

  return (
    <ErrorBoundary>
      <div className={shellClass}>
        <header className="hero">
          <p className="kicker">Private Wealth Office</p>
          <h1>Portfolio Deep Advisor</h1>
          <p className="subtitle">Role-aware advisory intelligence for advisors and investors.</p>
        </header>

        {loading ? (
          <PipelineProgress progressSteps={progressSteps} error={error} />
        ) : route.page === 'onboarding' ? (
          <OnboardingWizard
            profile={profile}
            setProfile={setProfile}
            file={file}
            onFileUpload={handleFileUpload}
            onSubmit={handleSubmit}
            error={error}
          />
        ) : analysisRun ? (
          <AnalysisWorkspace
            run={analysisRun}
            activeTab={activeTab}
            roleView={roleView}
            onRoleViewChange={setRoleView}
            onNavigateTab={(tab) => navigate(`/analysis/${analysisRun.run_id}/${tab}`)}
            onNewAnalysis={startNewAnalysis}
            savedActions={savedActions}
            onSaveAction={addSavedAction}
          />
        ) : (
          <section className="panel form-panel">
            <p className="error-text" role="alert">{error || 'Analysis not found.'}</p>
            <button type="button" className="primary-button" onClick={startNewAnalysis}>Start New Analysis</button>
          </section>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
