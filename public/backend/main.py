import uvicorn
import io
import time
import json
import random
import asyncio
from typing import List
from datetime import datetime
from contextlib import asynccontextmanager

# Key Libraries
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ultralytics import YOLO
from PIL import Image
import google.generativeai as genai

# --- CONFIGURATION ---
GEMINI_API_KEY = "AIzaSyCfxZLXHeEKOQpzSgcXp34AHuoDBhek3BM" 
YOLO_MODEL_PATH = "final.pt"           
GEMINI_MODEL_NAME = "gemini-2.5-flash"

# --- DATA MODELS ---
class RobotCoordinates(BaseModel):
    x: float
    y: float
    z: float

class YoloDetection(BaseModel):
    object_class: str
    confidence: float
    bbox: List[float]

class GeminiAnalysis(BaseModel):
    hazard_detected: bool
    severity: str = Field(..., description="LOW, MEDIUM, or CRITICAL")
    action_plan: str
    reasoning: str

class FullApiResponse(BaseModel):
    timestamp: str
    processing_time_ms: float
    robot_position: RobotCoordinates
    detections: List[YoloDetection]
    ai_analysis: GeminiAnalysis

# --- GLOBAL SERVICES ---
services = {}

# --- LIFESPAN MANAGER (Loads TWO YOLO Models now) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. STARTUP LOGIC
    print(" Loading Custom Fire/Smoke Model...")
    services["fire_model"] = YOLO(YOLO_MODEL_PATH)
    
    print(" Loading Standard Human Detection Model...")
    services["human_model"] = YOLO("yolov8n.pt") 
    
    print(f" Initializing Gemini AI ({GEMINI_MODEL_NAME})...")
    genai.configure(api_key=GEMINI_API_KEY)
    
    services["ai"] = genai.GenerativeModel(
        model_name=GEMINI_MODEL_NAME, 
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema={
                "type": "object",
                "properties": {
                    "hazard_detected": {"type": "boolean"},
                    "severity": {"type": "string", "enum": ["LOW", "MEDIUM", "CRITICAL", "SAFE"]},
                    "action_plan": {"type": "string"},
                    "reasoning": {"type": "string"}
                },
                "required": ["hazard_detected", "severity", "action_plan", "reasoning"]
            }
        )
    )
    
    yield # Server runs here
    
    # 2. SHUTDOWN LOGIC
    print(" Shutting down services...")
    services.clear()

# --- APP INITIALIZATION ---
app = FastAPI(title="FYP BACKEND", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER FUNCTIONS ---
def get_fake_coordinates():
    return RobotCoordinates(
        x=round(random.uniform(0, 50), 2),
        y=round(random.uniform(0, 50), 2),
        z=0.0
    )

# --- ENDPOINT ---
@app.post("/analyze", response_model=FullApiResponse)
async def analyze_endpoint(file: UploadFile = File(...)):
    start_time = time.time()
    
    # 1. Read Image
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Image")

    coords = get_fake_coordinates()

    detections = []
    
    # A. Run Fire/Smoke Model
    if "fire_model" in services:
        fire_results = services["fire_model"](image, verbose=False)[0]
        for box in fire_results.boxes:
            detections.append(YoloDetection(
                object_class=services["fire_model"].names[int(box.cls[0])], # 'fire' or 'smoke'
                confidence=round(float(box.conf[0]), 2),
                bbox=box.xyxy[0].tolist()
            ))

    if "human_model" in services:
        human_results = services["human_model"](image, classes=[0], verbose=False)[0]
        for box in human_results.boxes:
            detections.append(YoloDetection(
                object_class="human", 
                confidence=round(float(box.conf[0]), 2),
                bbox=box.xyxy[0].tolist()
            ))

   
    ai_analysis = None
    
    if not detections:
        ai_analysis = GeminiAnalysis(
            hazard_detected=False,
            severity="SAFE",
            action_plan="Continue patrol.",
            reasoning="No visual hazards or humans detected."
        )
    else:
        det_summary = ", ".join([d.object_class for d in detections])
        prompt = f"""
        Robot Location: {coords.model_dump()} 
        Visual Detection: {det_summary}
        
        Analyze the image for hazards.
        IMPORTANT: If a 'human' is detected near 'fire' or 'smoke', this is a CRITICAL LIFE SAFETY EVENT.
        """
        
        try:
            response = await asyncio.to_thread(
                services["ai"].generate_content, [prompt, image]
            )
            data = json.loads(response.text)
            ai_analysis = GeminiAnalysis(**data)
        except Exception as e:
            print(f" Gemini Error: {e}")
            ai_analysis = GeminiAnalysis(
                hazard_detected=True, 
                severity="MEDIUM", 
                action_plan="MANUAL CHECK REQUIRED", 
                reasoning=f"AI connection failed: {str(e)}"
            )

    # 5. Return Response
    return FullApiResponse(
        timestamp=datetime.now().isoformat(),
        processing_time_ms=round((time.time() - start_time) * 1000, 2),
        robot_position=coords,
        detections=detections,
        ai_analysis=ai_analysis
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)