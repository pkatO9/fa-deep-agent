import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Upload, Briefcase, FileSpreadsheet } from 'lucide-react';

function validateProfile(profile) {
  const errors = {};
  const ageNum = Number(profile.age);
  if (!profile.age?.trim()) {
    errors.age = 'Age is required';
  } else if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 100) {
    errors.age = 'Age must be between 18 and 100';
  }
  if (!profile.income?.trim()) {
    errors.income = 'Annual income is required';
  }
  if (!profile.goals?.trim()) {
    errors.goals = 'Financial goals are required';
  }
  return errors;
}

export function InvestorIntakeForm({
  profile,
  setProfile,
  file,
  onFileUpload,
  onSubmit,
  error,
}) {
  const [touched, setTouched] = useState({});

  const errors = validateProfile(profile);
  const hasValidationErrors = Object.keys(errors).length > 0;
  const isSubmitDisabled = hasValidationErrors || !file;

  const handleBlur = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ age: true, income: true, goals: true });
    if (hasValidationErrors) return;
    if (!file) return;
    onSubmit(e);
  };

  return (
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
              type="number"
              min="18"
              max="100"
              placeholder="Age"
              value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              onBlur={() => handleBlur('age')}
              aria-invalid={touched.age && errors.age}
              aria-describedby={touched.age && errors.age ? 'age-error' : undefined}
            />
            {touched.age && errors.age && (
              <p id="age-error" className="field-error" role="alert">
                {errors.age}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="income">Annual Income</label>
            <input
              id="income"
              placeholder="Annual Income"
              value={profile.income}
              onChange={(e) => setProfile({ ...profile, income: e.target.value })}
              onBlur={() => handleBlur('income')}
              aria-invalid={touched.income && errors.income}
              aria-describedby={touched.income && errors.income ? 'income-error' : undefined}
            />
            {touched.income && errors.income && (
              <p id="income-error" className="field-error" role="alert">
                {errors.income}
              </p>
            )}
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
            onBlur={() => handleBlur('goals')}
            aria-invalid={touched.goals && errors.goals}
            aria-describedby={touched.goals && errors.goals ? 'goals-error' : undefined}
          />
          {touched.goals && errors.goals && (
            <p id="goals-error" className="field-error" role="alert">
              {errors.goals}
            </p>
          )}
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
            onChange={onFileUpload}
            accept=".xlsx,.xls"
          />
          <label className="upload-dropzone" htmlFor="file-upload">
            <span className="upload-icon-wrap" aria-hidden="true">
              <FileSpreadsheet size={22} />
            </span>
            <span className="upload-title">{file ? file.name : 'Upload portfolio workbook'}</span>
            <span className="upload-subtitle">Supported: .xlsx, .xls</span>
          </label>
          {!file && (touched.age || touched.income || touched.goals) && (
            <p className="field-error" role="alert">
              Portfolio file is required
            </p>
          )}
        </div>

        <button type="submit" className="primary-button" disabled={isSubmitDisabled}>
          <span className="button-content">
            <Upload size={18} />
            Generate Advisory Strategy
          </span>
        </button>

        {error && <p className="error-text" role="alert">{error}</p>}
      </form>
    </section>
  );
}

InvestorIntakeForm.propTypes = {
  profile: PropTypes.shape({
    age: PropTypes.string,
    income: PropTypes.string,
    risk_appetite: PropTypes.string,
    goals: PropTypes.string,
  }).isRequired,
  setProfile: PropTypes.func.isRequired,
  file: PropTypes.object,
  onFileUpload: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  error: PropTypes.string,
};

InvestorIntakeForm.defaultProps = {
  file: null,
  error: null,
};
