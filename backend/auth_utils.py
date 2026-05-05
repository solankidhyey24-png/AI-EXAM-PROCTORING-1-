"""
auth_utils.py
-------------
JWT authentication utilities for the AI Exam Monitoring Platform.

Provides:
  - BCrypt password hashing / verification
  - JWT creation and decoding
  - FastAPI security dependencies (get_current_teacher)
  - Simple in-memory rate limiter for login endpoint
"""

from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from collections import defaultdict
import threading


# ── Configuration ─────────────────────────────────────────────────────────────
# IMPORTANT: Change SECRET_KEY to a strong random value in production!
SECRET_KEY = "ai-exam-proctor-secret-key-change-in-production-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8


# ── Password Hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a plain-text password against a stored hash.
    Also supports legacy plain-text passwords for zero-downtime migration.
    """
    if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
        return pwd_context.verify(plain, hashed)
    # Legacy plain-text fallback (only used during first-login migration)
    return plain == hashed


# ── JWT Token Management ──────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    """Create a signed JWT access token with a configured expiry time."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    Raises 401 on invalid/expired token, 403 if role != teacher.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "teacher":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Teacher role required.",
            )
        # Ensure id is always an integer
        if "id" in payload:
            payload["id"] = int(payload["id"])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI Security Dependencies ─────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_teacher(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency that extracts and validates the Bearer JWT token.
    Returns the decoded payload (id, name, email, role).
    Raises 401 if token is missing or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in as a teacher.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_token(credentials.credentials)


# ── Simple In-Memory Rate Limiter ─────────────────────────────────────────────
class _RateLimiter:
    """Thread-safe sliding-window rate limiter (no external dependencies)."""

    def __init__(self, max_calls: int, period_seconds: int):
        self.max_calls = max_calls
        self.period = timedelta(seconds=period_seconds)
        self._calls: dict = defaultdict(list)
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> bool:
        now = datetime.utcnow()
        with self._lock:
            # Purge expired timestamps
            self._calls[key] = [t for t in self._calls[key] if now - t < self.period]
            if len(self._calls[key]) >= self.max_calls:
                return False
            self._calls[key].append(now)
            return True


# Singleton: max 5 login attempts per IP address per 60 seconds
login_rate_limiter = _RateLimiter(max_calls=5, period_seconds=60)
