// FitPulse AI - Pose Detection Engine & Cyber-Athletic Canvas Renderer
// Powered by MediaPipe Pose with Canvas 2D skeleton visualization and synthetic demo simulation

// MediaPipe connections map
const POSE_CONNECTIONS = [
  // Torso
  [11, 12], [12, 24], [24, 23], [23, 11],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Left leg
  [23, 25], [25, 27], [27, 29], [29, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [30, 32],
  // Head / Neck
  [11, 0], [12, 0]
];

export class PoseEngine {
  constructor({ videoElement, canvasElement, onResults, onError }) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onResults = onResults;
    this.onError = onError;

    this.pose = null;
    this.cameraStream = null;
    this.activeMode = 'idle'; // 'camera' | 'demo' | 'file'
    this.facingMode = 'user';
    this.isRunning = false;

    this.demoTime = 0;
    this.demoExerciseId = 'squats';
    this.demoAnimationId = null;

    this.latestLandmarks = null;
    this.evaluationState = null;
    this.isMirrored = true;
  }

  async initMediaPipe() {
    if (this.pose) return true;

    if (!window.Pose) {
      console.error('MediaPipe Pose script not loaded in window');
      if (this.onError) this.onError('MediaPipe library not loaded yet');
      return false;
    }

    try {
      this.pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
      });

      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.pose.onResults((results) => {
        this.latestLandmarks = results.poseLandmarks || null;
        if (this.onResults) {
          this.onResults(this.latestLandmarks, results);
        }
        this.renderCanvas();
      });

      return true;
    } catch (err) {
      console.error('Error initializing MediaPipe:', err);
      if (this.onError) this.onError('Pose model setup failed: ' + err.message);
      return false;
    }
  }

  async startCamera(preferredFacingMode = 'user') {
    this.stop();
    this.facingMode = preferredFacingMode;
    this.isMirrored = this.facingMode === 'user';

    // Show native video element directly with mirror transform
    this.video.style.display = 'block';
    this.video.style.transform = this.isMirrored ? 'scaleX(-1)' : 'none';

    await this.initMediaPipe();

    // Multi-tier fallback for camera constraints
    const constraintTries = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: this.facingMode }, audio: false },
      { video: { facingMode: this.facingMode }, audio: false },
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: true, audio: false }
    ];

    let stream = null;
    for (const constraint of constraintTries) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraint);
        if (stream) break;
      } catch (err) {
        console.warn('Camera constraint attempt failed, trying fallback:', constraint, err);
      }
    }

    if (!stream) {
      const errMsg = 'Could not access camera. Please check permissions or laptop privacy shutter.';
      console.error(errMsg);
      if (this.onError) this.onError(errMsg);
      return false;
    }

    try {
      this.cameraStream = stream;
      this.video.srcObject = this.cameraStream;
      this.video.setAttribute('playsinline', '');
      this.video.setAttribute('autoplay', '');
      this.video.muted = true;

      await this.video.play().catch(e => console.warn('Video play notice:', e));

      // Wait briefly for video track dimensions to establish
      await new Promise((resolve) => {
        if (this.video.videoWidth > 0) {
          resolve();
        } else {
          this.video.onloadeddata = () => resolve();
          setTimeout(resolve, 800);
        }
      });

      this.activeMode = 'camera';
      this.isRunning = true;
      this.processVideoFrame();
      return true;
    } catch (err) {
      console.error('Camera playback error:', err);
      if (this.onError) this.onError('Camera feed error: ' + err.message);
      return false;
    }
  }

  async switchCamera() {
    const newFacing = this.facingMode === 'user' ? 'environment' : 'user';
    return await this.startCamera(newFacing);
  }

  processVideoFrame() {
    if (!this.isRunning || this.activeMode !== 'camera') return;

    if (this.video.readyState >= 2 && this.pose) {
      this.pose.send({ image: this.video }).catch((e) => {
        console.warn('Pose send error:', e);
      });
    }

    requestAnimationFrame(() => this.processVideoFrame());
  }

  /**
   * Demo Simulation Mode: Generates synthetic realistic human keypoints in a workout motion
   */
  startDemo(exerciseId = 'squats') {
    this.stop();
    this.activeMode = 'demo';
    this.isRunning = true;
    this.demoExerciseId = exerciseId;
    this.demoTime = 0;
    this.isMirrored = false;

    // Hide native webcam element so synthetic backdrop shows cleanly
    this.video.style.display = 'none';

    const animateDemo = () => {
      if (!this.isRunning || this.activeMode !== 'demo') return;

      this.demoTime += 0.045; // Speed of motion cycle
      const landmarks = this.generateSyntheticLandmarks(this.demoExerciseId, this.demoTime);
      this.latestLandmarks = landmarks;

      if (this.onResults) {
        this.onResults(landmarks, { poseLandmarks: landmarks });
      }

      this.renderCanvas();

      this.demoAnimationId = requestAnimationFrame(animateDemo);
    };

    animateDemo();
  }

  setEvaluationState(evalState) {
    this.evaluationState = evalState;
  }

  stop() {
    this.isRunning = false;
    this.activeMode = 'idle';

    if (this.demoAnimationId) {
      cancelAnimationFrame(this.demoAnimationId);
      this.demoAnimationId = null;
    }

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video.pause();
      this.video.style.display = 'none';
    }

    this.clearCanvas();
  }

  clearCanvas() {
    if (!this.canvas || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // --- Visual Rendering ---

  renderCanvas() {
    if (!this.canvas || !this.ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Clear transparent overlay
    ctx.clearRect(0, 0, width, height);

    // If simulation demo mode, render synthetic gym backdrop
    if (this.activeMode === 'demo') {
      this.renderSyntheticBackground();
    }

    // Draw cybernetic skeleton overlay on top
    if (this.latestLandmarks) {
      this.drawSkeleton(this.latestLandmarks);
    }
  }

  renderSyntheticBackground() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Futuristic gym backdrop simulation
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a101d');
    grad.addColorStop(1, '#05080f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Cyber grid floor
    ctx.strokeStyle = 'rgba(0, 245, 160, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.75);
      ctx.lineTo(x + (x - width / 2) * 0.8, height);
      ctx.stroke();
    }
    for (let y = height * 0.75; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Demo Mode Watermark Badge
    ctx.save();
    ctx.fillStyle = 'rgba(0, 217, 245, 0.15)';
    ctx.strokeStyle = '#00D9F5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 110, 25, 220, 36, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00D9F5';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🤖 SIMULATION DEMO MODE', width / 2, 43);
    ctx.restore();
  }

  drawSkeleton(landmarks) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const highlightJoints = this.evaluationState?.highlightJoints || [];
    const isSuccess = this.evaluationState?.feedbackType === 'success';
    const isWarning = this.evaluationState?.feedbackType === 'warning';

    // Helper to map normalized coordinates to canvas space with proper mirroring
    const getCanvasPoint = (pt) => {
      if (!pt) return null;
      return {
        x: this.isMirrored ? (1 - pt.x) * w : pt.x * w,
        y: pt.y * h
      };
    };

    // Skeleton bone color
    const boneColor = isWarning 
      ? 'rgba(255, 75, 114, 0.9)' 
      : isSuccess 
        ? 'rgba(0, 245, 160, 0.9)' 
        : 'rgba(0, 217, 245, 0.9)';

    // Draw bones / connections
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = boneColor;
    ctx.shadowBlur = 14;
    ctx.shadowColor = boneColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1Raw = landmarks[startIdx];
      const p2Raw = landmarks[endIdx];

      if (p1Raw && p2Raw && (p1Raw.visibility || 1) > 0.4 && (p2Raw.visibility || 1) > 0.4) {
        const p1 = getCanvasPoint(p1Raw);
        const p2 = getCanvasPoint(p2Raw);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    });
    ctx.restore();

    // Draw joints
    landmarks.forEach((ptRaw, idx) => {
      if (!ptRaw || (ptRaw.visibility || 1) < 0.4) return;
      if (idx > 0 && idx < 11) return; // Skip minor facial points for a clean athletic look

      const pt = getCanvasPoint(ptRaw);
      if (!pt) return;

      const px = pt.x;
      const py = pt.y;
      const isHighlighted = highlightJoints.includes(idx);

      ctx.save();
      if (isHighlighted) {
        // Glowing pulse ring for active joint
        ctx.shadowBlur = 20;
        ctx.shadowColor = isWarning ? '#FF4B72' : '#00F5A0';
        ctx.fillStyle = isWarning ? '#FF4B72' : '#00F5A0';

        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 13, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#00D9F5';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00D9F5';
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Draw primary angle arc & numerical badge at primary joint
    if (this.evaluationState?.primaryJoint && this.evaluationState?.primaryAngle !== undefined) {
      const pj = getCanvasPoint(this.evaluationState.primaryJoint);
      if (pj) {
        const jx = pj.x;
        const jy = pj.y;
        const angle = this.evaluationState.primaryAngle;

        ctx.save();
        // Draw Angle Badge pill (always drawn left-to-right, perfectly legible!)
        const badgeText = `${angle}°`;
        ctx.font = 'bold 15px system-ui, sans-serif';
        const textWidth = ctx.measureText(badgeText).width;
        const pad = 12;
        const boxW = textWidth + pad * 2;
        const boxH = 28;
        const bx = jx + 22;
        const by = jy - 14;

        ctx.fillStyle = 'rgba(7, 12, 24, 0.9)';
        ctx.strokeStyle = isWarning ? '#FF4B72' : '#00F5A0';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = isWarning ? '#FF4B72' : '#00F5A0';

        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        // Text inside badge
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx + boxW / 2, by + boxH / 2);

        // Arc indicator around joint
        ctx.strokeStyle = isWarning ? 'rgba(255, 75, 114, 0.8)' : 'rgba(0, 245, 160, 0.8)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(jx, jy, 24, -Math.PI / 2, (-Math.PI / 2) + ((angle / 180) * Math.PI));
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  // --- Synthetic Landmark Generators for Demo Mode ---

  generateSyntheticLandmarks(exerciseId, t) {
    const cycle = (Math.sin(t) + 1) / 2; // 0 to 1 smooth oscillation
    const landmarks = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));

    if (exerciseId === 'squats') {
      const squatDepth = cycle; // 0 = standing, 1 = deep squat
      const hipY = 0.52 + squatDepth * 0.16;
      const kneeX = 0.54 + squatDepth * 0.05;
      const kneeY = 0.74 + squatDepth * 0.06;
      const ankleX = 0.50;
      const ankleY = 0.92;

      landmarks[0] = { x: 0.46, y: 0.22 + squatDepth * 0.15, visibility: 0.99 };
      landmarks[11] = { x: 0.47, y: 0.32 + squatDepth * 0.16, visibility: 0.99 };
      landmarks[12] = { x: 0.48, y: 0.32 + squatDepth * 0.16, visibility: 0.99 };
      landmarks[13] = { x: 0.57, y: 0.34 + squatDepth * 0.16, visibility: 0.99 };
      landmarks[15] = { x: 0.67, y: 0.35 + squatDepth * 0.16, visibility: 0.99 };
      landmarks[14] = { x: 0.57, y: 0.34 + squatDepth * 0.16, visibility: 0.99 };
      landmarks[16] = { x: 0.67, y: 0.35 + squatDepth * 0.16, visibility: 0.99 };
      landmarks[23] = { x: 0.45, y: hipY, visibility: 0.99 };
      landmarks[24] = { x: 0.46, y: hipY, visibility: 0.99 };
      landmarks[25] = { x: kneeX, y: kneeY, visibility: 0.99 };
      landmarks[26] = { x: kneeX, y: kneeY, visibility: 0.99 };
      landmarks[27] = { x: ankleX, y: ankleY, visibility: 0.99 };
      landmarks[28] = { x: ankleX, y: ankleY, visibility: 0.99 };
    } else if (exerciseId === 'pushups' || exerciseId === 'plank') {
      const pushCycle = exerciseId === 'plank' ? 0.3 : cycle;
      const chestY = 0.65 + pushCycle * 0.12;

      landmarks[0] = { x: 0.26, y: chestY - 0.08, visibility: 0.99 };
      landmarks[11] = { x: 0.34, y: chestY, visibility: 0.99 };
      landmarks[12] = { x: 0.34, y: chestY, visibility: 0.99 };
      landmarks[13] = { x: 0.35, y: chestY + 0.14 - (pushCycle * 0.06), visibility: 0.99 };
      landmarks[14] = { x: 0.35, y: chestY + 0.14 - (pushCycle * 0.06), visibility: 0.99 };
      landmarks[15] = { x: 0.35, y: 0.85, visibility: 0.99 };
      landmarks[16] = { x: 0.35, y: 0.85, visibility: 0.99 };
      landmarks[23] = { x: 0.58, y: chestY + 0.02, visibility: 0.99 };
      landmarks[24] = { x: 0.58, y: chestY + 0.02, visibility: 0.99 };
      landmarks[25] = { x: 0.72, y: chestY + 0.05, visibility: 0.99 };
      landmarks[26] = { x: 0.72, y: chestY + 0.05, visibility: 0.99 };
      landmarks[27] = { x: 0.84, y: 0.82, visibility: 0.99 };
      landmarks[28] = { x: 0.84, y: 0.82, visibility: 0.99 };
    } else if (exerciseId === 'jumping-jacks') {
      const stanceSpread = cycle * 0.15;
      landmarks[0] = { x: 0.5, y: 0.18, visibility: 0.99 };
      landmarks[11] = { x: 0.44, y: 0.30, visibility: 0.99 };
      landmarks[12] = { x: 0.56, y: 0.30, visibility: 0.99 };

      const leftArmAngle = Math.PI * 0.6 + cycle * (Math.PI * 0.65);
      const rightArmAngle = Math.PI * 0.4 - cycle * (Math.PI * 0.65);

      landmarks[13] = { x: 0.44 - Math.cos(leftArmAngle) * 0.14, y: 0.30 - Math.sin(leftArmAngle) * 0.14, visibility: 0.99 };
      landmarks[15] = { x: 0.44 - Math.cos(leftArmAngle) * 0.28, y: 0.30 - Math.sin(leftArmAngle) * 0.28, visibility: 0.99 };
      landmarks[14] = { x: 0.56 + Math.cos(rightArmAngle) * 0.14, y: 0.30 - Math.sin(rightArmAngle) * 0.14, visibility: 0.99 };
      landmarks[16] = { x: 0.56 + Math.cos(rightArmAngle) * 0.28, y: 0.30 - Math.sin(rightArmAngle) * 0.28, visibility: 0.99 };

      landmarks[23] = { x: 0.46, y: 0.55, visibility: 0.99 };
      landmarks[24] = { x: 0.54, y: 0.55, visibility: 0.99 };
      landmarks[25] = { x: 0.46 - stanceSpread * 0.6, y: 0.73, visibility: 0.99 };
      landmarks[26] = { x: 0.54 + stanceSpread * 0.6, y: 0.73, visibility: 0.99 };
      landmarks[27] = { x: 0.46 - stanceSpread, y: 0.92, visibility: 0.99 };
      landmarks[28] = { x: 0.54 + stanceSpread, y: 0.92, visibility: 0.99 };
    } else {
      landmarks[0] = { x: 0.5, y: 0.2, visibility: 0.99 };
      landmarks[11] = { x: 0.42, y: 0.32, visibility: 0.99 };
      landmarks[12] = { x: 0.58, y: 0.32, visibility: 0.99 };
      landmarks[13] = { x: 0.40, y: 0.52, visibility: 0.99 };
      landmarks[15] = { x: 0.40, y: 0.72 - cycle * 0.36, visibility: 0.99 };
      landmarks[14] = { x: 0.60, y: 0.52, visibility: 0.99 };
      landmarks[16] = { x: 0.60, y: 0.72 - cycle * 0.36, visibility: 0.99 };
      landmarks[23] = { x: 0.45, y: 0.58, visibility: 0.99 };
      landmarks[24] = { x: 0.55, y: 0.58, visibility: 0.99 };
      landmarks[25] = { x: 0.45, y: 0.76, visibility: 0.99 };
      landmarks[26] = { x: 0.55, y: 0.76, visibility: 0.99 };
      landmarks[27] = { x: 0.45, y: 0.94, visibility: 0.99 };
      landmarks[28] = { x: 0.55, y: 0.94, visibility: 0.99 };
    }

    return landmarks;
  }
}
