"""
main.py (backend)
-----------------
FastAPI application entry point for the AI Exam Monitoring Platform.

Auth:
  Teacher routes are protected by JWT (see backend/auth_utils.py).
  Student and AI-client routes remain open.

Start the server with:
    uvicorn backend.main:app --reload --app-dir .

Swagger docs: http://127.0.0.1:8000/docs
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.database import engine, Base, SessionLocal
from backend.models import Teacher          # noqa: F401
import backend.models as models             # noqa: F401

from backend.routes import exam, student, violation
from backend.routes import auth as auth_routes
from backend.connection_manager import manager
from backend.auth_utils import hash_password

# ── Create all database tables ───────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Exam Monitoring Platform",
    description=(
        "Backend API for online exam proctoring — manages exams, students, "
        "and violation events. Teacher routes require Bearer JWT authentication."
    ),
    version="2.0.0",
)

# Allow CORS for the React frontend and Python AI client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register route groups ────────────────────────────────────────────────────
app.include_router(auth_routes.router, prefix="/teacher", tags=["Teacher Auth"])
app.include_router(exam.router,        tags=["Exam"])
app.include_router(student.router,     tags=["Student"])
app.include_router(violation.router,   tags=["Violation"])

# Mount evidence directory for static file serving
os.makedirs("evidence", exist_ok=True)
app.mount("/evidence-files", StaticFiles(directory="evidence"), name="evidence")


# ── WebSocket: Live monitoring dashboard (OPEN — used by teacher browser) ────
@app.websocket("/ws/monitor/{exam_code}")
async def ws_monitor(websocket: WebSocket, exam_code: str):
    """
    WebSocket for real-time teacher dashboard monitoring.
    Connect to /ws/monitor/{exam_code} to receive live violation events.

    NOTE: WebSocket connections cannot carry Authorization headers natively,
    so this endpoint remains open by exam_code. The frontend ProtectedTeacherRoute
    ensures only authenticated teachers can reach the page that connects here.
    """
    db = SessionLocal()
    try:
        exam = db.query(models.Exam).filter(models.Exam.exam_code == exam_code).first()
        if not exam:
            await websocket.close(code=1008)
            return
        exam_id = exam.id
    finally:
        db.close()

    await manager.connect(exam_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(exam_id, websocket)
        print(f"[WS] Dashboard disconnected from exam {exam_id} (code {exam_code})")


# ── Startup: seed default teacher with bcrypt-hashed password ────────────────
@app.on_event("startup")
def seed_default_teacher():
    """
    Creates a default teacher record if none exist.
    Password is stored as a bcrypt hash.
    If the existing record has a plain-text password, it is upgraded on startup.
    """
    db = SessionLocal()
    try:
        teacher = db.query(Teacher).filter(Teacher.email == "teacher@exam.com").first()

        if not teacher:
            # Create a fresh seeded teacher with hashed password
            default = Teacher(
                name="Default Teacher",
                email="teacher@exam.com",
                password=hash_password("admin123"),
            )
            db.add(default)
            db.commit()
            print("[INFO] Seeded default teacher — email: teacher@exam.com, password: admin123")

        elif not (
            teacher.password.startswith("$2b$") or teacher.password.startswith("$2a$")
        ):
            # Upgrade legacy plain-text password to bcrypt
            teacher.password = hash_password("admin123")
            db.commit()
            print("[INFO] Upgraded default teacher password to bcrypt hash.")

    finally:
        db.close()


# ── Root health check ────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "message": "AI Exam Monitoring Platform API v2.0 — Teacher auth enabled.",
    }
