import json
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from main import run_advisory_pipeline, run_advisory_pipeline_stream

app = FastAPI(title="Portfolio Advisory Deep Agent API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserProfile(BaseModel):
    age: str
    income: str
    risk_appetite: str
    goals: str


class ChatRequest(BaseModel):
    """Request body for /chat endpoint."""

    run_id: str
    message: str
    history: list[dict] = Field(default_factory=list)  # [{role: "user"|"assistant", content: str}]


class ChatResponse(BaseModel):
    """Response from /chat endpoint."""

    reply: str
    confidence: str
    sources: list[str]
    suggested_actions: list[str]


RUNS: dict[str, dict] = {}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the advisory context. Requires advisory_results from a prior /upload.
    """
    try:
        run_payload = RUNS.get(request.run_id)
        if not run_payload:
            raise HTTPException(status_code=404, detail="Run not found")

        from chat_service import chat_with_context_response

        response_payload = chat_with_context_response(
            state=run_payload["results"],
            user_message=request.message,
            history=request.history,
        )
        return ChatResponse(**response_payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _upload_stream_generator(tmp_path: str, profile_dict: dict):
    """Generator that yields SSE events from the pipeline stream."""
    try:
        run_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        final_results = None
        for event in run_advisory_pipeline_stream(tmp_path, profile_dict):
            if event.get("event") == "complete":
                final_results = event.get("results", {})
                run_payload = {
                    "run_id": run_id,
                    "created_at": created_at,
                    "role_profile": {
                        "role": profile_dict.get("role", "Investor"),
                        "objective": profile_dict.get("objective", "general_planning"),
                        "liquidity_horizon": profile_dict.get("liquidity_horizon"),
                        "tax_context": profile_dict.get("tax_context"),
                    },
                    "results": final_results,
                }
                RUNS[run_id] = run_payload
                yield f"data: {json.dumps({'event': 'complete', **run_payload})}\n\n"
            else:
                yield f"data: {json.dumps(event)}\n\n"
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/upload/stream")
async def upload_portfolio_stream(
    file: UploadFile = File(...),
    user_profile: str = Form(...),
):
    """
    Upload portfolio and stream progress events via Server-Sent Events.
    Events: phase (extract/graph), node (agent name), complete (final results).
    """
    try:
        profile_dict = json.loads(user_profile)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        return StreamingResponse(
            _upload_stream_generator(tmp_path, profile_dict),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid user_profile JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_portfolio(
    file: UploadFile = File(...),
    user_profile: str = Form(...)  # Expecting a JSON string from form data
):
    try:
        # Parse user profile
        profile_dict = json.loads(user_profile)
        
        # Save uploaded file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        results = run_advisory_pipeline(tmp_path, profile_dict)
        run_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        run_payload = {
            "run_id": run_id,
            "created_at": created_at,
            "role_profile": {
                "role": profile_dict.get("role", "Investor"),
                "objective": profile_dict.get("objective", "general_planning"),
                "liquidity_horizon": profile_dict.get("liquidity_horizon"),
                "tax_context": profile_dict.get("tax_context"),
            },
            "results": results,
        }
        RUNS[run_id] = run_payload
        
        # Cleanup
        os.unlink(tmp_path)
        
        return run_payload
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analysis/{run_id}")
async def get_analysis(run_id: str):
    run_payload = RUNS.get(run_id)
    if not run_payload:
        raise HTTPException(status_code=404, detail="Run not found")
    return run_payload

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
