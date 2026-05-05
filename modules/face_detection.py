"""
face_detection.py
-----------------
Handles webcam initialization, running MediaPipe face detection, 
displaying bounding boxes and confidence scores, and safe exit.
Uses the new MediaPipe Tasks API, which replaces the deprecated `solutions` API.
"""

import os
import urllib.request
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Model URL and local path for the MediaPipe Face Detection model
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
MODEL_PATH = "blaze_face_short_range.tflite"


def download_model_if_needed():
    """
    Downloads the required BlazeFace model if it doesn't already exist in the directory.
    """
    if not os.path.exists(MODEL_PATH):
        print(f"[INFO] Downloading MediaPipe face detection model...")
        try:
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
            print(f"[INFO] Model downloaded successfully to {MODEL_PATH}.")
        except Exception as e:
            print(f"[ERROR] Failed to download model: {e}")


def run_face_detection():
    """
    Initializes webcam and MediaPipe Face Detection (Tasks API).
    Draws bounding boxes and confidence scores around detected faces.
    Displays 'No Face Detected' if no face is found.
    Exits safely on pressing 'q'.
    """
    # 1. Download model if missing
    download_model_if_needed()

    if not os.path.exists(MODEL_PATH):
        print("[ERROR] Face detection model is missing. Cannot proceed.")
        return

    # 2. Configure MediaPipe Face Detector
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.FaceDetectorOptions(
        base_options=base_options,
        min_detection_confidence=0.5
    )
    detector = vision.FaceDetector.create_from_options(options)

    # 3. Initialize the default webcam (index 0)
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("[ERROR] Could not open webcam. Please check your camera connection.")
        return

    print("[INFO] Face Detection started. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()

        if not ret:
            print("[ERROR] Failed to read frame from webcam.")
            break

        # Convert the BGR frame to RGB and create a MediaPipe Image object
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # Process the frame for face detection
        detection_result = detector.detect(mp_image)

        # Draw bounding boxes and confidence scores
        if detection_result.detections:
            for detection in detection_result.detections:
                # Extract bounding box
                bbox = detection.bounding_box
                x = int(bbox.origin_x)
                y = int(bbox.origin_y)
                w = int(bbox.width)
                h = int(bbox.height)
                
                # Draw the bounding box
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                
                # Extract confidence score and format it
                score = detection.categories[0].score
                conf_text = f"Conf: {int(score * 100)}%"
                
                # Ensure text is drawn within the frame bounds
                text_y = y - 10 if y - 10 > 20 else y + 20
                
                cv2.putText(frame, conf_text, (x, text_y),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        else:
            # If no face is detected, display warning text
            cv2.putText(frame, "No Face Detected", (20, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        # Display the live video feed
        cv2.imshow("AI Exam Monitor - Face Detection", frame)

        # Exit safely when 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("[INFO] Exit key pressed. Closing face detection feed.")
            break

    # Release webcam and close all OpenCV windows
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Resources released successfully.")
