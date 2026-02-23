from typing import Dict, Iterable


def _clean(value: str) -> str:
    return (value or "").strip()


def _bullet_list(items: Iterable[str]) -> str:
    cleaned = [_clean(i) for i in items if _clean(i)]
    return "\n".join([f"- {item}" for item in cleaned]) if cleaned else "- Not available"


def _numbered_list(items: Iterable[str]) -> str:
    cleaned = [_clean(i) for i in items if _clean(i)]
    return "\n".join([f"{idx}. {item}" for idx, item in enumerate(cleaned, start=1)]) if cleaned else "1. Not available"


def _allocation_table(current_allocation: Dict[str, str], target_allocation: Dict[str, str]) -> str:
    categories = sorted(set(current_allocation.keys()) | set(target_allocation.keys()))
    lines = [
        "| Category | Current | Target |",
        "|---|---:|---:|",
    ]
    for category in categories:
        lines.append(f"| {category} | {current_allocation.get(category, '-')} | {target_allocation.get(category, '-')} |")
    return "\n".join(lines)


def format_risk_markdown(risk: dict) -> str:
    return "\n\n".join([
        "## Risk Assessment",
        _clean(risk.get("concentration_risk_analysis", "")),
        "### Risk Snapshot",
        f"- **Risk Level:** {_clean(risk.get('risk_level', 'Unknown'))}",
        f"- **Severity Score:** {risk.get('severity_score', 'N/A')}/100",
        "### Key Findings",
        _bullet_list(risk.get("key_findings", [])),
        "### Age & Goal Alignment",
        _clean(risk.get("age_alignment", "")),
        "### Immediate Actions (0-30 Days)",
        _numbered_list(risk.get("immediate_actions", [])),
        "### Profile Tie-Back",
        _clean(risk.get("profile_tie_back", "")),
    ])


def format_allocation_markdown(allocation: dict) -> str:
    return "\n\n".join([
        "## Allocation Strategy",
        "### Allocation Map",
        _allocation_table(allocation.get("current_allocation", {}), allocation.get("target_allocation", {})),
        "### Issues",
        _bullet_list(allocation.get("issues", [])),
        "### Recommended Shifts",
        _numbered_list(allocation.get("recommended_shifts", [])),
        "### Implementation Horizon",
        _clean(allocation.get("implementation_horizon", "")),
        f"### Confidence\n- **Confidence Score:** {allocation.get('confidence_score', 'N/A')}/100",
        "### Profile Tie-Back",
        _clean(allocation.get("profile_tie_back", "")),
    ])


def format_behavior_markdown(behavior: dict) -> str:
    return "\n\n".join([
        "## Behavioral Analysis",
        _clean(behavior.get("behavior_summary", "")),
        "### Discipline Issues",
        _bullet_list(behavior.get("discipline_issues", [])),
        "### Action Plan (0-30 Days)",
        _numbered_list(behavior.get("action_plan_0_30_days", [])),
        "### Action Plan (3-12 Months)",
        _numbered_list(behavior.get("action_plan_3_12_months", [])),
        f"### Confidence\n- **Confidence Score:** {behavior.get('confidence_score', 'N/A')}/100",
        "### Profile Tie-Back",
        _clean(behavior.get("profile_tie_back", "")),
    ])


def format_strategy_markdown(strategy: dict) -> str:
    return "\n\n".join([
        "## Chief Strategy Recommendation",
        _clean(strategy.get("summary", "")),
        "### Immediate Actions (0-30 Days)",
        _numbered_list(strategy.get("immediate_actions", [])),
        "### Rebalance Plan (3-12 Months)",
        _numbered_list(strategy.get("rebalance_plan_12m", [])),
        "### Long-Term Plan (1-5 Years)",
        _numbered_list(strategy.get("long_term_plan_5y", [])),
        "### Risk Controls",
        _bullet_list(strategy.get("risk_controls", [])),
        "### Expected Outcomes",
        _bullet_list(strategy.get("expected_outcomes", [])),
        f"### Confidence\n- **Confidence Score:** {strategy.get('confidence_score', 'N/A')}/100",
        "### Profile Tie-Back",
        _clean(strategy.get("profile_tie_back", "")),
    ])


def format_executive_markdown(executive: dict, validation_score: int | None = None) -> str:
    header = "## Executive Summary"
    if validation_score is not None:
        header += f"\n\n- **Validation Score:** {validation_score}/100"

    return "\n\n".join([
        header,
        _clean(executive.get("summary_text", "")),
        "### Next Steps",
        _numbered_list(executive.get("next_steps", [])),
        "### Key Metrics To Track",
        _bullet_list(executive.get("key_metrics", [])),
        "### Monitoring Plan",
        _bullet_list(executive.get("monitoring_plan", [])),
        f"### Confidence\n- **Confidence Rating:** {executive.get('confidence_rating', 'N/A')}/100",
    ])
