"""
camera_test.py
--------------
Handles webcam initialization, frame reading, live video feed display,
and safe exit for the AI Exam Monitoring System.
"""

import cv2


def run_camera():
    """
    Initializes the webcam, displays a live video feed in a window,
    and releases resources safely when the user presses 'q'.
    """
    # Initialize the default webcam (index 0)
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("[ERROR] Could not open webcam. Please check your camera connection.")
        return

    print("[INFO] Webcam started. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()

        if not ret:
            print("[ERROR] Failed to read frame from webcam.")
            break

        # Display the live video feed
        cv2.imshow("AI Exam Monitor - Live Feed", frame)

        # Exit safely when 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("[INFO] Exit key pressed. Closing camera feed.")
            break

    # Release webcam and close all OpenCV windows
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Camera released successfully.")
