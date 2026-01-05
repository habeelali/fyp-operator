import uvicorn
import httpx # For making async HTTP requests
import io
import os
import time
import json
import asyncio
import logging
import csv
import threading
import pandas as pd
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Optional, Dict, Tuple
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from ultralytics import YOLO
from PIL import Image, ImageDraw, ImageFont
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

env = load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set")

MAX_IMAGE_SIZE_MB = 10
MAX_IMAGE_PIXELS = 4096 * 4096
MISSION_LOG_DIR = Path("mission_logs")
MISSION_LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('robot_vision.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

genai.configure(api_key=GEMINI_API_KEY)

models = {}
model_locks = {}
executor = None
brain_lock = asyncio.Lock()

# In-memory storage for the UGV's current state.
# We start in 'idling' by default.
ugv_state = {"state": "idling"}

class SLAMCoordinates(BaseModel):
    x: float
    y: float

    class Config:
        json_schema_extra = {
            "example": {
                "x": 1.23,
                "y": 4.56
            }
        }


class GeminiOutput(BaseModel):
    scene_location: str
    hazard_detected: bool
    hazard_type: Optional[str] = None
    severity: str
    action_plan: str
    reasoning: str
    needs_annotation: bool
    annotation_text: Optional[str] = None

    @validator('severity')
    def validate_severity(cls, v):
        allowed = ['LOW', 'MEDIUM', 'CRITICAL', 'SAFE', 'UNCERTAIN']
        if v not in allowed:
            raise ValueError(f'severity must be one of {allowed}')
        return v


class ProcessingMetrics(BaseModel):
    total_latency_ms: float
    yolo_latency_ms: float
    gemini_latency_ms: float
    image_processing_ms: float
    yolo_failures: List[str] = []


class FrameResponse(BaseModel):
    metrics: ProcessingMetrics
    yolo_detections: List[str]
    ai_intelligence: GeminiOutput
    slam_coordinates: Optional[SLAMCoordinates]
    mission_log_entry_id: str
    annotated_image_path: str


class MissionLogger:
    def __init__(self, mission_id: str):
        self.mission_id = mission_id
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        self.mission_dir = MISSION_LOG_DIR / f"mission_{mission_id}_{timestamp}"
        self.mission_dir.mkdir(exist_ok=True)

        self.images_dir = self.mission_dir / "images"
        self.images_dir.mkdir(exist_ok=True)

        self.log_file = self.mission_dir / "mission_log.jsonl"
        self.csv_file = self.mission_dir / "mission_log.csv"
        self.failure_log = self.mission_dir / "failures.jsonl"

        self.entry_count = 0
        self._init_csv()
        logger.info(f"Mission logger initialized: {self.mission_dir}")

    def _init_csv(self):
        with open(self.csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'entry_id', 'timestamp', 'slam_x', 'slam_y',
                'location', 'detections', 'hazard_detected', 'hazard_type',
                'severity', 'action_plan', 'needs_annotation', 'annotation_text',
                'reasoning', 'yolo_failures', 'image_path'
            ])

    def log_entry(self, timestamp: str, slam_coords: Optional[Dict], location: str,
                  detections: List[str], ai_result: dict, metrics: dict,
                  image_path: str, yolo_failures: List[str]) -> str:
        self.entry_count += 1
        entry_id = f"{self.mission_id}_{self.entry_count:06d}"

        entry = {
            'entry_id': entry_id,
            'timestamp': timestamp,
            'slam_coordinates': slam_coords,
            'location': location,
            'detections': detections,
            'ai_intelligence': ai_result,
            'metrics': metrics,
            'yolo_failures': yolo_failures,
            'image_path': image_path
        }

        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry) + '\n')

        with open(self.csv_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                entry_id,
                timestamp,
                slam_coords.get('x', '') if slam_coords else '',
                slam_coords.get('y', '') if slam_coords else '',
                location,
                '; '.join(detections),
                ai_result.get('hazard_detected', False),
                ai_result.get('hazard_type', ''),
                ai_result.get('severity', ''),
                ai_result.get('action_plan', ''),
                ai_result.get('needs_annotation', False),
                ai_result.get('annotation_text', ''),
                ai_result.get('reasoning', ''),
                '; '.join(yolo_failures) if yolo_failures else '',
                image_path
            ])

        return entry_id

    def log_failure(self, failure_type: str, details: dict):
        failure_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'type': failure_type,
            'details': details
        }
        with open(self.failure_log, 'a', encoding='utf-8') as f:
            f.write(json.dumps(failure_entry) + '\n')
        logger.critical(f"FAILURE LOGGED: {failure_type} - {details}")

    def get_summary(self) -> dict:
        return {
            'mission_id': self.mission_id,
            'total_entries': self.entry_count,
            'mission_dir': str(self.mission_dir),
            'log_file': str(self.log_file),
            'csv_file': str(self.csv_file),
            'images_dir': str(self.images_dir)
        }


mission_logger = None


class RobotBrain:
    def __init__(self, max_context_entries: int = 12):
        self.max_context_entries = max_context_entries
        response_schema = {
            "type": "object",
            "properties": {
                "scene_location": {"type": "string"},
                "hazard_detected": {"type": "boolean"},
                "hazard_type": {"type": "string"},
                "severity": {"type": "string", "enum": ["LOW", "MEDIUM", "CRITICAL", "SAFE", "UNCERTAIN"]},
                "action_plan": {"type": "string"},
                "reasoning": {"type": "string"},
                "needs_annotation": {"type": "boolean"},
                "annotation_text": {"type": "string"}
            },
            "required": [
                "scene_location", "hazard_detected", "severity",
                "action_plan", "reasoning", "needs_annotation"
            ]
        }

        self.location_history: List[Dict[str, str]] = []
        self.current_location: Optional[str] = None
        self.session_start = datetime.now(timezone.utc).isoformat()

        self.model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite",
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": response_schema,
                "temperature": 0.25
            }
        )

        self.chat_session = None
        self._init_session()
        logger.info("Brain initialized successfully")

    def _init_session(self):
        system_context = """You are the AI brain of a disaster response robot exploring unknown environments.

Your mission:
1. Track spatial movement - remember previous locations and understand directional progression
2. Assess safety hazards using visual cues + YOLO detections
3. Provide actionable guidance for rescue operations
4. Determine if locations need map annotations

Annotation guidelines:
- Set needs_annotation=true ONLY for critical findings that require map marking
- annotation_text must be EXTREMELY SHORT (2-4 words): "FIRE SOURCE", "PERSON TRAPPED", "WALL COLLAPSE", "SAFE ZONE", "EXIT BLOCKED"
- Don't annotate routine observations or general descriptions

Examples of proper annotations:
✓ Fire visible + smoke detection → needs_annotation=true, annotation_text="ACTIVE FIRE"
✓ Person lying on ground → needs_annotation=true, annotation_text="PERSON DOWN"
✓ Collapsed doorway → needs_annotation=true, annotation_text="BLOCKED EXIT"
✗ Empty hallway → needs_annotation=false
✗ Minor debris → needs_annotation=false

Spatial awareness:
- Track progression through spaces (corridor start → middle → end)
- Connect locations logically (kitchen → dining room)
- Note returns to previously visited areas
- Identify dead ends, junctions, room transitions

Severity classification:
- CRITICAL: Active fire, trapped persons, immediate collapse risk, toxic gas, blocked emergency exits
- MEDIUM: Smoke without flames, unstable structures, moderate debris requiring careful navigation
- LOW: Minor debris, clutter, small obstacles not blocking movement
- SAFE: Clear areas with no visible hazards
- UNCERTAIN: Poor visibility, inconclusive evidence - requires human verification

**Important**: If visual clarity is poor or no clear hazards are visible, use UNCERTAIN rather than defaulting to SAFE. Reserve SAFE only for clearly observable safe conditions.

Be concise, precise, and mission-focused."""

        self.chat_session = self.model.start_chat(
            history=[{
                "role": "user",
                "parts": [system_context]
            }, {
                "role": "model",
                "parts": ["Understood. I will maintain spatial awareness, assess hazards using the 5-tier severity scale (CRITICAL/MEDIUM/LOW/SAFE/UNCERTAIN), and provide ultra-concise annotations (2-4 words) only for critical map-worthy findings. Ready for first frame."]
            }]
        )

    def _build_context(self) -> str:
        context_parts = [f"Mission started: {self.session_start}"]

        if self.current_location:
            context_parts.append(f"Current location: {self.current_location}")

        if self.location_history:
            recent = self.location_history[-self.max_context_entries:]
            history_str = " → ".join([f"{e['location']}" for e in recent])
            context_parts.append(f"Movement history: {history_str}")

        return "\n".join(context_parts)

    @retry(
        retry=retry_if_exception_type((Exception)),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        stop=stop_after_attempt(3),
        reraise=True
    )
    async def analyze(self, pil_image: Image.Image, metadata: dict) -> dict:
        context = self._build_context()

        prompt = f"""**Context:**
{context}

**Current Frame Data:**
Timestamp: {metadata['timestamp']}
YOLO Detections: {', '.join(metadata['detections']) if metadata['detections'] else 'None'}

**Analysis Required:**
1. WHERE is the robot now? (Be specific but concise - describe visual landmarks)
2. Has the robot moved from previous location? Note progression or revisit
3. Safety assessment based on image + detections:
   - Use UNCERTAIN if visibility is poor or evidence is inconclusive
   - Use SAFE only if clearly visible conditions are safe
   - Use CRITICAL/MEDIUM/LOW based on clear hazard evidence
4. Does this location need a map annotation? If yes, provide 2-4 word annotation

Provide structured JSON response."""

        try:
            response = await asyncio.to_thread(
                self.chat_session.send_message,
                [prompt, pil_image]
            )
            result = json.loads(response.text)

            new_location = result.get("scene_location", "Unknown")
            if new_location and new_location != self.current_location:
                self.location_history.append({
                    'timestamp': metadata['timestamp'],
                    'location': new_location
                })
                self.current_location = new_location

                if len(self.location_history) > 50:
                    self.location_history = self.location_history[-50:]

            logger.info(f"AI analysis complete: location={new_location}, hazard={result.get('hazard_detected')}, severity={result.get('severity')}")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response: {e}")
            if mission_logger:
                mission_logger.log_failure("gemini_parse_error", {"error": str(e)})
            raise HTTPException(status_code=500, detail="AI response parsing failed")
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            if mission_logger:
                mission_logger.log_failure("gemini_api_error", {"error": str(e)})
            if "429" in str(e) or "quota" in str(e).lower():
                logger.warning("Rate limit hit, backing off...")
            raise

    def reset_session(self):
        logger.info("Resetting conversation session")
        self._init_session()
        self.location_history.clear()
        self.current_location = None

    def get_memory_state(self) -> dict:
        return {
            'current_location': self.current_location,
            'location_history': self.location_history,
            'history_count': len(self.location_history),
            'session_start': self.session_start
        }


brain = RobotBrain()

def run_yolo_inference_threadsafe(
    model: YOLO,
    lock: threading.Lock,
    image: Image.Image,
    classes: Optional[List[int]] = None,
    model_name: str = "unknown"
) -> Tuple[List[str], List[Dict]]:
    try:
        with lock:
            results = model(image, classes=classes, verbose=False)[0]

        detections = []
        boxes_data = []

        for box in results.boxes:
            class_id = int(box.cls[0])
            class_name = model.names[class_id]
            confidence = float(box.conf[0])
            xyxy = box.xyxy[0].cpu().numpy().tolist()

            detections.append(class_name)
            boxes_data.append({
                'class': class_name,
                'confidence': confidence,
                'bbox': xyxy,
                'model': model_name
            })

        return detections, boxes_data
    except Exception as e:
        logger.error(f"YOLO inference failed for {model_name}: {e}")
        if mission_logger:
            mission_logger.log_failure("yolo_inference_error", {
                "model": model_name,
                "error": str(e)
            })
        return [], []

def draw_detections_on_image(image: Image.Image, all_boxes: List[Dict], entry_id: str) -> Image.Image:
    draw = ImageDraw.Draw(image)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except:
        font = ImageFont.load_default()

    color_map = {
        'fire': (255, 0, 0),
        'extinguisher': (0, 255, 0),
        'human': (0, 0, 255)
    }

    for box_data in all_boxes:
        bbox = box_data['bbox']
        label = f"{box_data['class']} {box_data['confidence']:.2f}"
        color = color_map.get(box_data['model'], (255, 255, 0))

        draw.rectangle(bbox, outline=color, width=3)

        text_bbox = draw.textbbox((bbox[0], bbox[1] - 20), label, font=font)
        draw.rectangle(text_bbox, fill=color)
        draw.text((bbox[0], bbox[1] - 20), label, fill=(255, 255, 255), font=font)

    watermark = f"Entry: {entry_id}"
    watermark_bbox = draw.textbbox((10, 10), watermark, font=font)
    draw.rectangle(watermark_bbox, fill=(0, 0, 0, 128))
    draw.text((10, 10), watermark, fill=(255, 255, 255), font=font)

    return image

@asynccontextmanager
async def lifespan(app: FastAPI):
    global models, model_locks, executor, mission_logger, brain

    logger.info("Starting application lifespan...")

    executor = ThreadPoolExecutor(max_workers=6)
    logger.info("Thread pool executor initialized")

    try:
        logger.info("Loading YOLO models...")
        loop = asyncio.get_event_loop()

        models['fire'] = await loop.run_in_executor(executor, YOLO, "models/fire_smoke.pt")
        model_locks['fire'] = threading.Lock()

        models['extinguisher'] = await loop.run_in_executor(executor, YOLO, "models/extinguisher.pt")
        model_locks['extinguisher'] = threading.Lock()

        models['human'] = await loop.run_in_executor(executor, YOLO, "models/human.pt")
        model_locks['human'] = threading.Lock()

        logger.info("YOLO models loaded successfully")
    except Exception as e:
        logger.critical(f"Failed to load models: {e}")
        raise RuntimeError(f"Model loading failed: {e}")

    mission_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    mission_logger = MissionLogger(mission_id)

    logger.info("Startup sequence completed")

    yield

    logger.info("Shutting down application...")
    if mission_logger:
        summary = mission_logger.get_summary()
        logger.info(f"Mission complete: {summary}")

    if executor:
        executor.shutdown(wait=True)
        logger.info("Thread pool executor shut down")


app = FastAPI(
    title="Disaster Response Robot Vision API",
    version="3.0.0",
    lifespan=lifespan
)


allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)



@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "models_loaded": len(models) == 3,
        "mission_active": mission_logger is not None,
        "gemini_configured": bool(GEMINI_API_KEY),
        "concurrent_requests_supported": True
    }



@app.get("/memory")
async def get_memory():
    """Debug endpoint to view current AI memory state"""
    async with brain_lock:
        return brain.get_memory_state()



@app.post("/reset-session")
async def reset_session():
    """Reset AI conversation session and clear memory"""
    async with brain_lock:
        brain.reset_session()
    logger.info("Session reset requested")
    return {"status": "session_reset", "message": "Conversation memory cleared"}



@app.get("/mission-summary")
async def get_mission_summary():
    """Get current mission statistics"""
    if not mission_logger:
        raise HTTPException(status_code=503, detail="Mission logger not initialized")
    return mission_logger.get_summary()

@app.get("/api/missions")
async def get_missions():
    """Scans and returns a list of all mission directories."""
    missions = []
    if not os.path.exists(MISSION_LOG_DIR):
        return {"missions": []}

    for mission_folder in os.listdir(MISSION_LOG_DIR):
        if os.path.isdir(MISSION_LOG_DIR / mission_folder) and mission_folder.startswith("mission_"):
            parts = mission_folder.split('_')
            if len(parts) >= 3:
                mission_id = parts[1]
                timestamp_str = parts[2]

                log_file_path = MISSION_LOG_DIR / mission_folder / "mission_log.csv"
                entry_count = 0
                if os.path.exists(log_file_path):
                    with open(log_file_path, 'r') as f:
                        entry_count = max(0, sum(1 for row in f) - 1)

                missions.append({
                    "mission_id": mission_id,
                    "directory_name": mission_folder,
                    "created_at": timestamp_str,
                    "entry_count": entry_count,
                })

    sorted_missions = sorted(missions, key=lambda m: m['created_at'], reverse=True)
    return {"missions": sorted_missions}

@app.get("/api/missions/{mission_dir_name}/logs")
async def get_mission_logs(mission_dir_name: str):
    """Reads and returns the log entries for a specific mission from its CSV file."""
    log_file_path = MISSION_LOG_DIR / mission_dir_name / "mission_log.csv"

    if not os.path.exists(log_file_path):
        raise HTTPException(status_code=404, detail=f"Mission '{mission_dir_name}' not found or has no logs.")

    try:
        df = pd.read_csv(log_file_path)
        df.fillna('', inplace=True)
        log_entries = df.to_dict(orient='records')

        return {
            "mission_id": mission_dir_name,
            "total_entries": len(log_entries),
            "entries": log_entries
        }
    except Exception as e:
        logger.error(f"Failed to read or parse log file {log_file_path}: {e}")
        raise HTTPException(status_code=500, detail="Error reading mission log file.")


@app.post("/process-frame", response_model=FrameResponse)
async def process_frame(
    file: UploadFile = File(...),
    slam_coordinates: Optional[str] = Body(None, embed=True)
):
    """
    Process incoming frame with YOLO + Gemini analysis.
    Supports concurrent requests - multiple frames can be processed simultaneously.
    
    Parameters:
    - file: Image file to process
    - slam_coordinates: JSON string with SLAM coordinates {"x": 1.23, "y": 4.56}
    """
    if not models or not mission_logger:
        raise HTTPException(status_code=503, detail="Service not ready")

    api_call_timestamp = datetime.now(timezone.utc).isoformat()
    start_time = time.time()
    timings = {}
    yolo_failures = []

    parsed_slam_coords = None
    if slam_coordinates:
        try:
            slam_data = json.loads(slam_coordinates)
            parsed_slam_coords = SLAMCoordinates(**slam_data)
            logger.info(f"SLAM coordinates: x={parsed_slam_coords.x}, y={parsed_slam_coords.y}")
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Invalid SLAM coordinates: {e}")

    img_start = time.time()
    try:
        contents = await file.read()

        size_mb = len(contents) / (1024 * 1024)
        if size_mb > MAX_IMAGE_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"Image too large: {size_mb:.2f}MB (max {MAX_IMAGE_SIZE_MB}MB)"
            )

        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

        if pil_image.width * pil_image.height > MAX_IMAGE_PIXELS:
            raise HTTPException(status_code=413, detail="Image resolution too high")

        timings['image_processing'] = (time.time() - img_start) * 1000

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image processing error: {e}")
        mission_logger.log_failure("image_processing_error", {"error": str(e)})
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    yolo_start = time.time()
    try:
        loop = asyncio.get_event_loop()

        fire_task = loop.run_in_executor(
            executor,
            run_yolo_inference_threadsafe,
            models['fire'], model_locks['fire'], pil_image, None, 'fire'
        )
        ext_task = loop.run_in_executor(
            executor,
            run_yolo_inference_threadsafe,
            models['extinguisher'], model_locks['extinguisher'], pil_image, None, 'extinguisher'
        )
        human_task = loop.run_in_executor(
            executor,
            run_yolo_inference_threadsafe,
            models['human'], model_locks['human'], pil_image, [0], 'human'
        )

        results = await asyncio.gather(fire_task, ext_task, human_task, return_exceptions=True)

        all_detections = []
        all_boxes = []

        for idx, (model_name, result) in enumerate(zip(['fire', 'extinguisher', 'human'], results)):
            if isinstance(result, Exception):
                logger.error(f"YOLO {model_name} failed: {result}")
                yolo_failures.append(model_name)
            else:
                dets, boxes = result
                all_detections.extend(dets)
                all_boxes.extend(boxes)

        unique_detections = list(set(all_detections))
        timings['yolo'] = (time.time() - yolo_start) * 1000

        if len(yolo_failures) == 3:
            logger.critical("ALL YOLO MODELS FAILED - CRITICAL SYSTEM ERROR")
            mission_logger.log_failure("complete_yolo_failure", {
                "timestamp": api_call_timestamp,
                "failures": yolo_failures
            })

        logger.info(f"YOLO detections: {unique_detections}, failures: {yolo_failures}")

    except Exception as e:
        logger.error(f"YOLO processing error: {e}")
        mission_logger.log_failure("yolo_processing_error", {"error": str(e)})
        unique_detections = []
        all_boxes = []
        yolo_failures = ['fire', 'extinguisher', 'human']
        timings['yolo'] = (time.time() - yolo_start) * 1000

    gemini_start = time.time()
    metadata = {
        "timestamp": api_call_timestamp,
        "detections": unique_detections
    }

    try:
        async with brain_lock:
            ai_result = await brain.analyze(pil_image, metadata)
        timings['gemini'] = (time.time() - gemini_start) * 1000
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gemini analysis failed: {e}")
        mission_logger.log_failure("gemini_analysis_error", {
            "timestamp": api_call_timestamp,
            "error": str(e)
        })
        ai_result = {
            "scene_location": "Unknown - AI Unavailable",
            "hazard_detected": False,
            "hazard_type": None,
            "severity": "UNCERTAIN",
            "action_plan": "AI analysis unavailable - manual assessment REQUIRED",
            "reasoning": f"Gemini API error: {str(e)}",
            "needs_annotation": True,
            "annotation_text": "AI FAILURE"
        }
        timings['gemini'] = (time.time() - gemini_start) * 1000

    try:
        entry_id = f"{mission_logger.mission_id}_{mission_logger.entry_count + 1:06d}"

        annotated_image = pil_image.copy()
        if all_boxes:
            annotated_image = draw_detections_on_image(annotated_image, all_boxes, entry_id)

        image_filename = f"{entry_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.jpg"
        image_path = mission_logger.images_dir / image_filename
        annotated_image.save(image_path, quality=95)

        relative_image_path = str(image_path.relative_to(MISSION_LOG_DIR))
        logger.info(f"Annotated image saved: {image_path}")

    except Exception as e:
        logger.error(f"Failed to save annotated image: {e}")
        mission_logger.log_failure("image_save_error", {"error": str(e)})
        relative_image_path = "ERROR_SAVING_IMAGE"

    timings['total'] = (time.time() - start_time) * 1000

    slam_coords_dict = None
    if parsed_slam_coords:
        slam_coords_dict = {
            'x': parsed_slam_coords.x,
            'y': parsed_slam_coords.y
        }

    entry_id = mission_logger.log_entry(
        timestamp=api_call_timestamp,
        slam_coords=slam_coords_dict,
        location=ai_result.get('scene_location', 'Unknown'),
        detections=unique_detections,
        ai_result=ai_result,
        metrics=timings,
        image_path=relative_image_path,
        yolo_failures=yolo_failures
    )

    logger.info(f"Frame processed: {entry_id} | {timings['total']:.2f}ms | SLAM: {slam_coords_dict}")

    metrics = ProcessingMetrics(
        total_latency_ms=round(timings['total'], 2),
        yolo_latency_ms=round(timings['yolo'], 2),
        gemini_latency_ms=round(timings['gemini'], 2),
        image_processing_ms=round(timings['image_processing'], 2),
        yolo_failures=yolo_failures
    )

    response = FrameResponse(
        metrics=metrics,
        yolo_detections=unique_detections,
        ai_intelligence=GeminiOutput(**ai_result),
        slam_coordinates=parsed_slam_coords,
        mission_log_entry_id=entry_id,
        annotated_image_path=relative_image_path
    )

    return response

@app.get("/api/ugv-state")
async def get_ugv_state():
    """Returns the current operational state of the UGV."""
    return ugv_state

class UGVStateUpdate(BaseModel):
    state: str
    
    @validator('state')
    def validate_state(cls, v):
        allowed = ['idling', 'tele-op', 'autonomous']
        if v not in allowed:
            raise ValueError(f'state must be one of {allowed}')
        return v

@app.post("/api/ugv-state")
async def set_ugv_state(state_update: UGVStateUpdate):
    """Sets the operational state of the UGV."""
    global ugv_state
    ugv_state["state"] = state_update.state
    logger.info(f"UGV state changed to: {ugv_state['state']}")
    return {"status": "success", "new_state": ugv_state['state']}

@app.get("/api/system-health")
async def get_system_health():
    """Aggregates and returns the health status of all system components."""
    
    # --- Check ESP32 Power Monitor ---
    esp32_status = {"status": "offline", "latency_ms": None}
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            start_time = time.time()
            response = await client.get("http://192.168.100.99/powerstats")
            latency = (time.time() - start_time) * 1000
            if response.status_code == 200:
                esp32_status = {"status": "online", "latency_ms": round(latency)}
    except httpx.RequestError:
        # This is expected if the ESP32 is not connected
        pass

    # --- Check Gemini AI ---
    gemini_status = {
        "status": "configured" if GEMINI_API_KEY else "unconfigured",
        "model": "gemini-2.5-flash-lite"
    }

    # --- Check ROS2 Bridge (placeholder) ---
    # In a real scenario, we would try to connect to the WebSocket.
    # For now, we will simulate it.
    ros2_bridge_status = {"status": "offline", "nodes": 0}


    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lte": {"status": "online", "signal": 85}, # This is still mock data for now
        "mesh": ros2_bridge_status,
        "telemetry": esp32_status,
        "gemini_ai": gemini_status
    }

# This mounts the 'mission_logs' directory so data can be served directly.
app.mount("/api/mission_data", StaticFiles(directory=str(MISSION_LOG_DIR)), name="mission_data")

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )