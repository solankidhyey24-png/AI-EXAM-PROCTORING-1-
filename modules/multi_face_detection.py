"""
multi_face_detection.py
-----------------------
Detects all faces in the webcam frame in real time using MediaPipe FaceDetector.
Draws bounding boxes, displays face count, and alerts if more than one face detected.
"""

import os
import urllib.request
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from collections import deque

# Model URL and local path
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
MODEL_PATH = "blaze_face_short_range.tflite"

# Smoothing: rolling face-count average over N frames to prevent flickering alerts
SMOOTHING_WINDOW = 5


def download_model_if_needed():
    """Downloads the BlazeFace detection model if not already present."""
    if not os.path.exists(MODEL_PATH):
        print("[INFO] Downloading MediaPipe face detection model...")
        try:
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
            print(f"[INFO] Model downloaded to {MODEL_PATH}.")
        except Exception as e:
            print(f"[ERROR] Failed to download model: {e}")


def draw_detections(frame, detections):
    """
    Draws bounding boxes and confidence scores around each detected face.
    Colors the box red if multiple faces are present.
    """
    h, w = frame.shape[:2]
    multi = len(detections) > 1
    box_color = (0, 0, 255) if multi else (0, 255, 0)

    for detection in detections:
        bbox = detection.bounding_box
        x = max(0, int(bbox.origin_x))
        y = max(0, int(bbox.origin_y))
        bw = int(bbox.width)
        bh = int(bbox.height)

        # Clamp to frame boundaries
        x2 = min(w, x + bw)
        y2 = min(h, y + bh)

        cv2.rectangle(frame, (x, y), (x2, y2), box_color, 2)

        # Confidence score label
        score = detection.categories[0].score
        label = f"Face  {int(score * 100)}%"
        text_y = y - 10 if y - 10 > 15 else y + 20
        cv2.putText(frame, label, (x, text_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, box_color, 2)


def run_multi_face_detection():
    """
    Initializes webcam and MediaPipe FaceDetector.
    Counts all detected faces per frame, draws boxes, and shows a warning
    if more than one face is visible.
    """
    download_model_if_needed()
    if not os.path.exists(MODEL_PATH):
        print("[ERROR] Face detection model missing. Cannot proceed.")
        return

    # Configure FaceDetector for up to 10 simultaneous faces
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.FaceDetectorOptions(
        base_options=base_options,
        min_detection_confidence=0.5,
        min_suppression_threshold=0.3,
    )
    try:
        detector = vision.FaceDetector.create_from_options(options)
    except Exception as e:
        print(f"[ERROR] Failed to create Face Detector: {e}")
        return

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Could not open webcam.")
        return

    print("[INFO] Multiple Face Detection started. Press 'q' to quit.")

    # Rolling buffer for smoothed face count
    count_buf = deque(maxlen=SMOOTHING_WINDOW)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to read frame.")
            break

        # Mirror for natural webcam feel
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        # Run detection
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = detector.detect(mp_image)

        detections = result.detections if result.detections else []
        raw_count = len(detections)

        # Smooth count: use majority vote over the buffer to reduce jitter
        count_buf.append(raw_count)
        smooth_count = round(sum(count_buf) / len(count_buf))

        # Draw bounding boxes using the actual raw detections
        draw_detections(frame, detections)

        # --- HUD: face count ---
        count_label = f"Faces Detected: {smooth_count}"
        cv2.putText(frame, count_label, (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

        if smooth_count == 0:
            cv2.putText(frame, "No Face Detected", (20, 85),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)
        elif smooth_count > 1:
            # Prominent red alert banner
            alert = "ALERT: Multiple People Detected!"
            (tw, th), _ = cv2.getTextSize(alert, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
            cv2.rectangle(frame, (15, 58), (15 + tw + 10, 58 + th + 10), (0, 0, 180), -1)
            cv2.putText(frame, alert, (20, 82),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

        cv2.imshow("AI Exam Monitor - Multiple Face Detection", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("[INFO] Exit key pressed. Closing feed.")
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Resources released successfully.")
