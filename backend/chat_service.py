"""
Chat service for portfolio advisory Q&A.

Uses the same compiled context as the executive summary agent so the chatbot
can answer questions about risk, allocation, behavior, strategy, validation,
and the executive summary. The LLM receives this context on every turn and
responds conversationally without structured output.
"""

import json
import os
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI


def build_executive_context(state: dict) -> dict:
    """
    Build the same compiled context used by the executive summary agent.
    Used to inject full advisory context into the chat.
    """
    return {
        "user_profile": state.get("user_profile", {}),
        "portfolio_summary": (state.get("portfolio_json") or {}).get("portfolio_summary", {}),
        "risk": state.get("risk_analysis_structured") or state.get("risk_analysis", ""),
        "allocation": state.get("allocation_analysis_structured") or state.get("allocation_analysis", ""),
        "behavior": state.get("behavior_analysis_structured") or state.get("behavior_analysis", ""),
        "strategy": state.get("strategy_recommendation_structured") or state.get("strategy_recommendation", ""),
        "validation": {
            "score": state.get("validation_score", 0),
            "feedback": state.get("validation_feedback", ""),
        },
        "executive_summary": state.get("executive_summary", ""),
    }


CHAT_SYSTEM_PROMPT = """You are a knowledgeable financial advisor assistant. You have access to the full portfolio advisory report for the current investor, including:

- User profile (age, income, risk appetite, goals)
- Portfolio summary and metrics
- Risk analysis
- Allocation analysis
- Behavioral analysis
- Strategy recommendations
- Validation score and feedback
- Executive summary

Answer the user's questions about their portfolio, recommendations, next steps, or any aspect of the advisory report. Be specific, cite numbers and sections when relevant, and stay within the scope of the provided context. If asked about something not in the report, say so politely and suggest they consult their advisor."""


def get_chat_llm():
    """Return the chat LLM instance."""
    return AzureChatOpenAI(
        azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1"),
        openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
        temperature=0.3,
    )


def chat_with_context(
    state: dict,
    user_message: str,
    history: list[dict],
) -> str:
    """
    Generate a chat response using the executive summary agent's context.

    Args:
        state: Full pipeline result state (portfolio_json, risk, allocation, etc.)
        user_message: The user's latest message
        history: List of {role: "user"|"assistant", content: str} for conversation history

    Returns:
        The assistant's response text.
    """
    llm = get_chat_llm()
    compiled_context = build_executive_context(state)
    context_str = json.dumps(compiled_context, indent=2)

    system_content = f"""{CHAT_SYSTEM_PROMPT}

---
ADVISORY REPORT CONTEXT (use this to answer questions):
{context_str}
"""

    messages = [SystemMessage(content=system_content)]

    from langchain_core.messages import AIMessage

    for msg in history:
        if msg.get("role") == "user":
            messages.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "assistant":
            messages.append(AIMessage(content=msg.get("content", "")))

    messages.append(HumanMessage(content=user_message))

    response = llm.invoke(messages)
    return response.content if hasattr(response, "content") else str(response)
