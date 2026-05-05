"""
suspicion_scorer.py
-------------------
Maintains a real-time suspicion score (0–100) that rises on violations
and gradually decays back to 0 during normal behaviour.

Usage:
    from modules.suspicion_scorer import SuspicionScorer
    scorer = SuspicionScorer()
    scorer.add_violation("looking_away")   # call when violation is active
    scorer.tick()                          # call once per frame
    score = scorer.score
"""

# ── Violation weights (points added per frame the violation is active) ────────
VIOLATION_WEIGHTS = {
    "looking_away":       5,
    "head_turned":        7,
    "multiple_people":   20,
    "phone_detected":    25,
    "no_face":           10,
    "tab_switch":        15,
}

# Score decays by this many points per frame when no violation is active
DECAY_RATE    = 0.3

# Clamp range
SCORE_MIN     = 0.0
SCORE_MAX     = 100.0

# Score at which HIGH SUSPICION alert fires
HIGH_THRESHOLD = 70.0


class SuspicionScorer:
    """
    Frame-by-frame suspicion scorer.
    Call add_violation() for every active violation each frame,
    then call tick() once at the end of the frame to apply decay.
    """

    def __init__(self):
        self._score: float = 0.0
        self._violations_this_frame: set[str] = set()

    # ── Public API ────────────────────────────────────────────────────────────

    def add_violation(self, key: str):
        """
        Mark a violation as active this frame.
        key must be one of the keys in VIOLATION_WEIGHTS.
        """
        if key in VIOLATION_WEIGHTS:
            self._violations_this_frame.add(key)

    def tick(self):
        """
        Applies pending violations and decay for this frame.
        Call exactly once per frame, after all add_violation() calls.
        """
        if self._violations_this_frame:
            # Sum all active violation weights and add to score
            increment = sum(VIOLATION_WEIGHTS[k] for k in self._violations_this_frame)
            # Scale increment so even a max-weight violation doesn't
            # slam the score up instantly (divide by frames-per-second feel)
            self._score += increment * 0.1
        else:
            # No violations → decay toward zero
            self._score = max(SCORE_MIN, self._score - DECAY_RATE)

        # Clamp to [0, 100]
        self._score = min(SCORE_MAX, max(SCORE_MIN, self._score))
        self._violations_this_frame.clear()

    @property
    def score(self) -> int:
        """Current suspicion score as an integer (0–100)."""
        return int(self._score)

    @property
    def is_high(self) -> bool:
        """True when score exceeds the HIGH_THRESHOLD."""
        return self._score >= HIGH_THRESHOLD

    # ── Drawing helper ────────────────────────────────────────────────────────

    def draw(self, frame):
        """
        Draws the suspicion score bar and label on the top-right of the frame.
        Color: green (low) → orange (medium) → red (high).
        """
        import cv2

        fh, fw = frame.shape[:2]
        score  = self.score

        # -- Score bar geometry
        bar_w   = 200
        bar_h   = 20
        bar_x   = fw - bar_w - 20
        bar_y   = 15

        # Background bar (dark grey)
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h),
                      (50, 50, 50), -1)

        # Filled portion
        fill_w = int(bar_w * score / 100)
        if score < 40:
            fill_color = (0, 200, 0)       # green
        elif score < HIGH_THRESHOLD:
            fill_color = (0, 140, 255)     # orange
        else:
            fill_color = (0, 0, 220)       # red

        if fill_w > 0:
            cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h),
                          fill_color, -1)

        # Border
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h),
                      (200, 200, 200), 1)

        # Label: "Suspicion: XX"
        label = f"Suspicion: {score}"
        cv2.putText(frame, label, (bar_x, bar_y + bar_h + 18),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)

        # HIGH SUSPICION alert text
        if self.is_high:
            alert = "\u26a0 HIGH SUSPICION DETECTED"
            (aw, ah), _ = cv2.getTextSize(alert, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
            ax = (fw - aw) // 2
            ay = bar_y + bar_h + 45
            cv2.putText(frame, alert, (ax, ay),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2, cv2.LINE_AA)
