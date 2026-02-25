from typing import Optional
from dotenv import load_dotenv
import os
from deepagents import create_deep_agent
from langchain_openai import AzureChatOpenAI
from sandbox_tool import RunloopSandboxTool

load_dotenv()

def create_data_analysis_agent(sandbox_tool: Optional[RunloopSandboxTool] = None):
    # Model configuration (using Azure OpenAI gpt-4.1 as per project standard)
    model = AzureChatOpenAI(
        azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME"),
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION"),
        azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT"),
        api_key=os.environ.get("AZURE_OPENAI_API_KEY")
    )

    # Use existing or create new tool
    if sandbox_tool is None:
        sandbox_tool = RunloopSandboxTool()

    # Create the agent
    agent = create_deep_agent(
        model=model,
        tools=[sandbox_tool],
        system_prompt=(
            "You are a Senior Data Analyst with access to a secure Python sandbox via the `runloop_sandbox_execute` tool. "
            "The sandbox home directory is `/home/user/`. All uploaded files are placed here using absolute paths.\n\n"
            "CRITICAL RULES:\n"
            "1. You MUST use the `runloop_sandbox_execute` tool for ANY and ALL operations involving files or code.\n"
            "2. IF a specific file path is provided in the query, TRUST IT. Run `ls [path]` to verify it exists, then proceed.\n"
            "3. ALWAYS use Python for full analysis. Use `python3 -c \"import pandas as pd; ...\"` to read and process data.\n"
            "4. If you cannot find a file, run `ls -R /home/user/` to locate it before reporting failure.\n"
            "5. The tool returns RAW output from the shell. If a command fails, you will see 'Error (Exit Code X): ...'."
        )
    )
    
    return agent

def run_data_analysis(query: str, csv_path: Optional[str] = None):
    """
    Runs the data analysis agent on a query, optionally with a local CSV file 
    that will be 'uploaded' to the sandbox.
    """
    sandbox_tool = RunloopSandboxTool()
    
    # If a csv_path is provided, we simulate the upload by reading it 
    # and creating it in the sandbox.
    if csv_path and os.path.exists(csv_path):
        filename = os.path.basename(csv_path)
        import base64
        with open(csv_path, 'rb') as f:
            content_bytes = f.read()
            encoded_content = base64.b64encode(content_bytes).decode('utf-8')
        
        print(f"Uploading {filename} to sandbox in chunks...")
        # Use an absolute path in the sandbox to ensure visibility
        sandbox_path = f"/home/user/{filename}"
        
        # Use python in sandbox to decode and write the binary file
        # Chunk the base64 string to avoid shell command length limits
        chunk_size = 50000
        for i in range(0, len(encoded_content), chunk_size):
            chunk = encoded_content[i:i+chunk_size]
            mode = "wb" if i == 0 else "ab"
            res = sandbox_tool._run(
                f"python3 -c \"import base64; data = base64.b64decode('{chunk}'); "
                f"open('{sandbox_path}', '{mode}').write(data)\""
            )
        print(f"Upload result: {res}")
        
        # Ensure dependencies are installed (fast check)
        print("Ensuring pandas and openpyxl are installed in sandbox...")
        sandbox_tool._run("python3 -c 'import pandas, openpyxl' || pip install pandas openpyxl")
        
        # Verify and get absolute path
        path_res = sandbox_tool._run(f"readlink -f {sandbox_path}")
        # Tool now returns raw output
        abs_path = path_res.strip().split("\n")[0]
        print(f"File verified at: {abs_path}")
        
        query = f"I have uploaded a file to '{abs_path}'. {query}"

    agent = create_data_analysis_agent(sandbox_tool=sandbox_tool)
    response = agent.invoke({"messages": [("user", query)]})
    return response["messages"][-1].content

if __name__ == "__main__":
    # Example usage
    print("Agent is ready. Import run_data_analysis to use.")
