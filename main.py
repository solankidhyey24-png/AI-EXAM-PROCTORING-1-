"""
main.py
-------
AI Exam Monitoring System — Step 10 + Integration Step 4
Combined real-time monitoring with:
  - Face presence & count
  - Gaze direction
  - Head pose
  - Mobile phone detection
  - Live on-screen warnings (WarningOverlay)
  - Violation logging (exam_log.txt)
  - Suspicion score bar (0–100)
  - Server event sending (EventSender → POST /send_event)

Press 'q' to exit.  
"""

import os
import urllib.request
import cv2
import numpy as np
import mediapipe as mp
import time
import threading
import requests
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from collections import deque
from ultralytics import YOLO

from modules.violation_logger   import ViolationLogger
from modules.warning_overlay    import WarningOverlay
from modules.suspicion_scorer   import SuspicionScorer
from modules.event_sender       import EventSender

# ── Model paths ──────────────────────────────────────────────────────────────
FACE_LANDMARKER_URL  = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
FACE_LANDMARKER_PATH = "face_landmarker.task"
FACE_DETECTOR_URL    = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
FACE_DETECTOR_PATH   = "blaze_face_short_range.tflite"

CELL_PHONE_CLASS_ID = 67
CONF_THRESHOLD      = 0.45
SMOOTHING           = 5
GAZE_PERSIST_FRAMES = 30

# ── solvePnP reference face ───────────────────────────────────────────────────
FACE_3D_POINTS = np.array([
    [0.,    0.,    0.  ],
    [0.,   -330., -65. ],
    [-225., 170., -135.],
    [225.,  170., -135.],
    [-150.,-150., -125.],
    [150., -150., -125.],
], dtype=np.float64)
PNP_INDICES = [1, 152, 226, 446, 57, 287]

RIGHT_IRIS        = [469, 470, 471, 472]
RIGHT_EYE_CORNERS = [33, 133]
RIGHT_EYE_TB      = [159, 145]


def _download(url, path):
    if not os.path.exists(path):
        print(f"[INFO] Downloading {os.path.basename(path)}…")
        urllib.request.urlretrieve(url, path)


def _lm(lms, idx, w, h):
    return np.array([lms[idx].x * w, lms[idx].y * h])


def get_gaze(lms, w, h):
    iris_c = np.mean([_lm(lms, i, w, h) for i in RIGHT_IRIS], axis=0)
    inner  = _lm(lms, RIGHT_EYE_CORNERS[0], w, h)
    outer  = _lm(lms, RIGHT_EYE_CORNERS[1], w, h)
    top    = _lm(lms, RIGHT_EYE_TB[0],      w, h)
    bottom = _lm(lms, RIGHT_EYE_TB[1],      w, h)
    ew = np.linalg.norm(outer - inner)
    eh = np.linalg.norm(bottom - top)
    if ew == 0 or eh == 0:
        return "Center"
    hr = np.linalg.norm(iris_c - inner) / ew
    vr = np.linalg.norm(iris_c - top)   / eh
    if hr < 0.42:  return "Right"
    if hr > 0.58:  return "Left"
    if vr > 0.70:  return "Down"
    return "Center"


def get_head_pose(lms, w, h):
    pts2d = np.array([[lms[i].x * w, lms[i].y * h] for i in PNP_INDICES], dtype=np.float64)
    cam   = np.array([[w, 0, w/2], [0, w, h/2], [0, 0, 1]], dtype=np.float64)
    ok, rvec, _ = cv2.solvePnP(FACE_3D_POINTS, pts2d, cam,
                                np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok:
        return "Forward"
    rmat, _ = cv2.Rodrigues(rvec)
    sy    = np.sqrt(rmat[0,0]**2 + rmat[1,0]**2)
    pitch = np.degrees(np.arctan2(-rmat[2,0], sy))
    yaw   = np.degrees(np.arctan2( rmat[1,0], rmat[0,0]))
    if   yaw   >  15: return "Left"
    elif yaw   < -15: return "Right"
    elif pitch >  15: return "Down"
    elif pitch < -15: return "Up"
    return "Forward"


# ── Evidence Upload ───────────────────────────────────────────────────────────
last_uploaded_time = {}
EVIDENCE_MAX_WIDTH = 640       # Downscale to this width before uploading
EVIDENCE_JPEG_QUALITY = 60     # Lower quality = smaller files, still readable
EVIDENCE_COOLDOWN = 5.0        # Seconds between uploads of same event type

def upload_evidence(student_id, exam_id, event_type, frame):
    current_time = time.time()
    
    # Cooldown System — prevent upload spam
    last_time = last_uploaded_time.get(event_type, 0)
    if current_time - last_time < EVIDENCE_COOLDOWN:
        return
        
    last_uploaded_time[event_type] = current_time

    # Downscale frame for smaller uploads (copy to prevent threading issues)
    h, w = frame.shape[:2]
    if w > EVIDENCE_MAX_WIDTH:
        scale = EVIDENCE_MAX_WIDTH / w
        new_w = int(w * scale)
        new_h = int(h * scale)
        frame_copy = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        frame_copy = frame.copy()

    def _do_upload():
        try:
            # Encode with reduced quality for smaller file size
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, EVIDENCE_JPEG_QUALITY]
            ret, buffer = cv2.imencode('.jpg', frame_copy, encode_params)
            if not ret:
                return
            
            image_bytes = buffer.tobytes()
            
            url = "http://127.0.0.1:8000/upload_evidence"
            payload = {
                'student_id': str(student_id),
                'exam_id': str(exam_id),
                'event_type': event_type
            }
            files = {
                'image': (f'ev_{int(current_time)}.jpg', image_bytes, 'image/jpeg')
            }
            
            resp = requests.post(url, data=payload, files=files, timeout=5)
            if resp.status_code != 200:
                print(f"[ERROR] Evidence upload failed: {resp.text}")
        except Exception as e:
            print(f"[ERROR] Evidence upload thread error: {e}")

    # Non-Blocking Execution
    threading.Thread(target=_do_upload, daemon=True).start()


def draw_hud(frame, face_count, gaze, head):
    lines = [
        (f"Faces : {face_count}", (255, 255, 255)),
        (f"Gaze  : {gaze}",  (0, 200, 0) if gaze == "Center"  else (0, 165, 255)),
        (f"Head  : {head}",  (0, 200, 0) if head == "Forward" else (0, 165, 255)),
    ]
    for i, (txt, col) in enumerate(lines):
        cv2.putText(frame, txt, (15, 35 + i * 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.72, col, 2, cv2.LINE_AA)


def _resolve_ids(base_url: str = "http://127.0.0.1:8000") -> tuple[int, int]:
    """
    Ask the user for their name and exam code, then call POST /join_exam
    to get the real student_id and exam_id from the backend.
    This ensures main.py always uses the same IDs as the browser.
    """
    import requests as _req
    print("\n" + "="*55)
    print("  AI Exam Monitor — Identify Yourself")
    print("="*55)
    name      = input("  Enter your FULL NAME (same as in the browser): ").strip()
    exam_code = input("  Enter the EXAM CODE  (same as in the browser): ").strip().upper()

    try:
        resp = _req.post(
            f"{base_url}/join_exam",
            json={"name": name, "exam_code": exam_code},
            timeout=5,
        )
        if resp.status_code != 200:
            print(f"[ERROR] Server rejected join: {resp.json().get('detail', resp.text)}")
            raise SystemExit(1)
        data = resp.json()
        sid, eid = data["student_id"], data["exam_id"]
        print(f"\n  ✓ Joined!  student_id={sid}  exam_id={eid}\n")
        return sid, eid
    except _req.RequestException as exc:
        print(f"[ERROR] Cannot reach backend at {base_url}: {exc}")
        print("[TIP]  Make sure the backend is running first.")
        raise SystemExit(1)


def main():
    # ── Resolve real IDs from the backend (no more hardcoded values) ────────
    STUDENT_ID, EXAM_ID = _resolve_ids()

    _download(FACE_LANDMARKER_URL, FACE_LANDMARKER_PATH)
    _download(FACE_DETECTOR_URL,   FACE_DETECTOR_PATH)

    lm_opts = vision.FaceLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=FACE_LANDMARKER_PATH),
        num_faces=1, min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5, min_tracking_confidence=0.5,
    )
    fd_opts = vision.FaceDetectorOptions(
        base_options=python.BaseOptions(model_asset_path=FACE_DETECTOR_PATH),
        min_detection_confidence=0.5,
    )
    landmarker = vision.FaceLandmarker.create_from_options(lm_opts)
    face_det   = vision.FaceDetector.create_from_options(fd_opts)

    print("[INFO] Loading YOLOv8 model…")
    yolo = YOLO("yolov8n.pt")

    # Try to open the webcam with retries (browser may still be releasing it)
    cap = None
    for attempt in range(1, 6):
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            ret_test, _ = cap.read()
            if ret_test:
                print(f"[INFO] Camera opened successfully (attempt {attempt})")
                break
        print(f"[WARN] Camera not ready, retrying ({attempt}/5)...")
        if cap:
            cap.release()
        import time as _time
        _time.sleep(2)
    else:
        print("[ERROR] Cannot open webcam after 5 attempts.")
        print("[TIP]  Close any browser tabs using the camera, then try again.")
        return

    logger         = ViolationLogger()
    overlay        = WarningOverlay(hold_seconds=2.0)
    scorer         = SuspicionScorer()
    sender         = EventSender(student_id=STUDENT_ID, exam_id=EXAM_ID)
    face_cnt_buf   = deque(maxlen=SMOOTHING)
    phone_buf      = deque(maxlen=SMOOTHING)
    gaze_off_count = 0

    logger.log_raw("=== Monitoring Session Active ===")
    print("[INFO] Monitoring started — Press 'q' to quit.")
    print("[INFO] Violations → exam_log.txt")
    print(f"[INFO] Events → backend (student={STUDENT_ID}, exam={EXAM_ID})")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame  = cv2.flip(frame, 1)
        h, w   = frame.shape[:2]
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        # ── 1. Face count ─────────────────────────────────────────────────────
        fd_res    = face_det.detect(mp_img)
        raw_faces = len(fd_res.detections) if fd_res.detections else 0
        face_cnt_buf.append(raw_faces)
        face_count = round(sum(face_cnt_buf) / len(face_cnt_buf))

        for det in (fd_res.detections or []):
            bb    = det.bounding_box
            x, y  = max(0, int(bb.origin_x)), max(0, int(bb.origin_y))
            color = (0, 0, 255) if face_count > 1 else (0, 200, 0)
            cv2.rectangle(frame, (x, y),
                          (min(w, x + int(bb.width)), min(h, y + int(bb.height))),
                          color, 2)

        # ── 2. Landmark-based detections ──────────────────────────────────────
        lm_res    = landmarker.detect(mp_img)
        gaze_text = "N/A"
        head_text = "N/A"

        if lm_res.face_landmarks:
            lms = lm_res.face_landmarks[0]

            if len(lms) >= 478:
                gaze_text = get_gaze(lms, w, h)
                if gaze_text in ("Left", "Right"):
                    gaze_off_count += 1
                    scorer.add_violation("looking_away")
                    if gaze_off_count >= GAZE_PERSIST_FRAMES:
                        logger.log(f"Looking {gaze_text} Too Long")
                        overlay.add("\u26a0 WARNING: Look at the Screen")
                        sender.send("looking_away", scorer.score)
                        upload_evidence(STUDENT_ID, EXAM_ID, "looking_away", frame)
                        gaze_off_count = 0
                else:
                    gaze_off_count = 0

            head_text = get_head_pose(lms, w, h)
            if head_text != "Forward":
                scorer.add_violation("head_turned")
                logger.log("Head Turned Away")
                overlay.add("\u26a0 WARNING: Look at the Screen")
                sender.send("head_turned", scorer.score)
                upload_evidence(STUDENT_ID, EXAM_ID, "head_turned", frame)

        # ── 3. Phone detection ────────────────────────────────────────────────
        yolo_res    = yolo(frame, verbose=False)
        phone_found = False
        for r in yolo_res:
            for box in r.boxes:
                if int(box.cls[0]) == CELL_PHONE_CLASS_ID and float(box.conf[0]) >= CONF_THRESHOLD:
                    phone_found = True
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    label = f"Phone {int(float(box.conf[0]) * 100)}%"
                    cv2.putText(frame, label, (x1, y1 - 8),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)

        phone_buf.append(phone_found)
        if sum(phone_buf) > SMOOTHING // 2:
            scorer.add_violation("phone_detected")
            logger.log("Mobile Phone Detected")
            overlay.add("\u26a0 WARNING: Mobile Phone Detected")
            sender.send("phone_detected", scorer.score)
            upload_evidence(STUDENT_ID, EXAM_ID, "phone_detected", frame)

        # ── 4. Face-count violations ──────────────────────────────────────────
        if face_count == 0:
            scorer.add_violation("no_face")
            logger.log("No Face Detected")
            overlay.add("\u26a0 WARNING: Face Not Visible")
            sender.send("no_face", scorer.score)
        elif face_count > 1:
            scorer.add_violation("multiple_people")
            logger.log("Multiple People Detected")
            overlay.add("\u26a0 WARNING: Multiple People Detected")
            sender.send("multiple_faces", scorer.score)
            upload_evidence(STUDENT_ID, EXAM_ID, "multiple_faces", frame)

        # ── 5. Tick scorer (apply increments + decay) ─────────────────────────
        scorer.tick()

        # ── 6. Log HIGH SUSPICION crossings ──────────────────────────────────
        if scorer.is_high:
            logger.log("HIGH SUSPICION DETECTED")

        # ── 7. Render ─────────────────────────────────────────────────────────
        draw_hud(frame, face_count, gaze_text, head_text)
        scorer.draw(frame)     # score bar + optional HIGH SUSPICION label (top-right)
        overlay.draw(frame)    # warning banners (bottom)

        cv2.imshow("AI Exam Monitor - Step 10: Suspicion Score", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    logger.log_raw(f"=== Session Ended | Final Score: {scorer.score} ===")
    cap.release()
    cv2.destroyAllWindows()
    print(f"[INFO] Session ended. Log → '{logger.log_file}' | Final Score: {scorer.score}")


if __name__ == "__main__":
    main()
