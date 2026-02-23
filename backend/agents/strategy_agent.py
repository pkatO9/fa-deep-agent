import json
import os
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_STRAT_BASE

llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2
)

def strategy_agent_node(state: dict) -> dict:
    """Synthesizes analysis and personalizes advice (Human-in-the-loop anchor point)."""
    print("-> Running Strategy Agent (Human-in-the-Loop inputs injected)")
    user_profile = state["user_profile"]
    
    feedback_context = f"\n\nCRITICAL ENFORCEMENT: The Validation Agent rejected your previous strategy with this feedback: {state.get('validation_feedback', 'None')}. You MUST fix these issues." if state.get("validation_score", 100) < 75 else ""
    
    strategy_deep_agent = create_deep_agent(model=llm, system_prompt=SYS_STRAT_BASE + feedback_context)
    
    human_msg = f"""
    User Profile:
    - Age: {user_profile.get('age', 'Unknown')}
    - Income: {user_profile.get('income', 'Unknown')}
    - Risk Appetite: {user_profile.get('risk_appetite', 'Unknown')}
    - Financial Goals: {user_profile.get('goals', 'Unknown')}
    
    Analyst Reports:
    - Risk: {state.get('risk_analysis', '')[:500]}...
    - Allocation: {state.get('allocation_analysis', '')[:500]}...
    - Behavior: {state.get('behavior_analysis', '')[:500]}...
    """
    
    result = strategy_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    return {"strategy_recommendation": result["messages"][-1].content}
