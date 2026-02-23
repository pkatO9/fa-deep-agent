import json
import re
from typing import Any


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _to_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [_clean_text(item) for item in value if _clean_text(item)]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _to_int(value: Any, default: int) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _to_map(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    normalized: dict[str, str] = {}
    for key, raw in value.items():
        label = _clean_text(key)
        if not label:
            continue
        if isinstance(raw, (int, float)):
            normalized[label] = f"{raw:.2f}%"
        else:
            text = _clean_text(raw)
            normalized[label] = text if text else "-"
    return normalized


def _extract_json_candidate(text: str) -> dict[str, Any] | None:
    def _parse(candidate: str) -> dict[str, Any] | None:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            return None
        if isinstance(parsed, dict):
            return parsed
        return None

    direct = _parse(text)
    if direct is not None:
        return direct

    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        fenced_parsed = _parse(fenced.group(1).strip())
        if fenced_parsed is not None:
            return fenced_parsed

    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        return _parse(text[first_brace : last_brace + 1])

    return None


def extract_json_object(raw_text: str) -> tuple[dict[str, Any] | None, list[str]]:
    warnings: list[str] = []
    if not raw_text or not raw_text.strip():
        warnings.append("Empty model response; using fallback template.")
        return None, warnings

    parsed = _extract_json_candidate(raw_text.strip())
    if parsed is None:
        warnings.append("Response was not valid JSON; coercing from raw text.")
    return parsed, warnings


def normalize_risk_output(data: dict[str, Any] | None, raw_text: str = "") -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    payload = data or {}

    concentration = _clean_text(payload.get("concentration_risk_analysis"))
    diversification = _clean_text(payload.get("diversification_risk_analysis"))
    if not concentration and raw_text:
        concentration = _clean_text(raw_text)
        warnings.append("Used raw text as concentration analysis.")

    normalized = {
        "risk_level": _clean_text(payload.get("risk_level")) or "Unknown",
        "concentration_risk_analysis": concentration or "Risk analysis unavailable.",
        "diversification_risk_analysis": diversification or "Diversification details unavailable.",
        "age_alignment": _clean_text(payload.get("age_alignment")) or "Profile alignment details unavailable.",
        "severity_score": _to_int(payload.get("severity_score"), 50),
        "key_findings": _to_list(payload.get("key_findings") or payload.get("issues")),
        "immediate_actions": _to_list(payload.get("immediate_actions") or payload.get("recommended_shifts")),
        "profile_tie_back": _clean_text(payload.get("profile_tie_back")) or "Tie recommendations directly to investor profile in next refresh.",
    }
    return normalized, warnings


def normalize_allocation_output(data: dict[str, Any] | None, raw_text: str = "") -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    payload = data or {}

    implementation_horizon = _clean_text(payload.get("implementation_horizon"))
    if not implementation_horizon and raw_text:
        implementation_horizon = "Prioritize allocation changes in 0-30 days, then rebalance through 3-12 months."
        warnings.append("Defaulted implementation horizon due to missing structured field.")

    normalized = {
        "current_allocation": _to_map(payload.get("current_allocation")),
        "issues": _to_list(payload.get("issues")),
        "recommended_shifts": _to_list(payload.get("recommended_shifts") or payload.get("immediate_actions")),
        "target_allocation": _to_map(payload.get("target_allocation")),
        "implementation_horizon": implementation_horizon or "Implementation horizon unavailable.",
        "confidence_score": _to_int(payload.get("confidence_score"), 70),
        "profile_tie_back": _clean_text(payload.get("profile_tie_back")) or "Allocation updates should align with investor goals and risk appetite.",
    }

    if not normalized["current_allocation"] and raw_text:
        warnings.append("Current allocation map unavailable from response.")
    return normalized, warnings


def normalize_behavior_output(data: dict[str, Any] | None, raw_text: str = "") -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    payload = data or {}

    behavior_summary = _clean_text(payload.get("behavior_summary"))
    if not behavior_summary and raw_text:
        behavior_summary = _clean_text(raw_text)
        warnings.append("Used raw text as behavior summary.")

    normalized = {
        "behavior_summary": behavior_summary or "Behavioral analysis unavailable.",
        "discipline_issues": _to_list(payload.get("discipline_issues") or payload.get("issues")),
        "action_plan_0_30_days": _to_list(payload.get("action_plan_0_30_days") or payload.get("immediate_actions")),
        "action_plan_3_12_months": _to_list(payload.get("action_plan_3_12_months") or payload.get("rebalance_plan_12m")),
        "confidence_score": _to_int(payload.get("confidence_score"), 70),
        "profile_tie_back": _clean_text(payload.get("profile_tie_back")) or "Behavior changes should support long-term wealth goals.",
    }
    return normalized, warnings


def normalize_strategy_output(data: dict[str, Any] | None, raw_text: str = "") -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    payload = data or {}

    summary = _clean_text(payload.get("summary"))
    if not summary and raw_text:
        summary = _clean_text(raw_text)
        warnings.append("Used raw text as strategy summary.")

    normalized = {
        "summary": summary or "Strategy summary unavailable.",
        "immediate_actions": _to_list(payload.get("immediate_actions")),
        "rebalance_plan_12m": _to_list(payload.get("rebalance_plan_12m")),
        "long_term_plan_5y": _to_list(payload.get("long_term_plan_5y")),
        "risk_controls": _to_list(payload.get("risk_controls") or payload.get("issues")),
        "expected_outcomes": _to_list(payload.get("expected_outcomes") or payload.get("key_metrics")),
        "confidence_score": _to_int(payload.get("confidence_score"), 75),
        "profile_tie_back": _clean_text(payload.get("profile_tie_back")) or "Strategy is tied to investor profile and long-term objectives.",
    }
    return normalized, warnings


def normalize_executive_output(data: dict[str, Any] | None, raw_text: str = "") -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    payload = data or {}

    summary_text = _clean_text(payload.get("summary_text"))
    if not summary_text and raw_text:
        summary_text = _clean_text(raw_text)
        warnings.append("Used raw text as executive summary.")

    normalized = {
        "summary_text": summary_text or "Executive summary unavailable.",
        "next_steps": _to_list(payload.get("next_steps") or payload.get("immediate_actions")),
        "key_metrics": _to_list(payload.get("key_metrics") or payload.get("expected_outcomes")),
        "monitoring_plan": _to_list(payload.get("monitoring_plan") or payload.get("review_plan")),
        "confidence_rating": _to_int(payload.get("confidence_rating") or payload.get("confidence_score"), 75),
    }
    return normalized, warnings
