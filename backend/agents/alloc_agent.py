import json
import os
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_ALLOC
from tools.simulate_portfolio import simulate_portfolio
from tools.web_search import web_search
from formatters import extract_json_object, format_allocation_markdown, normalize_allocation_output


llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2,
)


class AllocationOutput(BaseModel):
    current_allocation: dict[str, str | int | float] = Field(description="Current allocation category percentages")
    issues: list[str] = Field(description="Allocation issues")
    recommended_shifts: list[str] = Field(description="Specific allocation shifts")
    target_allocation: dict[str, str | int | float] = Field(description="Target allocation category percentages")
    implementation_horizon: str = Field(description="Execution plan across time horizons")
    confidence_score: int = Field(description="Confidence score from 0 to 100")
    profile_tie_back: str = Field(description="Link recommendations to profile")


allocation_deep_agent = create_deep_agent(
    model=llm,
    system_prompt=SYS_ALLOC,
    response_format=AllocationOutput,
    tools=[simulate_portfolio, web_search],
)


def alloc_agent_node(state: dict) -> dict:
    """Recommends allocation shifts."""
    print("-> Running Allocation Agent")
    portfolio = state["portfolio_json"]
    user_profile = state["user_profile"]
    human_msg = f"""
    User Profile:
    {json.dumps(user_profile, indent=2)}

    Current Allocation:
    {json.dumps(portfolio['allocation'], indent=2)}

    Schemes:
    {json.dumps([s['scheme_name'] for s in portfolio['schemes_extracted']], indent=2)}
    """

    result = allocation_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    structured_data = result.get("structured_response")

    if structured_data is not None:
        normalized, warnings = normalize_allocation_output(structured_data.model_dump())
        source = "structured"
    else:
        raw_text = result["messages"][-1].content
        parsed, warnings = extract_json_object(raw_text)
        normalized, more_warnings = normalize_allocation_output(parsed, raw_text=raw_text)
        warnings.extend(more_warnings)
        source = "coerced" if parsed is not None else "fallback"

    markdown = format_allocation_markdown(normalized)
    return {
        "allocation_analysis": markdown,
        "allocation_analysis_structured": normalized,
        "allocation_analysis_meta": {"source": source, "warnings": warnings},
    }
