"""
student.py
----------
API route for students joining an exam.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models   import Exam, Student
from backend.schemas  import StudentJoinRequest, StudentJoinResponse

router = APIRouter()


@router.post("/join_exam", response_model=StudentJoinResponse)
def join_exam(req: StudentJoinRequest, db: Session = Depends(get_db)):
    """
    Student joins an exam using the exam code.
    Returns the student_id and exam_id.
    """
    # Look up the exam by code
    exam = db.query(Exam).filter(Exam.exam_code == req.exam_code).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Invalid exam code")

    student = Student(name=req.name, exam_id=exam.id)
    db.add(student)
    db.commit()
    db.refresh(student)

    return StudentJoinResponse(student_id=student.id, exam_id=exam.id)
