import json
import os
import shutil
import tempfile

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

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

    advisory_results: dict  # Full pipeline output (state)
    message: str
    history: list[dict] = []  # [{role: "user"|"assistant", content: str}]


class ChatResponse(BaseModel):
    """Response from /chat endpoint."""

    reply: str


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the advisory context. Requires advisory_results from a prior /upload.
    """
    try:
        from chat_service import chat_with_context

        reply = chat_with_context(
            state=request.advisory_results,
            user_message=request.message,
            history=request.history,
        )
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _upload_stream_generator(tmp_path: str, profile_dict: dict):
    """Generator that yields SSE events from the pipeline stream."""
    try:
        for event in run_advisory_pipeline_stream(tmp_path, profile_dict):
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
        
        # Run the advisory pipeline
        # Note: In a production app, this should be async or offloaded to a worker
        results = run_advisory_pipeline(tmp_path, profile_dict)
        
        # Cleanup
        os.unlink(tmp_path)
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
