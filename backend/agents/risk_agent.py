import json
import os
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_RISK
from tools.fetch_market_data import fetch_market_data
from tools.web_search import web_search
from formatters import extract_json_object, format_risk_markdown, normalize_risk_output


llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2,
)


class RiskOutput(BaseModel):
    risk_level: str = Field(description="Low, Moderate, High, or Very High")
    concentration_risk_analysis: str = Field(description="Concentration risk analysis")
    diversification_risk_analysis: str = Field(description="Diversification analysis")
    age_alignment: str = Field(description="Age and goal alignment summary")
    severity_score: int = Field(description="Risk severity score from 0 to 100")
    key_findings: list[str] = Field(description="Key risk findings")
    immediate_actions: list[str] = Field(description="Actions for next 0-30 days")
    profile_tie_back: str = Field(description="Link recommendations to profile")


risk_deep_agent = create_deep_agent(
    model=llm,
    system_prompt=SYS_RISK,
    response_format=RiskOutput,
    tools=[fetch_market_data, web_search],
)


def risk_agent_node(state: dict) -> dict:
    """Analyzes risk exposure based on deterministic portfolio data."""
    print("-> Running Risk Agent")
    portfolio = state["portfolio_json"]
    user_profile = state["user_profile"]

    human_msg = f"""
    User Profile:
    {json.dumps(user_profile, indent=2)}

    Risk Metrics:
    {json.dumps(portfolio['risk_metrics'], indent=2)}

    Allocation:
    {json.dumps(portfolio['allocation'], indent=2)}
    """

    result = risk_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    structured_data = result.get("structured_response")

    if structured_data is not None:
        normalized, warnings = normalize_risk_output(structured_data.model_dump())
        source = "structured"
    else:
        raw_text = result["messages"][-1].content
        parsed, warnings = extract_json_object(raw_text)
        normalized, more_warnings = normalize_risk_output(parsed, raw_text=raw_text)
        warnings.extend(more_warnings)
        source = "coerced" if parsed is not None else "fallback"

    markdown = format_risk_markdown(normalized)
    return {
        "risk_analysis": markdown,
        "risk_analysis_structured": normalized,
        "risk_analysis_meta": {"source": source, "warnings": warnings},
    }
