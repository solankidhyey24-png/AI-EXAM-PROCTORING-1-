"""
violation_logger.py
-------------------
Utility module for logging exam violations to a timestamped log file.
Appends each violation as a new line — never overwrites existing entries.

Usage:
    from modules.violation_logger import ViolationLogger
    logger = ViolationLogger()
    logger.log("Multiple People Detected")
"""

import os
from datetime import datetime

# Default log file path (created in the project root)
DEFAULT_LOG_FILE = "exam_log.txt"

# Minimum seconds between repeated logs of the SAME violation
# (prevents flooding the log with the same event every frame)
COOLDOWN_SECONDS = 5


class ViolationLogger:
    """
    Logs violation events with timestamps to a text file.
    Includes a per-violation cooldown to avoid duplicate entries.
    """

    def __init__(self, log_file: str = DEFAULT_LOG_FILE):
        self.log_file = log_file
        # Tracks the last time each violation type was logged
        self._last_logged: dict[str, datetime] = {}
        self._ensure_log_file()

    def _ensure_log_file(self):
        """Creates the log file with a session header if it doesn't exist yet."""
        # Append mode ('a') never overwrites existing content
        with open(self.log_file, "a", encoding="utf-8") as f:
            if os.path.getsize(self.log_file) == 0:
                # Brand new file — write a header
                f.write("=" * 50 + "\n")
                f.write(f"  Exam Session Log\n")
                f.write("=" * 50 + "\n")
            # Write a session start marker every time the program runs
            session_start = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"\n[Session Started: {session_start}]\n")

    def log(self, violation: str):
        """
        Appends a violation entry to the log file if the cooldown has passed.

        Args:
            violation: Short description of the violation, e.g. 'Mobile Phone Detected'
        """
        now = datetime.now()
        last = self._last_logged.get(violation)

        if last is None or (now - last).total_seconds() >= COOLDOWN_SECONDS:
            timestamp = now.strftime("%H:%M:%S")
            entry = f"{timestamp} - {violation}\n"

            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(entry)

            # Print to console as well for real-time feedback
            print(f"[VIOLATION LOGGED] {entry.strip()}")

            self._last_logged[violation] = now

    def log_raw(self, message: str):
        """
        Appends any raw message (with timestamp) to the log file immediately,
        bypassing the cooldown. Use for session markers or special events.
        """
        now = datetime.now()
        timestamp = now.strftime("%H:%M:%S")
        entry = f"{timestamp} - {message}\n"
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(entry)
        print(f"[LOG] {entry.strip()}")
