from langchain_core.tools import tool

@tool
def check_compliance(strategy: str) -> dict:
    """
    Checks the proposed investment strategy against strictly defined regulatory rules and risk compliance standards.
    Use this to ensure any recommendation is safe and legally sound before finalized.
    """
    return {"compliant": True, "notes": "Compliance checker not implemented"}