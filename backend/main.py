import os
import json
from typing import TypedDict, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from langgraph.graph import StateGraph, START, END

# Component Imports
from portfolio_loader import PortfolioProcessor
from agents.risk_agent import risk_agent_node
from agents.alloc_agent import alloc_agent_node
from agents.behavior_agent import behavior_agent_node
from agents.strategy_agent import strategy_agent_node
from agents.validation_agent import validation_agent_node
from agents.executive_summary_agent import executive_summary_agent_node


# --- State Definition ---
class PortfolioState(TypedDict, total=False):
    """The shared state for the multi-agent portfolio advisory workflow."""

    portfolio_json: Dict[str, Any]
    user_profile: Dict[str, str]

    risk_analysis: str
    risk_analysis_structured: Dict[str, Any]
    risk_analysis_meta: Dict[str, Any]

    allocation_analysis: str
    allocation_analysis_structured: Dict[str, Any]
    allocation_analysis_meta: Dict[str, Any]

    behavior_analysis: str
    behavior_analysis_structured: Dict[str, Any]
    behavior_analysis_meta: Dict[str, Any]

    strategy_recommendation: str
    strategy_recommendation_structured: Dict[str, Any]
    strategy_recommendation_meta: Dict[str, Any]

    validation_score: int
    validation_feedback: str

    executive_summary: str
    executive_summary_structured: Dict[str, Any]
    executive_summary_meta: Dict[str, Any]


# --- Routing Logic ---
def route_validation(state: PortfolioState) -> str:
    """Routes to strategy if score < 75, else to summary."""
    if state["validation_score"] < 75:
        print("   Routing back to Strategy Agent (Score < 75)")
        return "strategy_agent"
    print("   Routing to Executive Summary (Score >= 75)")
    return "executive_summary_agent"


# --- Graph Construction ---
def build_graph() -> StateGraph:
    workflow = StateGraph(PortfolioState)

    # Add Nodes
    workflow.add_node("risk_agent", risk_agent_node)
    workflow.add_node("allocation_agent", alloc_agent_node)
    workflow.add_node("behavior_agent", behavior_agent_node)
    workflow.add_node("strategy_agent", strategy_agent_node)
    workflow.add_node("validation_agent", validation_agent_node)
    workflow.add_node("executive_summary_agent", executive_summary_agent_node)

    # Define Edges - Parallel execution for analysts
    workflow.add_edge(START, "risk_agent")
    workflow.add_edge(START, "allocation_agent")
    workflow.add_edge(START, "behavior_agent")

    # Analysts feed to strategist
    workflow.add_edge("risk_agent", "strategy_agent")
    workflow.add_edge("allocation_agent", "strategy_agent")
    workflow.add_edge("behavior_agent", "strategy_agent")

    # Strategist feeds to Validator
    workflow.add_edge("strategy_agent", "validation_agent")

    # Validator conditional routing
    workflow.add_conditional_edges(
        "validation_agent",
        route_validation,
        {
            "strategy_agent": "strategy_agent",
            "executive_summary_agent": "executive_summary_agent",
        },
    )

    workflow.add_edge("executive_summary_agent", END)

    return workflow.compile()


# --- Pipeline Executor ---
def run_advisory_pipeline(file_path: str, user_profile: dict) -> dict:
    """Run the full pipeline and return final state. Use for non-streaming."""
    for event in run_advisory_pipeline_stream(file_path, user_profile):
        if event.get("event") == "complete":
            return event["results"]
    return {}


def run_advisory_pipeline_stream(file_path: str, user_profile: dict):
    """
    Run the pipeline and yield progress events for streaming to the frontend.
    Yields: {"event": "phase"|"node"|"complete", ...}
    """
    yield {"event": "phase", "phase": "extract", "message": "Extracting portfolio data..."}

    processor = PortfolioProcessor(file_path)
    processor.load_file()
    processor.clean_data()
    processor.detect_structure()
    processor.extract_scheme_summary()
    processor.analyze_transactions()
    processor.compute_portfolio_metrics()

    portfolio_json_str = processor.generate_final_output()
    portfolio_data = json.loads(portfolio_json_str)

    yield {"event": "phase", "phase": "graph", "message": "Initializing multi-agent workflow..."}

    initial_state: PortfolioState = {
        "portfolio_json": portfolio_data,
        "user_profile": user_profile,
        "risk_analysis": "",
        "allocation_analysis": "",
        "behavior_analysis": "",
        "strategy_recommendation": "",
        "validation_score": 100,
        "validation_feedback": "",
        "executive_summary": "",
    }

    graph = build_graph()
    result_state = initial_state.copy()

    for step in graph.stream(initial_state, stream_mode="updates"):
        for node_name, node_state in step.items():
            for key, value in node_state.items():
                result_state[key] = value
            yield {"event": "node", "node": node_name, "message": _node_display_name(node_name)}

    yield {"event": "complete", "results": result_state}


def _node_display_name(node: str) -> str:
    """Human-readable label for pipeline nodes."""
    labels = {
        "risk_agent": "Risk assessment",
        "allocation_agent": "Allocation analysis",
        "behavior_agent": "Behavioral analysis",
        "strategy_agent": "Strategy recommendation",
        "validation_agent": "Validation",
        "executive_summary_agent": "Executive summary",
    }
    return labels.get(node, node.replace("_", " ").title())


def print_graph_diagram() -> None:
    """
    Print the LangGraph workflow diagram.
    - Mermaid: paste output at https://mermaid.live
    - ASCII: requires `pip install grandalf`
    - PNG: requires grandalf, saves to workflow_diagram.png
    """
    graph = build_graph()
    mermaid = graph.get_graph().draw_mermaid()
    print("\n========== WORKFLOW DIAGRAM (Mermaid) ==========")
    print("Paste at https://mermaid.live to view interactively\n")
    print(mermaid)
    print("\n==================================================\n")
    try:
        ascii_diagram = graph.get_graph().draw_ascii()
        print("========== ASCII DIAGRAM ==========\n")
        print(ascii_diagram)
    except ImportError:
        print("(Install grandalf for ASCII/PNG: pip install grandalf)")
    try:
        png_bytes = graph.get_graph().draw_mermaid_png()
        out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workflow_diagram.png")
        with open(out_path, "wb") as f:
            f.write(png_bytes)
        print(f"\nPNG saved to: {out_path}")
    except ImportError:
        pass


if __name__ == "__main__":
    # Print workflow diagram (Mermaid → paste at mermaid.live)
    print_graph_diagram()

    mock_user_profile = {
        "age": "35",
        "income": "₹35,00,000 / year",
        "risk_appetite": "Aggressive, willing to tolerate high volatility for long term gains.",
        "goals": "Build a corpus for early retirement by 45, and fund children's higher education in 10 years.",
    }

    portfolio_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "tests",
        "Sydney_Barboza_Live_Portfolio_21_02_2026.xlsx",
    )

    if os.path.exists(portfolio_path):
        final_results = run_advisory_pipeline(portfolio_path, mock_user_profile)
        print("\n------------- FINAL EXECUTIVE SUMMARY -------------")
        print(final_results.get("executive_summary", "Error: No summary generated."))
        print("---------------------------------------------------\n")
        print(f"Final Validation Score: {final_results.get('validation_score', 'N/A')}/100")
    else:
        print(f"Error: Could not find portfolio file at {portfolio_path}")
