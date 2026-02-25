from typing import Optional, Type, Dict, Any
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from runloop_api_client import RunloopSDK
from langchain_runloop import RunloopSandbox
import os

class SandboxExecuteSchema(BaseModel):
    command: str = Field(description="The shell command to execute in the Runloop sandbox.")

class RunloopSandboxTool(BaseTool):
    name: str = "runloop_sandbox_execute"
    description: str = "Executes a shell command in a secure Runloop sandbox (devbox). Use this for data analysis, running Python scripts, or specialized shell tasks."
    args_schema: Type[BaseModel] = SandboxExecuteSchema
    
    _client: Optional[RunloopSDK] = None
    _devbox: Optional[Any] = None
    _backend: Optional[RunloopSandbox] = None

    def _get_backend(self) -> RunloopSandbox:
        if self._backend is None:
            api_key = os.environ.get("RUNLOOP_API_KEY")
            if not api_key:
                raise ValueError("RUNLOOP_API_KEY not found in environment!")
            
            if self._client is None:
                self._client = RunloopSDK(bearer_token=api_key)
            
            if self._devbox is None:
                # Check for existing devbox ID in environment
                existing_id = os.environ.get("RUNLOOP_DEVBOX_ID")
                if existing_id:
                    try:
                        print(f"Attempting to attach to existing devbox {existing_id}...")
                        self._devbox = self._client.devbox.from_id(existing_id)
                        # Test if it's running by a simple call
                        # If it's shutdown, this might not fail until execute,
                        # but some SDKs have a status check. 
                        # We'll handle it during execution if needed.
                    except Exception as e:
                        print(f"Failed to attach to {existing_id}: {e}. Creating new devbox...")
                        self._devbox = self._client.devbox.create()
                else:
                    # Create a new devbox if no ID provided
                    print("Creating a new Runloop devbox...")
                    self._devbox = self._client.devbox.create()
            
            self._backend = RunloopSandbox(devbox=self._devbox)
        return self._backend

    def _run(self, command: str) -> str:
        try:
            # Force everything to run in home directory for consistency
            if not command.startswith("cd "):
                command = f"cd /home/user && {command}"
                
            backend = self._get_backend()
            result = backend.execute(command)
            # Return simpler output to avoid agent confusion
            if result.exit_code != 0:
                return f"Error (Exit Code {result.exit_code}): {result.output}"
            return result.output
        except Exception as e:
            if "shutdown" in str(e).lower() or "non-running" in str(e).lower():
                print("Devbox was shutdown. Resetting and creating a fresh one...")
                self._devbox = None
                self._backend = None
                # Recursive call with fresh state
                return self._run(command)
            return f"Error executing command in Runloop sandbox: {str(e)}"

    def close(self):
        """Clean up the devbox instance."""
        if self._devbox and self._client:
            # Cleanup logic if Runloop supports it
            # self._client.devbox.delete(self._devbox.id)
            pass
