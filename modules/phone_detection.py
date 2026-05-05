"""
phone_detection.py
------------------
Detects mobile phones in real time using YOLOv8 (pretrained on COCO dataset).
COCO class index 67 = 'cell phone'.
Shows bounding box, confidence score, and an alert banner when a phone is visible.
"""

import cv2
from collections import deque
from ultralytics import YOLO

# COCO class index for 'cell phone'
CELL_PHONE_CLASS_ID = 67

# Confidence threshold - ignore detections below this
CONFIDENCE_THRESHOLD = 0.45

# Smoothing: rolling buffer to avoid flickering alert
SMOOTHING_WINDOW = 5


def run_phone_detection():
    """
    Initializes webcam and YOLOv8 model.
    Detects 'cell phone' objects in real time, draws bounding boxes,
    and displays an ALERT banner if a phone is found.
    Press 'q' to exit.
    """
    print("[INFO] Loading YOLOv8 model (downloads ~6MB on first run)...")
    try:
        # yolov8n.pt = nano model, fastest and lightest, auto-downloads on first use
        model = YOLO("yolov8n.pt")
    except Exception as e:
        print(f"[ERROR] Failed to load YOLO model: {e}")
        return

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Could not open webcam.")
        return

    print("[INFO] Phone Detection started. Press 'q' to quit.")

    # Rolling detection buffer: True if phone detected in that frame
    detection_buf = deque(maxlen=SMOOTHING_WINDOW)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to read frame.")
            break

        # Mirror for natural webcam feel
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        # Run YOLOv8 inference on the frame (verbose=False suppresses console spam)
        results = model(frame, verbose=False)

        phone_detected = False

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])

                if cls_id == CELL_PHONE_CLASS_ID and conf >= CONFIDENCE_THRESHOLD:
                    phone_detected = True

                    # Extract bounding box coordinates
                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    # Draw red bounding box
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)

                    # Label with class name and confidence
                    label = f"Cell Phone  {int(conf * 100)}%"
                    (tw, th), _ = cv2.getTextSize(
                        label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
                    )
                    label_y = y1 - 10 if y1 - 10 > 15 else y1 + th + 10
                    cv2.rectangle(frame, (x1, label_y - th - 6),
                                  (x1 + tw + 6, label_y + 4), (0, 0, 200), -1)
                    cv2.putText(frame, label, (x1 + 3, label_y),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # Update smoothing buffer
        detection_buf.append(phone_detected)

        # Use majority vote to decide whether to show the alert
        smoothed_alert = sum(detection_buf) > (SMOOTHING_WINDOW // 2)

        if smoothed_alert:
            alert_text = "ALERT: Mobile Phone Detected!"
            (aw, ah), _ = cv2.getTextSize(
                alert_text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2
            )
            # Filled red banner at the top
            cv2.rectangle(frame, (15, 12), (15 + aw + 12, 12 + ah + 12),
                          (0, 0, 180), -1)
            cv2.putText(frame, alert_text, (21, 12 + ah + 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        else:
            cv2.putText(frame, "No Phone Detected", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        cv2.imshow("AI Exam Monitor - Phone Detection", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("[INFO] Exit key pressed. Closing feed.")
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Resources released successfully.")
