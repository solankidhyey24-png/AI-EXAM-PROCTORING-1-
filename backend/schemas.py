"""
schemas.py
----------
Pydantic models for API request/response validation.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Teacher Auth ──────────────────────────────────────────────────────────────
class TeacherLoginRequest(BaseModel):
    email: str
    password: str


class TeacherLoginResponse(BaseModel):
    access_token: str
    token_type: str
    teacher_id: int
    name: str
    email: str


class TeacherOut(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


# ── Exam ─────────────────────────────────────────────────────────────────────
class ExamCreateRequest(BaseModel):
    exam_name: str
    duration: int          # minutes


class ExamCreateResponse(BaseModel):
    exam_id: int
    exam_code: str

    class Config:
        from_attributes = True


class ExamOut(BaseModel):
    id: int
    exam_name: str
    exam_code: str
    duration: int
    student_count: int = 0

    class Config:
        from_attributes = True


# ── Student ──────────────────────────────────────────────────────────────────
class StudentJoinRequest(BaseModel):
    name: str
    exam_code: str


class StudentJoinResponse(BaseModel):
    student_id: int
    exam_id: int

    class Config:
        from_attributes = True


class StudentOut(BaseModel):
    id: int
    name: str
    login_time: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Violation ────────────────────────────────────────────────────────────────
class ViolationSendRequest(BaseModel):
    student_id: int
    exam_id: int
    event_type: str
    suspicion_score: float = 0.0


class ViolationOut(BaseModel):
    id: int
    student_id: int
    exam_id: int
    event_type: str
    timestamp: Optional[datetime] = None
    suspicion_score: float

    class Config:
        from_attributes = True
