/**
 * @typedef {'Advisor'|'Investor'} UserRole
 * @typedef {'preserve_capital'|'retirement_growth'|'income_generation'|'goal_funding'|'tax_efficiency'} ObjectiveType
 * @typedef {{ title: string, impact: string, urgency: string, confidence: string, rationale: string }} DecisionCard
 * @typedef {{ section: string, excerpt: string }} ChatCitation
 * @typedef {{ run_id: string, created_at: string, role_profile: { role: UserRole, objective: ObjectiveType }, results: object }} RunSummary
 */

export const ROLE_OPTIONS = [
  {
    value: 'Advisor',
    label: 'Wealth Advisor',
    description: 'Client-ready framing, denser metrics, and meeting handoff tools.',
  },
  {
    value: 'Investor',
    label: 'Self-Serve Investor',
    description: 'Plain-language interpretation, guardrails, and educational prompts.',
  },
];

export const OBJECTIVE_OPTIONS = [
  { value: 'retirement_growth', label: 'Retirement growth' },
  { value: 'preserve_capital', label: 'Preserve capital' },
  { value: 'income_generation', label: 'Income generation' },
  { value: 'goal_funding', label: 'Goal-based funding' },
  { value: 'tax_efficiency', label: 'Tax efficiency' },
];
