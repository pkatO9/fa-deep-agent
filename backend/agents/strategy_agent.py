import json
import os
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_STRAT_BASE
from formatters import extract_json_object, format_strategy_markdown, normalize_strategy_output


llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2,
)


class StrategyOutput(BaseModel):
    summary: str = Field(description="Concise strategy summary")
    immediate_actions: list[str] = Field(description="Actions for 0-30 days")
    rebalance_plan_12m: list[str] = Field(description="Actions for 3-12 months")
    long_term_plan_5y: list[str] = Field(description="Actions for 1-5 years")
    risk_controls: list[str] = Field(description="Risk guardrails")
    expected_outcomes: list[str] = Field(description="Expected outcomes")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    profile_tie_back: str = Field(description="Link strategy to profile")


def strategy_agent_node(state: dict) -> dict:
    """Synthesizes analysis and personalizes strategy."""
    print("-> Running Strategy Agent (Human-in-the-Loop inputs injected)")
    user_profile = state["user_profile"]

    feedback_context = (
        f"\n\nCRITICAL ENFORCEMENT: Validation score was {state.get('validation_score')} with feedback: "
        f"{state.get('validation_feedback', 'None')}. Address every issue explicitly."
        if state.get("validation_score", 100) < 75
        else ""
    )

    strategy_deep_agent = create_deep_agent(
        model=llm,
        system_prompt=SYS_STRAT_BASE + feedback_context,
        response_format=StrategyOutput,
    )

    analyst_reports = {
        "risk": state.get("risk_analysis_structured") or state.get("risk_analysis", ""),
        "allocation": state.get("allocation_analysis_structured") or state.get("allocation_analysis", ""),
        "behavior": state.get("behavior_analysis_structured") or state.get("behavior_analysis", ""),
    }

    human_msg = f"""
    User Profile:
    {json.dumps(user_profile, indent=2)}

    Analyst Reports:
    {json.dumps(analyst_reports, indent=2)}

    Validation Context:
    {json.dumps({'score': state.get('validation_score', 100), 'feedback': state.get('validation_feedback', '')}, indent=2)}
    """

    result = strategy_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    structured_data = result.get("structured_response")

    if structured_data is not None:
        normalized, warnings = normalize_strategy_output(structured_data.model_dump())
        source = "structured"
    else:
        raw_text = result["messages"][-1].content
        parsed, warnings = extract_json_object(raw_text)
        normalized, more_warnings = normalize_strategy_output(parsed, raw_text=raw_text)
        warnings.extend(more_warnings)
        source = "coerced" if parsed is not None else "fallback"

    markdown = format_strategy_markdown(normalized)

    return {
        "strategy_recommendation": markdown,
        "strategy_recommendation_structured": normalized,
        "strategy_recommendation_meta": {"source": source, "warnings": warnings},
    }
