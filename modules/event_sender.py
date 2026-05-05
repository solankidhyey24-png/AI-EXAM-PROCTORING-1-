"""
event_sender.py
---------------
Sends violation events from the AI monitoring client to the backend server
via HTTP POST requests to /send_event.

Features:
  - Per-event-type cooldown to avoid flooding the server every frame
  - Non-blocking: errors are caught silently so the monitoring loop never stalls
  - Configurable backend URL and cooldown duration
"""

import time
import threading
import requests


class EventSender:
    """
    Helper class to send violation events to the backend.
    
    Usage:
        sender = EventSender(student_id=1, exam_id=1)
        sender.send("phone_detected", suspicion_score=85)
    """

    def __init__(
        self,
        student_id: int,
        exam_id: int,
        base_url: str = "http://127.0.0.1:8000",
        cooldown_seconds: float = 5.0,
    ):
        self.student_id = student_id
        self.exam_id = exam_id
        self.endpoint = f"{base_url}/send_event"
        self.cooldown = cooldown_seconds

        # Track the last time each event type was sent
        self._last_sent: dict[str, float] = {}

    def send(self, event_type: str, suspicion_score: float = 0.0):
        """
        Send a violation event to the backend if the cooldown has elapsed.
        Runs the actual HTTP request in a background thread to avoid
        blocking the video processing loop.
        """
        now = time.time()

        # Check cooldown — skip if this event was sent too recently
        last = self._last_sent.get(event_type, 0)
        if now - last < self.cooldown:
            return

        self._last_sent[event_type] = now

        # Fire the request in a background thread so it doesn't lag the camera
        threading.Thread(
            target=self._post,
            args=(event_type, suspicion_score),
            daemon=True,
        ).start()

    def _post(self, event_type: str, suspicion_score: float):
        """Actual HTTP POST — runs in a daemon thread."""
        payload = {
            "student_id": self.student_id,
            "exam_id": self.exam_id,
            "event_type": event_type,
            "suspicion_score": suspicion_score,
        }
        try:
            resp = requests.post(self.endpoint, json=payload, timeout=3)
            if resp.status_code == 200:
                print(f"[EVENT] Sent → {event_type} (score {suspicion_score:.0f})")
            else:
                print(f"[EVENT] Server responded {resp.status_code} for {event_type}")
        except requests.RequestException as e:
            # Server unreachable — don't crash the monitoring loop
            print(f"[ERROR] Could not send event {event_type}: {e}")
        except Exception as e:
            print(f"[ERROR] Unexpected error in EventSender: {e}")
