"""
exam.py
-------
API routes for exam creation and exam-level queries.

Protected endpoints require a valid teacher JWT token.
Unprotected endpoints are used by students (join flow).
"""

import random
import string
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Exam, Teacher, Student, Violation, Evidence
from backend.schemas import (
    ExamCreateRequest, ExamCreateResponse,
    StudentOut, ViolationOut, ExamOut,
)
from backend.auth_utils import get_current_teacher
from backend.connection_manager import manager

router = APIRouter()


def _generate_exam_code(length: int = 6) -> str:
    """Generates a random alphanumeric exam join code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


# ── Teacher: Create Exam ───────────────────────────────────────────────────────
@router.post("/create_exam", response_model=ExamCreateResponse)
def create_exam(
    req: ExamCreateRequest,
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] Create a new exam.
    Teacher ID is taken from the JWT token — not the request body.
    Returns the integer exam ID and a unique 6-character join code.
    """
    teacher_id = teacher["id"]

    # Verify teacher exists in DB
    db_teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not db_teacher:
        raise HTTPException(status_code=404, detail="Teacher account not found.")

    # Generate a collision-free exam code
    code = _generate_exam_code()
    while db.query(Exam).filter(Exam.exam_code == code).first():
        code = _generate_exam_code()

    exam = Exam(
        teacher_id=teacher_id,
        exam_name=req.exam_name,
        duration=req.duration,
        exam_code=code,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    return ExamCreateResponse(exam_id=exam.id, exam_code=exam.exam_code)


# ── Teacher: List Own Exams ────────────────────────────────────────────────────
@router.get("/teacher/exams", response_model=list[ExamOut])
def get_teacher_exams(
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] Returns all exams created by the logged-in teacher,
    including live student enrollment counts.
    """
    exams = (
        db.query(Exam)
        .filter(Exam.teacher_id == teacher["id"])
        .all()
    )
    return [
        ExamOut(
            id=e.id,
            exam_name=e.exam_name,
            exam_code=e.exam_code,
            duration=e.duration,
            student_count=len(e.students),
        )
        for e in exams
    ]


# ── Teacher: Get Students for Exam ────────────────────────────────────────────
@router.get("/exam_students/{exam_code}", response_model=list[StudentOut])
def get_exam_students(
    exam_code: str,
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] Returns all students enrolled in a given exam.
    Only the teacher who created the exam may view its student list.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    # Ownership check: only the creating teacher can see this exam
    if exam.teacher_id != teacher["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. This exam belongs to another teacher.",
        )

    return exam.students


# ── Teacher: Get Violations for Exam ──────────────────────────────────────────
@router.get("/violations/{exam_code}", response_model=list[ViolationOut])
def get_violations(
    exam_code: str,
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] Returns all recorded violation events for the given exam.
    Only the creating teacher may view violations.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if exam.teacher_id != teacher["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. This exam belongs to another teacher.",
        )

    return exam.violations


# ── Teacher: Delete Exam ──────────────────────────────────────────────────────
@router.delete("/delete_exam/{exam_code}")
def delete_exam(
    exam_code: str,
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] Delete an exam and all its associated data.
    Only the creating teacher may delete the exam.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if exam.teacher_id != teacher["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. This exam belongs to another teacher.",
        )

    # Delete associated data to prevent orphaned records
    db.query(Evidence).filter(Evidence.exam_id == exam.id).delete()
    db.query(Violation).filter(Violation.exam_id == exam.id).delete()
    db.query(Student).filter(Student.exam_id == exam.id).delete()
    
    db.delete(exam)
    db.commit()

    return {"status": "success", "message": "Exam deleted successfully."}


# ── Teacher: Kick Student ─────────────────────────────────────────────────────
@router.post("/teacher/kick_student/{exam_code}/{student_id}")
async def kick_student(
    exam_code: str,
    student_id: int,
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] Kick a student from the exam in real-time.
    Broadcasts the action via WebSocket so the student's browser reacts.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if exam.teacher_id != teacher["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    student = db.query(Student).filter(
        Student.id == student_id, Student.exam_id == exam.id
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this exam.")

    await manager.broadcast(exam_id=exam.id, message={
        "type": "kick_student",
        "student_id": student_id,
        "student_name": student.name,
    })

    return {"status": "success", "message": f"Student {student.name} kicked."}


# ── Teacher: Pause / Resume Exam ──────────────────────────────────────────────
@router.post("/teacher/pause_exam/{exam_code}")
async def pause_exam(
    exam_code: str,
    paused: bool = Body(..., embed=True),
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] Pause or resume the exam for all students.
    Broadcasts the pause/resume state via WebSocket.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if exam.teacher_id != teacher["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    await manager.broadcast(exam_id=exam.id, message={
        "type": "pause_exam",
        "paused": paused,
        "exam_code": exam_code,
    })

    action = "paused" if paused else "resumed"
    return {"status": "success", "message": f"Exam {action}."}


# ── Teacher: End Exam for Specific Student ────────────────────────────────────
@router.post("/teacher/end_student_exam/{exam_code}/{student_id}")
async def end_student_exam(
    exam_code: str,
    student_id: int,
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    [Teacher only] End the exam for a specific student.
    Broadcasts the action via WebSocket so the student's browser reacts.
    """
    exam = db.query(Exam).filter(Exam.exam_code == exam_code).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if exam.teacher_id != teacher["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    student = db.query(Student).filter(
        Student.id == student_id, Student.exam_id == exam.id
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this exam.")

    await manager.broadcast(exam_id=exam.id, message={
        "type": "end_student_exam",
        "student_id": student_id,
        "student_name": student.name,
    })

    return {"status": "success", "message": f"Exam ended for {student.name}."}
