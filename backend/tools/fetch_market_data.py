from langchain_core.tools import tool

@tool
def fetch_market_data(ticker: str) -> dict:
    """
    Fetches live market data, current prices, and performance indicators for a given mutual fund scheme or ticker.
    Use this to get up-to-date valuations for risk analysis.
    """
    return {"ticker": ticker, "price": "mock_price", "status": "Not implemented"}