"""
head_pose.py
------------
Estimates head orientation using MediaPipe Face Mesh and OpenCV solvePnP.
Detects: Head Forward, Head Left, Head Right, Head Up, Head Down.
"""

import os
import urllib.request
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from collections import deque

# Model URL and local path
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_PATH = "face_landmarker.task"

# ------------------------------------------------------------
# 3D reference points for a canonical human face model (mm).
# These correspond to specific MediaPipe landmark indices.
# ------------------------------------------------------------
FACE_3D_MODEL_POINTS = np.array([
    [0.0,    0.0,    0.0   ],  # Nose tip              (idx 1)
    [0.0,   -330.0, -65.0  ],  # Chin                  (idx 152)
    [-225.0,  170.0, -135.0],  # Left eye left corner  (idx 226)
    [225.0,   170.0, -135.0],  # Right eye right corner(idx 446)
    [-150.0, -150.0, -125.0],  # Left mouth corner     (idx 57)
    [150.0,  -150.0, -125.0],  # Right mouth corner    (idx 287)
], dtype=np.float64)

# Corresponding MediaPipe landmark indices for the 6 points above
LANDMARK_INDICES = [1, 152, 226, 446, 57, 287]

# Smoothing: rolling average over N frames to reduce flickering
SMOOTHING_WINDOW = 5


def download_model_if_needed():
    """Downloads the Face Landmarker model if not already present."""
    if not os.path.exists(MODEL_PATH):
        print("[INFO] Downloading MediaPipe Face Landmarker model...")
        try:
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
            print(f"[INFO] Model downloaded to {MODEL_PATH}.")
        except Exception as e:
            print(f"[ERROR] Failed to download model: {e}")


def get_head_direction(pitch, yaw):
    """
    Converts pitch and yaw angles (degrees) into a human-readable label.
    Yaw  > 0  → head turned Left  (from user's perspective)
    Yaw  < 0  → head turned Right
    Pitch> 0  → head tilted Down
    Pitch< 0  → head tilted Up
    """
    # Yaw thresholds
    if yaw > 15:
        return "Head Left"
    elif yaw < -15:
        return "Head Right"
    # Pitch thresholds (checked only when near center horizontally)
    elif pitch > 15:
        return "Head Down"
    elif pitch < -15:
        return "Head Up"
    else:
        return "Head Forward"


def run_head_pose():
    """
    Initializes webcam and MediaPipe Face Landmarker.
    Uses cv2.solvePnP to estimate head pose from 3D-to-2D landmark correspondences.
    Displays orientation label and draws the pose axis on screen.
    """
    download_model_if_needed()
    if not os.path.exists(MODEL_PATH):
        print("[ERROR] Face landmarker model missing. Cannot proceed.")
        return

    # Configure Face Landmarker
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    try:
        landmarker = vision.FaceLandmarker.create_from_options(options)
    except Exception as e:
        print(f"[ERROR] Failed to create Face Landmarker: {e}")
        return

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Could not open webcam.")
        return

    print("[INFO] Head Pose Detection started. Press 'q' to quit.")

    # Smoothing buffers for pitch and yaw
    pitch_buf = deque(maxlen=SMOOTHING_WINDOW)
    yaw_buf   = deque(maxlen=SMOOTHING_WINDOW)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to read frame.")
            break

        # Mirror for natural webcam feel
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        # Build camera intrinsic matrix (estimated from frame size)
        focal_length = w
        cam_matrix = np.array([
            [focal_length, 0,             w / 2],
            [0,            focal_length,  h / 2],
            [0,            0,             1    ],
        ], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        # Run MediaPipe detection
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect(mp_image)

        if result.face_landmarks:
            landmarks = result.face_landmarks[0]

            # Extract the 6 key 2D image points
            image_2d_points = np.array([
                [landmarks[idx].x * w, landmarks[idx].y * h]
                for idx in LANDMARK_INDICES
            ], dtype=np.float64)

            # Solve PnP to get rotation vector
            success, rot_vec, trans_vec = cv2.solvePnP(
                FACE_3D_MODEL_POINTS,
                image_2d_points,
                cam_matrix,
                dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE
            )

            if success:
                # Convert rotation vector to Euler angles
                rot_mat, _ = cv2.Rodrigues(rot_vec)
                sy = np.sqrt(rot_mat[0, 0] ** 2 + rot_mat[1, 0] ** 2)
                singular = sy < 1e-6

                if not singular:
                    pitch_rad = np.arctan2(-rot_mat[2, 0], sy)
                    yaw_rad   = np.arctan2(rot_mat[1, 0], rot_mat[0, 0])
                else:
                    pitch_rad = np.arctan2(-rot_mat[2, 0], sy)
                    yaw_rad   = 0.0

                pitch_deg = np.degrees(pitch_rad)
                yaw_deg   = np.degrees(yaw_rad)

                # Smooth the angles
                pitch_buf.append(pitch_deg)
                yaw_buf.append(yaw_deg)
                smooth_pitch = np.mean(pitch_buf)
                smooth_yaw   = np.mean(yaw_buf)

                direction = get_head_direction(smooth_pitch, smooth_yaw)

                # Draw a 3D pose axis on the nose tip for visual feedback
                nose_2d = tuple(image_2d_points[0].astype(int))
                axis_3d = np.float32([[100, 0, 0], [0, 100, 0], [0, 0, -100]])
                axis_pts, _ = cv2.projectPoints(
                    axis_3d, rot_vec, trans_vec, cam_matrix, dist_coeffs
                )
                ax = axis_pts.astype(int)
                cv2.line(frame, nose_2d, tuple(ax[0].ravel()), (0,   0, 255), 3)  # X → Red
                cv2.line(frame, nose_2d, tuple(ax[1].ravel()), (0, 255,   0), 3)  # Y → Green
                cv2.line(frame, nose_2d, tuple(ax[2].ravel()), (255,  0,   0), 3)  # Z → Blue

                # Choose color based on direction
                color = (0, 255, 0) if direction == "Head Forward" else (0, 165, 255)

                # Display direction label and angle info
                cv2.putText(frame, direction,
                            (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.3, color, 3)
                cv2.putText(frame, f"Pitch: {smooth_pitch:.1f}  Yaw: {smooth_yaw:.1f}",
                            (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
        else:
            pitch_buf.clear()
            yaw_buf.clear()
            cv2.putText(frame, "No Face Detected",
                        (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 0, 255), 3)

        cv2.imshow("AI Exam Monitor - Head Pose", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("[INFO] Exit key pressed. Closing feed.")
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Resources released successfully.")
