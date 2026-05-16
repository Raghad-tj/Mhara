from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database_manager import DatabaseManager

# 1. Initialize FastAPI app
app = FastAPI(title="SkillMentor API", version="1.0")

# 2. Configure CORS
# This is crucial! It allows your JavaScript frontend to communicate with this Python server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (for development)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# 3. Initialize the database manager
db = DatabaseManager()

# 4. Define the data structure for receiving session results from JS
class SessionResult(BaseModel):
    student_name: str
    skill_id: str
    final_score: float
    feedback_summary: list[str]

# ==========================================
# API Endpoints
# ==========================================

@app.get("/")
def read_root():
    """Health check endpoint to verify server is running"""
    return {"message": "SkillMentor API is running successfully"}

@app.get("/api/skills")
def get_all_skills():
    """Returns all skills to populate the UI selection menu"""
    skills = db.get_all_skills()
    if not skills:
        raise HTTPException(status_code=404, detail="No skills found in database")
    return skills

@app.get("/api/skills/{skill_id}")
def get_skill(skill_id: str):
    """Returns the specific criteria for a requested skill to configure JS logic"""
    try:
        return db.get_skill(skill_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/session/result")
def save_session_result(result: SessionResult):
    """Receives the final score from the frontend JS after the session ends"""
    
    # In the future, this is where you will connect to Supabase to save the grade
    # For now, we print it to the terminal to verify it works
    print("--------------------------------------------------")
    print(f"Session Completed by: {result.student_name}")
    print(f"Skill: {result.skill_id}")
    print(f"Final Score: {result.final_score}%")
    print(f"Feedback: {result.feedback_summary}")
    print("--------------------------------------------------")
    
    return {
        "status": "success",
        "message": "Result received and saved successfully",
        "data": result.dict()
    }

# ==========================================
# Server Execution
# ==========================================
if __name__ == "__main__":
    import uvicorn
    # Runs the server on localhost port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)