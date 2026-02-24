import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowRight, Briefcase, UserRound, Upload, ShieldCheck } from 'lucide-react';
import { OBJECTIVE_OPTIONS, ROLE_OPTIONS } from '../constants/types';

function readinessScore(profile, file) {
  const checks = [
    profile.role,
    profile.objective,
    profile.age?.trim(),
    profile.income?.trim(),
    profile.goals?.trim(),
    profile.liquidity_horizon?.trim(),
    profile.tax_context?.trim(),
    profile.risk_tolerance_confirmed,
    file,
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

function validateStep(step, profile, file) {
  const errors = {};
  if (step === 1) {
    if (!profile.role) errors.role = 'Select a role.';
    if (!profile.objective) errors.objective = 'Select a planning objective.';
  }
  if (step === 2) {
    const age = Number(profile.age);
    if (!Number.isFinite(age) || age < 18 || age > 100) {
      errors.age = 'Age must be between 18 and 100.';
    }
    if (!profile.income?.trim()) errors.income = 'Annual income is required.';
    if (!profile.goals?.trim()) errors.goals = 'Financial goals are required.';
    if (!file) errors.file = 'Upload a portfolio workbook (.xlsx or .xls).';
  }
  if (step === 3) {
    if (!profile.liquidity_horizon?.trim()) errors.liquidity_horizon = 'Liquidity horizon is required.';
    if (!profile.tax_context?.trim()) errors.tax_context = 'Tax context is required.';
    if (!profile.risk_tolerance_confirmed) errors.risk_tolerance_confirmed = 'Please confirm risk tolerance.';
  }
  return errors;
}

export function OnboardingWizard({
  profile,
  setProfile,
  file,
  onFileUpload,
  onSubmit,
  error,
}) {
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState({});

  const stepErrors = validateStep(step, profile, file);
  const canProceed = Object.keys(stepErrors).length === 0;
  const score = useMemo(() => readinessScore(profile, file), [profile, file]);

  const nextStep = () => {
    setTouched({});
    if (!canProceed) {
      setTouched({ show: true });
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const prevStep = () => {
    setTouched({});
    setStep((s) => Math.max(1, s - 1));
  };

  return (
    <section className="panel form-panel wizard-panel" aria-label="Onboarding wizard">
      <div className="panel-header wizard-header">
        <h2>Analysis Setup</h2>
        <p className="wizard-subtitle">Three-step onboarding with role-aware context and quality checks.</p>
      </div>

      <div className="wizard-steps" aria-label="Wizard steps">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`wizard-step ${n === step ? 'is-active' : n < step ? 'is-complete' : ''}`}>
            <span>{n}</span>
            <p>{n === 1 ? 'Role' : n === 2 ? 'Portfolio' : 'Constraints'}</p>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="wizard-body">
          <div className="role-switch" role="radiogroup" aria-label="User role">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`role-card ${profile.role === option.value ? 'is-selected' : ''}`}
                role="radio"
                aria-checked={profile.role === option.value}
                onClick={() => setProfile({ ...profile, role: option.value })}
              >
                {option.value === 'Advisor' ? <Briefcase size={18} /> : <UserRound size={18} />}
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="objective">Primary objective</label>
            <select
              id="objective"
              value={profile.objective}
              onChange={(e) => setProfile({ ...profile, objective: e.target.value })}
            >
              {OBJECTIVE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {touched.show && Object.values(stepErrors).map((msg) => (
            <p key={msg} className="field-error" role="alert">{msg}</p>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="wizard-body">
          <div className="field-group two-col">
            <div className="field">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                type="number"
                min="18"
                max="100"
                value={profile.age}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              />
              {touched.show && stepErrors.age && <p className="field-error">{stepErrors.age}</p>}
            </div>
            <div className="field">
              <label htmlFor="income">Annual income</label>
              <input
                id="income"
                value={profile.income}
                placeholder="Example: ₹35,00,000 / year"
                onChange={(e) => setProfile({ ...profile, income: e.target.value })}
              />
              {touched.show && stepErrors.income && <p className="field-error">{stepErrors.income}</p>}
            </div>
          </div>

          <div className="field">
            <label htmlFor="risk_appetite">Risk appetite</label>
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
            <label htmlFor="goals">Financial goals</label>
            <textarea
              id="goals"
              rows="3"
              value={profile.goals}
              onChange={(e) => setProfile({ ...profile, goals: e.target.value })}
            />
            {touched.show && stepErrors.goals && <p className="field-error">{stepErrors.goals}</p>}
          </div>

          <div className="field">
            <label htmlFor="file-upload">Portfolio attachment (Excel)</label>
            <input
              type="file"
              id="file-upload"
              className="file-input-hidden"
              onChange={(e) => onFileUpload(e.target.files?.[0] ?? null)}
              accept=".xlsx,.xls"
            />
            <label className="upload-dropzone" htmlFor="file-upload">
              <span className="upload-icon-wrap" aria-hidden="true">
                <Upload size={20} />
              </span>
              <span className="upload-title">{file ? file.name : 'Upload portfolio workbook'}</span>
              <span className="upload-subtitle">Supported: .xlsx, .xls</span>
            </label>
            {touched.show && stepErrors.file && <p className="field-error">{stepErrors.file}</p>}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-body">
          <div className="field">
            <label htmlFor="liquidity_horizon">Liquidity horizon</label>
            <input
              id="liquidity_horizon"
              value={profile.liquidity_horizon}
              placeholder="Example: Need 30% capital available within 18 months"
              onChange={(e) => setProfile({ ...profile, liquidity_horizon: e.target.value })}
            />
            {touched.show && stepErrors.liquidity_horizon && <p className="field-error">{stepErrors.liquidity_horizon}</p>}
          </div>

          <div className="field">
            <label htmlFor="tax_context">Tax context</label>
            <textarea
              id="tax_context"
              rows="3"
              value={profile.tax_context}
              onChange={(e) => setProfile({ ...profile, tax_context: e.target.value })}
            />
            {touched.show && stepErrors.tax_context && <p className="field-error">{stepErrors.tax_context}</p>}
          </div>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={profile.risk_tolerance_confirmed}
              onChange={(e) => setProfile({ ...profile, risk_tolerance_confirmed: e.target.checked })}
            />
            <span>I confirm this risk tolerance and planning profile are accurate.</span>
          </label>
          {touched.show && stepErrors.risk_tolerance_confirmed && <p className="field-error">{stepErrors.risk_tolerance_confirmed}</p>}

          <div className="readiness-card" aria-live="polite">
            <div>
              <p className="readiness-label">Analysis readiness score</p>
              <h3>{score}%</h3>
            </div>
            <ShieldCheck size={22} />
          </div>
        </div>
      )}

      {error && <p className="error-text" role="alert">{error}</p>}

      <div className="wizard-actions">
        <button type="button" className="secondary-button" onClick={prevStep} disabled={step === 1}>Back</button>
        {step < 3 ? (
          <button type="button" className="primary-button" onClick={nextStep}>
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={onSubmit}
            disabled={Object.keys(validateStep(3, profile, file)).length > 0}
          >
            Generate Workspace <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

OnboardingWizard.propTypes = {
  profile: PropTypes.shape({
    role: PropTypes.string,
    objective: PropTypes.string,
    age: PropTypes.string,
    income: PropTypes.string,
    risk_appetite: PropTypes.string,
    goals: PropTypes.string,
    liquidity_horizon: PropTypes.string,
    tax_context: PropTypes.string,
    risk_tolerance_confirmed: PropTypes.bool,
  }).isRequired,
  setProfile: PropTypes.func.isRequired,
  file: PropTypes.object,
  onFileUpload: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  error: PropTypes.string,
};

OnboardingWizard.defaultProps = {
  file: null,
  error: null,
};
