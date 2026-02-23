import { useState } from 'react';
import axios from 'axios';
import { Upload, PieChart, Shield, TrendingUp, User, Beaker, FileText, CheckCircle, Loader2 } from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [profile, setProfile] = useState({
    age: '35',
    income: '₹35,00,000 / year',
    risk_appetite: 'Aggressive',
    goals: 'Early retirement by 45'
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert('Please upload a portfolio file');

    setLoading(true);
    setResults(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_profile', JSON.stringify(profile));

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred during processing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem', background: 'linear-gradient(to right, #60a5fa, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Portfolio Deep Advisor
        </h1>
        <p style={{ color: '#94a3b8' }}>AI-Powered Multi-Agent Wealth Strategy</p>
      </header>

      {!results ? (
        <section className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label>Investor Profile</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <input
                  placeholder="Age"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                />
                <input
                  placeholder="Annual Income"
                  value={profile.income}
                  onChange={(e) => setProfile({ ...profile, income: e.target.value })}
                />
              </div>
              <textarea
                placeholder="Financial Goals"
                rows="2"
                style={{ marginTop: '1rem' }}
                value={profile.goals}
                onChange={(e) => setProfile({ ...profile, goals: e.target.value })}
              />
              <select
                style={{ marginTop: '1rem' }}
                value={profile.risk_appetite}
                onChange={(e) => setProfile({ ...profile, risk_appetite: e.target.value })}
              >
                <option>Conservative</option>
                <option>Moderate</option>
                <option>Aggressive</option>
              </select>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label>Portfolio Attachment (Excel)</label>
              <div style={{ border: '2px dashed #334155', borderRadius: '0.5rem', padding: '2rem', textAlign: 'center', marginTop: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="file"
                  id="file-upload"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls"
                />
                <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Upload size={32} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
                  <span>{file ? file.name : 'Click to upload Sydney_Barboza_Live_Portfolio...'}</span>
                </label>
              </div>
            </div>

            <button type="submit" className="primary-button" style={{ width: '100%' }} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Loader2 className="animate-spin" /> Analyzing Portfolio...
                </span>
              ) : 'Generate Advisory Strategy'}
            </button>
            {error && <p style={{ color: '#ef4444', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</p>}
          </form>
        </section>
      ) : (
        <main className="results-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle color="#34d399" /> Advisory Report Ready
            </h2>
            <button className="primary-button" onClick={() => setResults(null)}>Reset</button>
          </div>

          <div className="grid">
            <div className="glass-card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa' }}>
                <Shield size={20} /> Risk Assessment
              </h3>
              <p style={{ fontSize: '0.9rem' }}>{results.risk_analysis || "Analysis complete."}</p>
            </div>

            <div className="glass-card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa' }}>
                <PieChart size={20} /> Allocation Strategy
              </h3>
              <p style={{ fontSize: '0.9rem' }}>{results.allocation_analysis || "Analysis complete."}</p>
            </div>

            <div className="glass-card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f472b6' }}>
                <User size={20} /> Behavioral Analysis
              </h3>
              <p style={{ fontSize: '0.9rem' }}>{results.behavior_analysis || "Analysis complete."}</p>
            </div>
          </div>

          <div className="glass-card" style={{ marginTop: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6' }}>
              <TrendingUp size={20} /> Chief Strategy Recommendation
            </h3>
            <p style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>{results.strategy_recommendation}</p>
          </div>

          <div className="glass-card" style={{ marginTop: '1.5rem', backgroundColor: '#064e3b33' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', margin: 0 }}>
                <CheckCircle size={20} /> Executive Summary
              </h3>
              <span className="status-pill status-done">Validation Score: {results.validation_score}/100</span>
            </header>
            <div style={{ padding: '1rem', background: '#02061766', borderRadius: '0.5rem', border: '1px solid #064e3b' }}>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>{results.executive_summary}</p>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
