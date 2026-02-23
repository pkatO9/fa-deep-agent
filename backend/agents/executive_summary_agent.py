import json
import os
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_EXEC
from formatters import extract_json_object, format_executive_markdown, normalize_executive_output


llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2,
)


class ExecutiveOutput(BaseModel):
    summary_text: str = Field(description="Concise executive summary")
    next_steps: list[str] = Field(description="Immediate and sequenced next steps")
    key_metrics: list[str] = Field(description="Metrics to track")
    monitoring_plan: list[str] = Field(description="Monitoring checkpoints")
    confidence_rating: int = Field(description="Confidence rating from 0 to 100")


executive_deep_agent = create_deep_agent(model=llm, system_prompt=SYS_EXEC, response_format=ExecutiveOutput)


def executive_summary_agent_node(state: dict) -> dict:
    """Generates final client-facing report."""
    print("-> Running Executive Summary Agent")

    compiled_context = {
        "user_profile": state["user_profile"],
        "portfolio_summary": state["portfolio_json"]["portfolio_summary"],
        "risk": state.get("risk_analysis_structured") or state.get("risk_analysis", ""),
        "allocation": state.get("allocation_analysis_structured") or state.get("allocation_analysis", ""),
        "behavior": state.get("behavior_analysis_structured") or state.get("behavior_analysis", ""),
        "strategy": state.get("strategy_recommendation_structured") or state.get("strategy_recommendation", ""),
        "validation": {
            "score": state.get("validation_score", 0),
            "feedback": state.get("validation_feedback", ""),
        },
    }

    result = executive_deep_agent.invoke({"messages": [HumanMessage(content=json.dumps(compiled_context, indent=2))]})
    structured_data = result.get("structured_response")

    if structured_data is not None:
        normalized, warnings = normalize_executive_output(structured_data.model_dump())
        source = "structured"
    else:
        raw_text = result["messages"][-1].content
        parsed, warnings = extract_json_object(raw_text)
        normalized, more_warnings = normalize_executive_output(parsed, raw_text=raw_text)
        warnings.extend(more_warnings)
        source = "coerced" if parsed is not None else "fallback"

    markdown = format_executive_markdown(normalized, validation_score=state.get("validation_score"))

    return {
        "executive_summary": markdown,
        "executive_summary_structured": normalized,
        "executive_summary_meta": {"source": source, "warnings": warnings},
    }
