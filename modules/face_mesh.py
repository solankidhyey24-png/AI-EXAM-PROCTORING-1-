"""
face_mesh.py
------------
Handles webcam initialization, running MediaPipe Face Mesh (Tasks API),
drawing facial landmarks in real-time, and safe exit.
"""

import os
import urllib.request
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Model URL and local path for the MediaPipe Face Landmarker model
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_PATH = "face_landmarker.task"


def download_model_if_needed():
    """
    Downloads the required Face Landmarker model if it doesn't already exist.
    """
    if not os.path.exists(MODEL_PATH):
        print(f"[INFO] Downloading MediaPipe Face Landmarker model...")
        try:
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
            print(f"[INFO] Model downloaded successfully to {MODEL_PATH}.")
        except Exception as e:
            print(f"[ERROR] Failed to download model: {e}")


def draw_landmarks(frame, detection_result):
    """
    Draws the facial landmarks and connections on the provided frame.
    """
    face_landmarks_list = detection_result.face_landmarks
    
    # Loop through the detected faces to draw landmarks
    for face_landmarks in face_landmarks_list:
        # We manually draw the landmarks as small circles since the tasks API 
        # returns coordinate data directly and the solutions drawing utils are unavailable.
        # However, MediaPipe provides a way to draw them by iterating over landmarks mapping.
        
        height, width, _ = frame.shape
        
        # Draw each landmark point
        for landmark in face_landmarks:
            x = int(landmark.x * width)
            y = int(landmark.y * height)
            cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)


def run_face_mesh():
    """
    Initializes webcam and MediaPipe Face Mesh (Tasks API).
    Draws facial landmarks on detected faces or displays 'No Face Detected'.
    Exits safely on pressing 'q'.
    """
    # 1. Download model if missing
    download_model_if_needed()

    if not os.path.exists(MODEL_PATH):
        print("[ERROR] Face landmarker model is missing. Cannot proceed.")
        return

    # 2. Configure MediaPipe Face Landmarker
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    
    try:
        landmarker = vision.FaceLandmarker.create_from_options(options)
    except Exception as e:
        print(f"[ERROR] Failed to create Face Landmarker: {e}")
        return

    # 3. Initialize the default webcam (index 0)
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("[ERROR] Could not open webcam. Please check your camera connection.")
        return

    print("[INFO] Face Mesh started. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()

        if not ret:
            print("[ERROR] Failed to read frame from webcam.")
            break

        # Convert the BGR frame to RGB and create a MediaPipe Image object
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # Process the frame for face landmarks
        detection_result = landmarker.detect(mp_image)

        # Draw facial landmarks
        if detection_result.face_landmarks:
            draw_landmarks(frame, detection_result)
        else:
            # If no face is detected, display warning text
            cv2.putText(frame, "No Face Detected", (20, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        # Display the live video feed
        cv2.imshow("AI Exam Monitor - Face Mesh", frame)

        # Exit safely when 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("[INFO] Exit key pressed. Closing face mesh feed.")
            break

    # Release webcam and close all OpenCV windows
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Resources released successfully.")
