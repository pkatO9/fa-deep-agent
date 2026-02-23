import json
import os
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_openai import AzureChatOpenAI
from deepagents import create_deep_agent
from prompts import SYS_VAL
from tools.compliance_checker import check_compliance

llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
    openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    temperature=0.2
)

class ValidationOutput(BaseModel):
    score: int = Field(description="Score from 0 to 100 representing the quality and safety of the strategy.")
    feedback: str = Field(description="Critical feedback on why the score was given, especially if below 75.")

validation_deep_agent = create_deep_agent(model=llm, system_prompt=SYS_VAL, response_format=ValidationOutput, tools=[check_compliance])

def validation_agent_node(state: dict) -> dict:
    """Critiques the strategy and challenges assumptions."""
    print("-> Running Validation Agent")
    
    human_msg = f"""
    User Profile: {json.dumps(state['user_profile'])}
    Raw Portfolio Stats: {json.dumps(state['portfolio_json']['portfolio_summary'])}
    Proposed Strategy: {state['strategy_recommendation']}
    """
    
    result = validation_deep_agent.invoke({"messages": [HumanMessage(content=human_msg)]})
    structured_data = result.get("structured_response")
    print(f"   Validation Score: {structured_data.score}")
    return {"validation_score": structured_data.score, "validation_feedback": structured_data.feedback}
