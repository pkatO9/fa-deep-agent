import json
import os
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_RISK
from tools.fetch_market_data import fetch_market_data
from tools.web_search import web_search

llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2
)

risk_deep_agent = create_deep_agent(model=llm, system_prompt=SYS_RISK, tools=[fetch_market_data, web_search])

def risk_agent_node(state: dict) -> dict:
    """Analyzes risk exposure deeply based on the deterministic portfolio data."""
    print("-> Running Risk Agent")
    portfolio = state["portfolio_json"]
    human_msg = f"Analyze this portfolio's risk:\n{json.dumps(portfolio['risk_metrics'], indent=2)}\nAllocation:\n{json.dumps(portfolio['allocation'], indent=2)}"
    
    result = risk_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    return {"risk_analysis": result["messages"][-1].content}
