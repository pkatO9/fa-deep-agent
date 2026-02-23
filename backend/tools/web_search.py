import os
from typing import Literal
from tavily import TavilyClient
from langchain_core.tools import tool

# Initialize Tavily client if API key is present
tavily_api_key = os.environ.get("TAVILY_API_KEY")
tavily_client = TavilyClient(api_key=tavily_api_key) if tavily_api_key else None

@tool
def web_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "finance",
    include_raw_content: bool = False,
):
    """
    Search the web for up-to-date financial information, mutual fund news, and market trends.
    Use this to supplement portfolio data with real-time context.
    """
    if not tavily_client:
        return "Error: TAVILY_API_KEY not found in environment."
    
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )
