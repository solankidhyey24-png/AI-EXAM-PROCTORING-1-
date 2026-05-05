"""
warning_overlay.py
------------------
Renders live warning banners on a webcam frame.

Usage:
    from modules.warning_overlay import WarningOverlay
    overlay = WarningOverlay()
    overlay.add("⚠ WARNING: Look at the Screen")
    overlay.draw(frame)
"""

import cv2
import time


# How long (seconds) a warning stays visible after being triggered
WARNING_HOLD_SECONDS = 2.0

# Visual config
FONT       = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.80
THICKNESS  = 2
BG_COLOR   = (0, 0, 180)      # Dark red background
TEXT_COLOR = (255, 255, 255)  # White text
PADDING    = 10               # Pixels of padding inside each banner
LINE_GAP   = 6                # Gap between stacked banners


class WarningOverlay:
    """
    Maintains an active set of warning messages and draws them on a frame.
    Each warning automatically expires after WARNING_HOLD_SECONDS, preventing
    rapid flickering when detections are momentarily absent.
    """

    def __init__(self, hold_seconds: float = WARNING_HOLD_SECONDS):
        self._hold = hold_seconds
        # { message: expiry_timestamp }
        self._warnings: dict[str, float] = {}

    def add(self, message: str):
        """
        Registers or refreshes a warning. Call every frame where the
        violation is active — the expiry is continuously renewed.
        """
        self._warnings[message] = time.monotonic() + self._hold

    def _active(self) -> list[str]:
        """Returns warnings that have not yet expired, in insertion order."""
        now = time.monotonic()
        expired = [k for k, exp in self._warnings.items() if exp < now]
        for k in expired:
            del self._warnings[k]
        return list(self._warnings.keys())

    def draw(self, frame):
        """
        Draws all active warning banners stacked at the bottom of the frame.
        Call once per frame after all detections have been evaluated.
        """
        messages = self._active()
        if not messages:
            return

        fh, fw = frame.shape[:2]

        # Measure each warning's text size
        sizes = []
        for msg in messages:
            (tw, th), _ = cv2.getTextSize(msg, FONT, FONT_SCALE, THICKNESS)
            sizes.append((tw, th))

        # Total block height (banners stacked bottom-up)
        total_h = sum(th + 2 * PADDING for _, th in sizes) + LINE_GAP * (len(messages) - 1)
        start_y = fh - total_h - 8

        for i, (msg, (tw, th)) in enumerate(zip(messages, sizes)):
            banner_h = th + 2 * PADDING
            y0       = start_y + i * (banner_h + LINE_GAP)
            y1       = y0 + banner_h

            # Draw filled background spanning full width
            cv2.rectangle(frame, (0, y0), (fw, y1), BG_COLOR, -1)

            # Draw a bright left-side accent stripe
            cv2.rectangle(frame, (0, y0), (5, y1), (0, 80, 255), -1)

            # Center the text vertically within the banner
            text_x = 14
            text_y = y0 + PADDING + th - 2
            cv2.putText(frame, msg, (text_x, text_y),
                        FONT, FONT_SCALE, TEXT_COLOR, THICKNESS, cv2.LINE_AA)
