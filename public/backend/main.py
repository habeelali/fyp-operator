import uvicorn
import io
import time
import json
import asyncio
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ultralytics import YOLO
from PIL import Image
import google.generativeai as genai

# --- CONFIGURATION ---
GEMINI_API_KEY = "................" 
genai.configure(api_key=GEMINI_API_KEY)

# --- MODELS ---
# 1. Fire/Smoke detection 
# 2. Fire Extinguisher detection 
# 3. Built-in Human detection (yolov8n.pt)
try:
    fire_model = YOLO("smokefire.pt")
    ext_model = YOLO("bestfireextinguisher.pt")
    human_model = YOLO("yolov8n.pt")
except Exception as e:
    print(f"Error loading models: {e}. Check if .pt files are in this folder.")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA STRUCTURES ---
class GeminiOutput(BaseModel):
    scene_location: str 
    hazard_detected: bool
    hazard_type: Optional[str]
    severity: str # LOW, MEDIUM, CRITICAL
    action_plan: str
    reasoning: str

# --- AI BRAIN ---
class RobotBrain:
    def __init__(self):
        response_schema = {
            "type": "object",
            "properties": {
                "scene_location": {"type": "string"},  
                "hazard_detected": {"type": "boolean"},
                "hazard_type": {"type": "string"},  
                "severity": {"type": "string", "enum": ["LOW", "MEDIUM", "CRITICAL", "SAFE"]},
                "action_plan": {"type": "string"},
                "reasoning": {"type": "string"}
            },
            "required": ["scene_location", "hazard_detected", "severity", "action_plan", "reasoning"]
        }
        
        
        self.location_history = []
        self.current_location = None
        
        self.model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": response_schema
            }
        )
        # Context history for the robot
        self.chat_session = self.model.start_chat(history=[])

    async def analyze(self, pil_image, metadata: dict):
        location_context = ""
        if self.location_history:
            recent_locations = self.location_history[-5:]  
            location_context = f"\nRecent location history: {', '.join(recent_locations)}"
        if self.current_location:
            location_context += f"\nPrevious location: {self.current_location}"
        
        prompt = f"""
        Current Timestamp: {metadata['timestamp']}
        YOLO Detections: {metadata['detections']}
        {location_context}
        
        Analyze the image to determine:
        1. Scene Location: Describe WHERE the robot is now in ONE word or short phrase (e.g., "Kitchen", "Hallway", "Office Room", "Storage Area"). Use visual clues from the image.
        2. Safety Assessment: Based on detections and visual analysis, assess hazards and provide action plan.
        
        Remember past locations and track movement. If location has changed, note it in reasoning.
        """
        response = await asyncio.to_thread(self.chat_session.send_message, [prompt, pil_image])
        result = json.loads(response.text)
        
        # Update location memory (always track with timestamp)
        new_location = result.get("scene_location", "Unknown")
        if new_location:
            self.current_location = new_location
            # Always add to history with timestamp for complete memory
            self.location_history.append(f"{metadata['timestamp']}: {new_location}")
            # Keep only last 20 entries to avoid memory bloat
            if len(self.location_history) > 20:
                self.location_history = self.location_history[-20:]
        
        return result

brain = RobotBrain()

# --- DEBUG ENDPOINT: View Memory State ---
@app.get("/memory")
async def get_memory():
    """Debug endpoint to view current memory state"""
    return {
        "current_location": brain.current_location,
        "location_history": brain.location_history,
        "history_count": len(brain.location_history)
    }

# --- MAIN ENDPOINT ---
@app.post("/process-frame")
async def process_frame(file: UploadFile = File(...)):
    start_time = time.time()
    
    # 1. Process Image
    try:
        contents = await file.read()
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # 2. Local YOLO Inference
    detections = []
    
    # Run fire/smoke model
    res_fire = fire_model(pil_image, verbose=False)[0]
    # Run extinguisher model
    res_ext = ext_model(pil_image, verbose=False)[0]
    # Run human detection (Class 0 in COCO)
    res_human = human_model(pil_image, classes=[0], verbose=False)[0]

    # Process fire/smoke detections
    for box in res_fire.boxes:
        detections.append(fire_model.names[int(box.cls[0])])
    # Process extinguisher detections
    for box in res_ext.boxes:
        detections.append(ext_model.names[int(box.cls[0])])
    # Process human detections
    for box in res_human.boxes:
        detections.append(human_model.names[int(box.cls[0])])

    # 3. Gemini Reasoning 
    metadata = {
        "timestamp": datetime.now().isoformat(),
        "detections": list(set(detections))
    }
    
    try:
        ai_intelligence = await brain.analyze(pil_image, metadata)
    except Exception as e:
        ai_intelligence = {"error": f"AI Brain failed: {str(e)}", "severity": "MEDIUM"}

    return {
        "latency_ms": round((time.time() - start_time) * 1000, 2),
        "yolo_results": detections,
        "ai_intelligence": ai_intelligence
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)