import json
import os
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_BEHAV

llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2
)

behavior_deep_agent = create_deep_agent(model=llm, system_prompt=SYS_BEHAV)

def behavior_agent_node(state: dict) -> dict:
    """Evaluates behavioral patterns based on transaction history."""
    print("-> Running Behavior Agent")
    portfolio = state["portfolio_json"]
    human_msg = f"Transaction Behavior:\n{json.dumps(portfolio['transaction_behavior'], indent=2)}"
    
    result = behavior_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    return {"behavior_analysis": result["messages"][-1].content}
