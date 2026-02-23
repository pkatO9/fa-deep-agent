import json
import os
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_EXEC

llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2
)

executive_deep_agent = create_deep_agent(model=llm, system_prompt=SYS_EXEC)

def executive_summary_agent_node(state: dict) -> dict:
    """Generates the final client-facing report."""
    print("-> Running Executive Summary Agent")
    human_msg = f"""
    Client Profile: {json.dumps(state['user_profile'])}
    Deterministic Data: {json.dumps(state['portfolio_json']['portfolio_summary'])}
    Final Strategy: {state['strategy_recommendation']}
    """
    
    result = executive_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    return {"executive_summary": result["messages"][-1].content}
