"""
connection_manager.py
---------------------
WebSocket connection manager for the AI Exam Monitoring Platform.

Maintains per-exam lists of active WebSocket connections so that
violation events can be broadcast to all connected teacher dashboards.

Optimized for multi-student load with concurrent sends and minimal logging.
"""

from fastapi import WebSocket
import asyncio
import json


class ConnectionManager:
    """
    Manages WebSocket connections grouped by exam_id.
    Multiple clients can connect to the same exam simultaneously.
    Uses asyncio.gather for concurrent broadcast to handle many connections.
    """

    def __init__(self):
        # { exam_id: [websocket_1, websocket_2, ...] }
        self._connections: dict[int, list[WebSocket]] = {}

    async def connect(self, exam_id: int, websocket: WebSocket):
        """Accept a new WebSocket connection and register it under the exam."""
        await websocket.accept()
        if exam_id not in self._connections:
            self._connections[exam_id] = []
        self._connections[exam_id].append(websocket)
        count = len(self._connections[exam_id])
        print(f"[WS] +1 client on exam {exam_id} (total: {count})")

    def disconnect(self, exam_id: int, websocket: WebSocket):
        """Remove a WebSocket connection from the exam's connection list."""
        if exam_id in self._connections:
            try:
                self._connections[exam_id].remove(websocket)
            except ValueError:
                pass  # Already removed
            if not self._connections[exam_id]:
                del self._connections[exam_id]

    async def _safe_send(self, ws: WebSocket, message: dict):
        """Send to a single WebSocket, returning it if it fails (dead)."""
        try:
            await ws.send_json(message)
            return None  # Success
        except Exception:
            return ws  # Dead connection

    async def broadcast(self, exam_id: int, message: dict):
        """
        Send a JSON message to ALL clients connected to the given exam.
        Uses asyncio.gather for concurrent sends — much faster with many clients.
        Automatically removes dead connections.
        """
        if exam_id not in self._connections:
            return

        clients = self._connections[exam_id]
        if not clients:
            return

        # Send to all clients concurrently
        results = await asyncio.gather(
            *(self._safe_send(ws, message) for ws in clients),
            return_exceptions=True,
        )

        # Collect dead connections
        dead = [r for r in results if r is not None and isinstance(r, WebSocket)]
        if dead:
            for ws in dead:
                try:
                    clients.remove(ws)
                except ValueError:
                    pass
            if exam_id in self._connections and not self._connections[exam_id]:
                del self._connections[exam_id]

    def active_count(self, exam_id: int) -> int:
        """Returns the number of active connections for the given exam."""
        return len(self._connections.get(exam_id, []))


# ── Singleton instance shared across the app ─────────────────────────────────
manager = ConnectionManager()
