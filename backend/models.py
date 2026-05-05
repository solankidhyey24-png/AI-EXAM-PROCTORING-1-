"""
models.py
---------
SQLAlchemy ORM models for the exam monitoring platform.
Tables: Teacher, Exam, Student, Violation
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.database import Base


# ── Teacher ──────────────────────────────────────────────────────────────────
class Teacher(Base):
    __tablename__ = "teachers"

    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String, nullable=False)
    email    = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)

    # Relationship: a teacher can create many exams
    exams = relationship("Exam", back_populates="teacher")


# ── Exam ─────────────────────────────────────────────────────────────────────
class Exam(Base):
    __tablename__ = "exams"

    id         = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    exam_name  = Column(String, nullable=False)
    duration   = Column(Integer, nullable=False)          # duration in minutes
    exam_code  = Column(String, unique=True, index=True)  # unique join code

    teacher    = relationship("Teacher", back_populates="exams")
    students   = relationship("Student",   back_populates="exam")
    violations = relationship("Violation", back_populates="exam")


# ── Student ──────────────────────────────────────────────────────────────────
class Student(Base):
    __tablename__ = "students"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    exam_id    = Column(Integer, ForeignKey("exams.id"), nullable=False)
    login_time = Column(DateTime, default=datetime.utcnow)

    exam       = relationship("Exam", back_populates="students")
    violations = relationship("Violation", back_populates="student")


# ── Violation ────────────────────────────────────────────────────────────────
class Violation(Base):
    __tablename__ = "violations"

    id               = Column(Integer, primary_key=True, index=True)
    student_id       = Column(Integer, ForeignKey("students.id"), nullable=False)
    exam_id          = Column(Integer, ForeignKey("exams.id"), nullable=False)
    event_type       = Column(String, nullable=False)     # e.g. "Mobile Phone Detected"
    timestamp        = Column(DateTime, default=datetime.utcnow)
    suspicion_score  = Column(Float, default=0.0)

    student = relationship("Student", back_populates="violations")
    exam    = relationship("Exam",    back_populates="violations")


# ── Evidence ─────────────────────────────────────────────────────────────────
class Evidence(Base):
    __tablename__ = "evidence"

    id         = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    exam_id    = Column(Integer, ForeignKey("exams.id"), nullable=False)
    event_type = Column(String, nullable=False)
    file_path  = Column(String, nullable=False)
    timestamp  = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")
    exam    = relationship("Exam")
