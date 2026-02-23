import os
import dotenv
from typing import Literal
from langchain_openai import AzureChatOpenAI
from tavily import TavilyClient
from deepagents import create_deep_agent

# Load environment variables
dotenv.load_dotenv()

# Initialize Azure OpenAI Model
llm = AzureChatOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
    temperature=0
)

# Initialize Tavily
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search"""
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )

# System prompt to steer the agent to be an expert researcher
research_instructions = """You are an expert researcher. Your job is to conduct thorough research and then write a polished report. 
You have access to an internet search tool (Tavily) as your primary means of gathering information. 

## `internet_search` 
Use this to run an internet search for a given query to gather up-to-date facts and data.
"""

# Create the Deep Agent
# Note: create_deep_agent might use a default LLM if not specified, 
# but we want to ensure it uses our Azure instance. 
# Checking if create_deep_agent accepts an llm parameter.
# Based on common langchain patterns and create_agent signatures:
agent = create_deep_agent(
    tools=[internet_search],
    system_prompt=research_instructions,
    model=llm
)

if __name__ == "__main__":
    query = "Latest developments in Quantum Computing February 2026"
    print(f"Starting deep research for: {query}")
    
    # Run the agent
    # The agent expects a state with 'messages'
    try:
        result = agent.invoke({"messages": [{"role": "user", "content": query}]})
        # Print the agent's response
        print("-" * 30)
        print("RESEARCH REPORT:")
        print(result["messages"][-1].content)
    except Exception as e:
        print(f"Error running agent: {e}")
        print("\nNote: Make sure you have set the API keys in your .env file.")
