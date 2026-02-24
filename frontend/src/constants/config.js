import { Shield, PieChart, User, TrendingUp, CheckCircle } from 'lucide-react';

/**
 * Centralized API and app configuration.
 * Use VITE_API_URL in .env for production; defaults to localhost for dev.
 */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const SECTION_CONFIG = [
  { id: 'risk', title: 'Risk Assessment', icon: Shield, resultKey: 'risk_analysis', metaKey: 'risk_analysis_meta', metricState: 'warn' },
  { id: 'allocation', title: 'Allocation Strategy', icon: PieChart, resultKey: 'allocation_analysis', metaKey: 'allocation_analysis_meta', metricState: 'positive' },
  { id: 'behavior', title: 'Behavioral Analysis', icon: User, resultKey: 'behavior_analysis', metaKey: 'behavior_analysis_meta', metricState: 'neutral' },
  { id: 'strategy', title: 'Chief Strategy Recommendation', icon: TrendingUp, resultKey: 'strategy_recommendation', metaKey: 'strategy_recommendation_meta', metricState: 'positive' },
  { id: 'executive', title: 'Executive Summary', icon: CheckCircle, resultKey: 'executive_summary', metaKey: 'executive_summary_meta', metricState: 'positive' },
];
