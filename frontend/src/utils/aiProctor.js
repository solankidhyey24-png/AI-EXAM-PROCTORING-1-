import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

export class AIProctor {
  constructor(onViolation) {
    this.onViolation = onViolation;
    this.faceLandmarker = null;
    this.cocoSsdModel = null;
    this.lastVideoTime = -1;
    this.lastPhoneCheckTime = 0;
    this.running = false;
    this.suspicionScore = 0;
    
    // Cooldown trackers so we don't spam the server
    this.lastSentTime = {};
    this.COOLDOWN_MS = 3000;

    // Reusable canvas for screenshots (avoids GC pressure)
    this._screenshotCanvas = null;
    this._screenshotCtx = null;
    // Max screenshot dimension for upload efficiency
    this.SCREENSHOT_MAX_WIDTH = 640;
    this.SCREENSHOT_QUALITY = 0.5;

    // Tab/window visibility tracking
    this._onVisibilityChange = this._handleVisibilityChange.bind(this);
    this._onWindowBlur = this._handleWindowBlur.bind(this);
    this._onWindowFocus = this._handleWindowFocus.bind(this);
    this._windowHidden = false;
    this._videoElement = null;
  }

  async initialize() {
    console.log("[AI] Loading Web AI Models...");
    
    // Default to CPU for stability (WebGL can conflict between TF.js and MediaPipe)
    await tf.setBackend('cpu');
    await tf.ready();
    console.log("[AI] TensorFlow.js Ready on", tf.getBackend());

    try {
      console.log("[AI] Loading MediaPipe Vision wasm...");
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm");
      
      console.log("[AI] Loading COCO-SSD Phone Detector...");
      this.cocoSsdModel = await cocoSsd.load();
      console.log("[AI] COCO-SSD Loaded.");

      console.log("[AI] Building FaceLandmarker Task...");
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "CPU"
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 2
      });
      console.log("[AI] FaceLandmarker Loaded.");

      console.log("[AI] Proctor initialized successfully.");
    } catch (err) {
      console.error("[AI] Fatal Initialization Error:", err);
      throw err;
    }
  }

  start(videoElement) {
    this.running = true;
    this._videoElement = videoElement;
    this._startVisibilityTracking();
    this.analyzeLoop(videoElement);
  }

  stop() {
    this.running = false;
    this._stopVisibilityTracking();
  }

  // ── Tab switch / window minimize detection ─────────────────────────────
  _startVisibilityTracking() {
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('blur', this._onWindowBlur);
    window.addEventListener('focus', this._onWindowFocus);
    console.log('[AI] Tab/window visibility tracking active.');
  }

  _stopVisibilityTracking() {
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('blur', this._onWindowBlur);
    window.removeEventListener('focus', this._onWindowFocus);
  }

  _handleVisibilityChange() {
    if (document.hidden) {
      console.log('[AI] Tab switched away (visibility API)');
      this._fireTabSwitchViolation();
    }
  }

  _handleWindowBlur() {
    // Fires when the window loses focus (e.g. alt-tab, clicking another app)
    if (!this._windowHidden) {
      this._windowHidden = true;
      console.log('[AI] Window lost focus (blur)');
      this._fireTabSwitchViolation();
    }
  }

  _handleWindowFocus() {
    this._windowHidden = false;
  }

  _fireTabSwitchViolation() {
    if (!this.running) return;

    const violation = 'tab_switch';
    this.suspicionScore = Math.min(this.suspicionScore + 5, 100);

    const now = Date.now();
    if (this.lastSentTime[violation] && (now - this.lastSentTime[violation]) < this.COOLDOWN_MS) {
      return; // Cooldown active
    }
    this.lastSentTime[violation] = now;

    // Capture a screenshot if video element is available
    if (this._videoElement) {
      this.captureScreenshot(this._videoElement).then(blob => {
        this.onViolation({
          event_type: violation,
          suspicion_score: this.suspicionScore,
          image_blob: blob
        });
      });
    } else {
      this.onViolation({
        event_type: violation,
        suspicion_score: this.suspicionScore,
        image_blob: null
      });
    }
  }

  async analyzeLoop(videoElement) {
    if (!this.running || !this.faceLandmarker || !this.cocoSsdModel) return;

    // Skip analysis when tab is hidden — camera feed is frozen anyway
    if (!document.hidden) {
      const now = performance.now();

      if (videoElement.readyState >= 2 && videoElement.currentTime !== this.lastVideoTime && videoElement.videoWidth > 0) {
        this.lastVideoTime = videoElement.currentTime;
        try {
          // 1. Face Detection via MediaPipe
          const faceResults = this.faceLandmarker.detectForVideo(videoElement, now);
          
          // 2. Phone Detection via TF.js COCO-SSD (Throttled to ~1 fps to save CPU)
          let phoneDetected = false;
          if (now - this.lastPhoneCheckTime > 1000) {
              this.lastPhoneCheckTime = now;
              const predictions = await this.cocoSsdModel.detect(videoElement);
              for (let i = 0; i < predictions.length; i++) {
                  if (predictions[i].class === 'cell phone' && predictions[i].score > 0.5) {
                      phoneDetected = true;
                      break;
                  }
              }
          }
          
          this.processResults(faceResults, phoneDetected, videoElement);
        } catch (err) {
          // Avoid console noise in production
        }
      }
    }
    
    // Throttle to roughly ~10 FPS to save CPU
    setTimeout(() => {
      requestAnimationFrame(() => this.analyzeLoop(videoElement));
    }, 100);
  }

  captureScreenshot(videoElement) {
    return new Promise((resolve) => {
        try {
            const srcW = videoElement.videoWidth;
            const srcH = videoElement.videoHeight;
            if (!srcW || !srcH) { resolve(null); return; }

            // Downscale to max 640px width for smaller uploads (~75% size reduction)
            const scale = Math.min(1, this.SCREENSHOT_MAX_WIDTH / srcW);
            const dstW = Math.round(srcW * scale);
            const dstH = Math.round(srcH * scale);

            // Reuse canvas to avoid creating a new DOM element per screenshot
            if (!this._screenshotCanvas) {
                this._screenshotCanvas = document.createElement('canvas');
                this._screenshotCtx = this._screenshotCanvas.getContext('2d');
            }
            this._screenshotCanvas.width = dstW;
            this._screenshotCanvas.height = dstH;
            this._screenshotCtx.drawImage(videoElement, 0, 0, dstW, dstH);
            this._screenshotCanvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', this.SCREENSHOT_QUALITY);
        } catch(e) {
            resolve(null);
        }
    });
  }

  processResults(faceResults, phoneDetected, videoElement) {
    let violation = null;

    if (phoneDetected) {
      violation = "phone_detected";
    } else if (!faceResults.faceLandmarks || faceResults.faceLandmarks.length === 0) {
      violation = "no_face";
    } else if (faceResults.faceLandmarks.length > 1) {
      violation = "multiple_faces";
    } else if (faceResults.facialTransformationMatrixes && faceResults.facialTransformationMatrixes.length > 0) {
      // MediaPipe uses a 4x4 column-major transformation matrix
      const matrix = faceResults.facialTransformationMatrixes[0].data;
      
      // Extract Euler angles (pitch, yaw)
      const yaw = Math.atan2(matrix[8], matrix[10]);
      const pitch = Math.atan2(-matrix[9], Math.sqrt(matrix[8]*matrix[8] + matrix[10]*matrix[10]));
      
      // Convert to degrees
      const yawDeg = yaw * (180 / Math.PI);
      const pitchDeg = pitch * (180 / Math.PI);

      // Check heuristics for Looking Away or Head Turned
      if (Math.abs(yawDeg) > 25) {
         violation = "head_turned"; // Looking side to side
      } else if (pitchDeg > 20 || pitchDeg < -15) {
         violation = "looking_away"; // Looking up or down (e.g. at a phone)
      }
    }

    if (violation) {
       this.suspicionScore = Math.min(this.suspicionScore + 2, 100);
       
       const now = Date.now();
       if (!this.lastSentTime[violation] || (now - this.lastSentTime[violation]) > this.COOLDOWN_MS) {
           this.lastSentTime[violation] = now;
           
           this.captureScreenshot(videoElement).then(blob => {
               this.onViolation({
                 event_type: violation,
                 suspicion_score: this.suspicionScore,
                 image_blob: blob
               });
           });
       }
    } else {
       // Cool down the suspicion score gradually if they are behaving
       this.suspicionScore = Math.max(this.suspicionScore - 0.5, 0); 
    }
  }
}
