import json
import os
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_ALLOC
from tools.simulate_portfolio import simulate_portfolio
from tools.web_search import web_search

llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2
)

allocation_deep_agent = create_deep_agent(model=llm, system_prompt=SYS_ALLOC, tools=[simulate_portfolio, web_search])

def alloc_agent_node(state: dict) -> dict:
    """Recommends allocation shifts."""
    print("-> Running Allocation Agent")
    portfolio = state["portfolio_json"]
    human_msg = f"Current Allocation:\n{json.dumps(portfolio['allocation'], indent=2)}\nSchemes:\n{json.dumps([s['scheme_name'] for s in portfolio['schemes_extracted']], indent=2)}"
    
    result = allocation_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    return {"allocation_analysis": result["messages"][-1].content}
