import os
from dotenv import load_dotenv
from daytona import Daytona
from langchain_daytona import DaytonaSandbox

load_dotenv() # Load variables from .env if present

# The Daytona setup typically requires DAYTONA_API_KEY and DAYTONA_SERVER_URL
# If running locally or via a self-hosted instance, ensure these are set in your .env or environment.

def setup_sandbox():
    try:
        print("Checking Environment Variables...")
        api_key = os.environ.get("DAYTONA_API_KEY")
        if not api_key:
            print("DAYTONA_API_KEY not found!")
        else:
            print(f"DAYTONA_API_KEY found: {api_key[:5]}...{api_key[-5:]}")
            
        print("Initializing Daytona...")
        # create() initializes a new sandbox instance
        sandbox = Daytona().create()
        
        print("Linking Daytona with LangChain Sandbox...")
        backend = DaytonaSandbox(sandbox=sandbox)
        
        print("Executing test command 'echo ready'...")
        result = backend.execute("echo ready")
        
        print(f"Result: {result}")
        
        # In a real scenario, you might want to stop/delete the sandbox after use
        # sandbox.stop()
        
    except Exception as e:
        print(f"Error during Daytona setup: {e}")

if __name__ == "__main__":
    setup_sandbox()
