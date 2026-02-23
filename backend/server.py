import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json

# Import the core pipeline
from main import run_advisory_pipeline

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
