"""
violation.py
------------
API routes for receiving and retrieving violation events.

POST /send_event      — AI monitoring client sends violation (OPEN, no auth)
POST /upload_evidence — AI monitoring client uploads screenshot (OPEN, no auth)
GET  /evidence/{exam_code}/{student_id} — Teacher views evidence (JWT required)

Performance optimizations:
  - Chunked file reads to avoid loading entire images into memory
  - File size cap (2 MB) to prevent oversized uploads
  - Reduced redundant DB lookups
"""

import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Student, Exam, Violation, Evidence
from backend.schemas import ViolationSendRequest, ViolationOut
from backend.connection_manager import manager
from backend.auth_utils import get_current_teacher

router = APIRouter()

# Ensure the evidence storage directory exists
EVIDENCE_DIR = "evidence"
os.makedirs(EVIDENCE_DIR, exist_ok=True)

# Maximum evidence image size (2 MB)
MAX_EVIDENCE_SIZE = 2 * 1024 * 1024
# Chunk size for streaming file writes (64 KB)
CHUNK_SIZE = 64 * 1024


# ── AI Client: Send Violation Event (OPEN — no auth) ─────────────────────────
@router.post("/send_event", response_model=ViolationOut)
async def send_event(req: ViolationSendRequest, db: Session = Depends(get_db)):
    """
    AI monitoring client sends a violation event.
    Validates student+exam exist, persists, and broadcasts via WebSocket.
    """
    # Single query to validate both student and exam exist
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    exam = db.query(Exam).filter(Exam.id == req.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    violation = Violation(
        student_id=req.student_id,
        exam_id=req.exam_id,
        event_type=req.event_type,
        suspicion_score=req.suspicion_score,
    )
    db.add(violation)
    db.commit()
    db.refresh(violation)

    ws_message = {
        "student_id": violation.student_id,
        "event_type": violation.event_type,
        "timestamp": violation.timestamp.isoformat() if violation.timestamp else None,
        "suspicion_score": violation.suspicion_score,
    }
    await manager.broadcast(exam_id=req.exam_id, message=ws_message)

    return violation


# ── AI Client: Upload Evidence Screenshot (OPEN — no auth) ───────────────────
@router.post("/upload_evidence")
async def upload_evidence(
    student_id: int = Form(...),
    exam_id: int = Form(...),
    event_type: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    AI monitoring client uploads a screenshot evidence file.
    Optimized with:
      - 2 MB file size cap to prevent oversized uploads
      - Chunked async writes to avoid blocking the event loop
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Save the image to disk with chunked async writes + size enforcement
    ext = image.filename.split(".")[-1] if "." in image.filename else "jpg"
    safe_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(EVIDENCE_DIR, safe_filename)

    total_size = 0
    async with aiofiles.open(file_path, "wb") as buffer:
        while True:
            chunk = await image.read(CHUNK_SIZE)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > MAX_EVIDENCE_SIZE:
                # Clean up oversized file
                await buffer.close()
                try:
                    os.remove(file_path)
                except OSError:
                    pass
                raise HTTPException(
                    status_code=413,
                    detail=f"Evidence image exceeds {MAX_EVIDENCE_SIZE // 1024}KB limit",
                )
            await buffer.write(chunk)

    # Store metadata in the Evidence table
    evidence_record = Evidence(
        student_id=student_id,
        exam_id=exam_id,
        event_type=event_type,
        file_path=file_path,
    )
    db.add(evidence_record)
    db.commit()

    return {"message": "Evidence uploaded successfully", "file_path": file_path}


# ── Teacher: Get Evidence for a Student (JWT required) ───────────────────────
@router.get("/evidence/{exam_code}/{student_id}")
async def get_student_evidence(
    exam_code: str,
    student_id: int,
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] Returns all evidence screenshots for a specific student.
    Verifies that the requesting teacher owns the exam.
    Results are ordered newest-first.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Ownership check
    if exam.teacher_id != teacher["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. This exam belongs to another teacher.",
        )

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    records = (
        db.query(Evidence)
        .filter(Evidence.student_id == student_id, Evidence.exam_id == exam.id)
        .order_by(Evidence.timestamp.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "event_type": r.event_type,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "file_path": r.file_path.replace("\\", "/"),
        }
        for r in records
    ]
