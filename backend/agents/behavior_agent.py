import json
import os
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_BEHAV
from formatters import extract_json_object, format_behavior_markdown, normalize_behavior_output


llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2,
)


class BehaviorOutput(BaseModel):
    behavior_summary: str = Field(description="Behavior summary")
    discipline_issues: list[str] = Field(description="Discipline issues")
    action_plan_0_30_days: list[str] = Field(description="Actions for 0-30 days")
    action_plan_3_12_months: list[str] = Field(description="Actions for 3-12 months")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    profile_tie_back: str = Field(description="Link behavior recommendations to profile")


behavior_deep_agent = create_deep_agent(
    model=llm,
    system_prompt=SYS_BEHAV,
    response_format=BehaviorOutput,
)


def behavior_agent_node(state: dict) -> dict:
    """Evaluates behavioral patterns based on transaction history."""
    print("-> Running Behavior Agent")
    portfolio = state["portfolio_json"]
    user_profile = state["user_profile"]
    human_msg = f"""
    User Profile:
    {json.dumps(user_profile, indent=2)}

    Transaction Behavior:
    {json.dumps(portfolio['transaction_behavior'], indent=2)}
    """

    result = behavior_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    structured_data = result.get("structured_response")

    if structured_data is not None:
        normalized, warnings = normalize_behavior_output(structured_data.model_dump())
        source = "structured"
    else:
        raw_text = result["messages"][-1].content
        parsed, warnings = extract_json_object(raw_text)
        normalized, more_warnings = normalize_behavior_output(parsed, raw_text=raw_text)
        warnings.extend(more_warnings)
        source = "coerced" if parsed is not None else "fallback"

    markdown = format_behavior_markdown(normalized)
    return {
        "behavior_analysis": markdown,
        "behavior_analysis_structured": normalized,
        "behavior_analysis_meta": {"source": source, "warnings": warnings},
    }
