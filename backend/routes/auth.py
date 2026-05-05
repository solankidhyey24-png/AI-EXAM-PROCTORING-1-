"""
auth.py
-------
Teacher authentication routes for the AI Exam Monitoring Platform.

Endpoints (all mounted under /teacher prefix in main.py):
  POST /teacher/login  — verify credentials, return signed JWT
  GET  /teacher/me     — return profile of logged-in teacher
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Teacher
from backend.schemas import TeacherLoginRequest, TeacherLoginResponse, TeacherOut
from backend.auth_utils import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_teacher,
    login_rate_limiter,
)

router = APIRouter()


@router.post("/login", response_model=TeacherLoginResponse)
def teacher_login(
    req: TeacherLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Authenticate a teacher with email + password.

    - Rate limited: 5 attempts per minute per IP address.
    - On first successful login with a plain-text password, automatically
      upgrades it to a bcrypt hash in the database.
    - Returns a signed JWT valid for 8 hours.
    """
    # ── Rate limiting ──────────────────────────────────────────────────────
    client_ip = request.client.host if request.client else "unknown"
    if not login_rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait 60 seconds before trying again.",
        )

    # ── Credential validation ──────────────────────────────────────────────
    teacher = (
        db.query(Teacher)
        .filter(Teacher.email == req.email.lower().strip())
        .first()
    )
    if not teacher or not verify_password(req.password, teacher.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # ── Auto-upgrade plain-text password to bcrypt ─────────────────────────
    if not (
        teacher.password.startswith("$2b$") or teacher.password.startswith("$2a$")
    ):
        teacher.password = hash_password(req.password)
        db.commit()

    # ── Build and sign JWT ─────────────────────────────────────────────────
    token_data = {
        "sub": str(teacher.id),
        "id": teacher.id,
        "name": teacher.name,
        "email": teacher.email,
        "role": "teacher",
    }
    access_token = create_access_token(token_data)

    return TeacherLoginResponse(
        access_token=access_token,
        token_type="bearer",
        teacher_id=teacher.id,
        name=teacher.name,
        email=teacher.email,
    )


@router.get("/me", response_model=TeacherOut)
def get_me(
    teacher: dict = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Returns the profile of the currently authenticated teacher."""
    db_teacher = db.query(Teacher).filter(Teacher.id == teacher["id"]).first()
    if not db_teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")
    return db_teacher
