"""
gaze_tracking.py
----------------
Handles webcam initialization, running MediaPipe Face Mesh (Tasks API),
extracting eye and iris landmarks, estimating gaze direction, and safe exit.
"""

import os
import urllib.request
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Model URL and local path for the MediaPipe Face Landmarker model
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_PATH = "face_landmarker.task"

# MediaPipe Face Mesh landmark indices for eyes
# Right eye landmarks (from user's perspective, so image left)
RIGHT_EYE_CORNERS = [33, 133]  # [inner corner, outer corner]
RIGHT_EYE_TOP_BOTTOM = [159, 145] # [top center, bottom center] 
RIGHT_IRIS = [469, 470, 471, 472] # Landmarks for the right iris

# Left eye landmarks (from user's perspective, so image right)
LEFT_EYE_CORNERS = [362, 263]   # [inner corner, outer corner]
LEFT_EYE_TOP_BOTTOM = [386, 374]  # [top center, bottom center]
LEFT_IRIS = [474, 475, 476, 477]  # Landmarks for the left iris


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


def get_landmark_coords(landmarks, index, frame_width, frame_height):
    """
    Helper function to get pixel coordinates from normalized landmark.
    """
    landmark = landmarks[index]
    return np.array([landmark.x * frame_width, landmark.y * frame_height])


def get_gaze_direction(eye_landmarks, frame_width, frame_height):
    """
    Estimates the gaze direction based on eye landmarks.
    This basic implementation estimates Left/Right/Center based on iris horizontal position
    and Down/Center based on iris vertical position relative to eye corners.
    """
    # Use right eye (image left) for primary tracking as it's often more stable,
    # or you could average both eyes. Let's use right eye corners & iris center.
    
    # Calculate Iris Center
    r_iris_points = [get_landmark_coords(eye_landmarks, idx, frame_width, frame_height) for idx in RIGHT_IRIS]
    iris_center = np.mean(r_iris_points, axis=0)
    
    # Eye Corners
    r_inner = get_landmark_coords(eye_landmarks, RIGHT_EYE_CORNERS[0], frame_width, frame_height)
    r_outer = get_landmark_coords(eye_landmarks, RIGHT_EYE_CORNERS[1], frame_width, frame_height)
    
    # Eye Top/Bottom for vertical tracking
    r_top = get_landmark_coords(eye_landmarks, RIGHT_EYE_TOP_BOTTOM[0], frame_width, frame_height)
    r_bottom = get_landmark_coords(eye_landmarks, RIGHT_EYE_TOP_BOTTOM[1], frame_width, frame_height)
    
    # Left/Right detection (Horizontal Ratio)
    # 0.0 is looking extremely right (image left), 1.0 is extremely left (image right)
    eye_width = np.linalg.norm(r_outer - r_inner)
    if eye_width == 0: return "Looking Center"
    
    # Distance from inner corner to iris
    iris_dist_inner = np.linalg.norm(iris_center - r_inner)
    horizontal_ratio = iris_dist_inner / eye_width

    # Up/Down detection (Vertical Ratio)
    eye_height = np.linalg.norm(r_bottom - r_top)
    if eye_height == 0: return "Looking Center"
    
    # Distance from top to iris
    iris_dist_top = np.linalg.norm(iris_center - r_top)
    vertical_ratio = iris_dist_top / eye_height
    
    # Determine the gaze direction based on empirical thresholds
    # Note: These thresholds might need tuning depending on camera angle
    gaze_text = "Looking Center"

    if horizontal_ratio < 0.42:
        gaze_text = "Looking Right"
    elif horizontal_ratio > 0.58:
        gaze_text = "Looking Left"
    elif vertical_ratio > 0.70:
        gaze_text = "Looking Down"
        
    return gaze_text


def run_gaze_tracking():
    """
    Initializes webcam and MediaPipe Face Landmarker.
    Estimates and displays eye gaze direction.
    Exits safely on pressing 'q'.
    """
    # 1. Download model if missing
    download_model_if_needed()

    if not os.path.exists(MODEL_PATH):
        print("[ERROR] Face landmarker model is missing. Cannot proceed.")
        return

    # 2. Configure MediaPipe Face Landmarker
    # Crucial: output_facial_blendshapes / Iris tracking features are built
    # into the latest version of FaceLandmarker. 
    # The normal FaceMesh landmarks include 478 points (including 10 iris points).
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

    # 3. Initialize the default webcam
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("[ERROR] Could not open webcam.")
        return

    print("[INFO] Eye Gaze Tracking started. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to read frame from webcam.")
            break

        # Flip frame horizontally for a more natural mirror view
        frame = cv2.flip(frame, 1)

        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # Process the frame for face landmarks
        detection_result = landmarker.detect(mp_image)

        h, w, _ = frame.shape

        if detection_result.face_landmarks:
            face_landmarks = detection_result.face_landmarks[0]
            
            # Since MediaPipe Face Mesh model provides 478 landmarks, ensure it supports irises
            if len(face_landmarks) >= 478:
                gaze_text = get_gaze_direction(face_landmarks, w, h)
                
                # Display gaze direction on screen
                cv2.putText(frame, gaze_text, (30, 60), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)

                # Visualize the irises just to show it's working
                for idx in RIGHT_IRIS + LEFT_IRIS:
                    pt_x = int(face_landmarks[idx].x * w)
                    pt_y = int(face_landmarks[idx].y * h)
                    cv2.circle(frame, (pt_x, pt_y), 2, (0, 0, 255), -1)
            else:
                cv2.putText(frame, "Model lacks Iris Tracking", (30, 60), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 165, 255), 2)
        else:
            # If no face is detected
            cv2.putText(frame, "No Face Detected", (30, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)

        # Display the live video feed
        cv2.imshow("AI Exam Monitor - Gaze Tracking", frame)

        # Exit safely when 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("[INFO] Exit key pressed. Closing feed.")
            break

    # Release resources
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Resources released successfully.")
