# ⚡ WORKOUT MANIA (FitPulse AI) - Live Camera Rep Counter & Calorie Tracker

An AI-powered real-time computer vision fitness web application built with **MediaPipe Pose**, **HTML5 Canvas**, **Vanilla CSS (Cyber-Athletic Theme)**, and the **Web Audio / Speech Synthesis API**.

---

## 🚀 Key Features

### 1. 📷 Live Camera Automated Rep Counter
- Uses 33-point MediaPipe Pose estimation directly in your browser with GPU WebAssembly acceleration.
- Tracks joint angles in real time (e.g. knee flexion, elbow angles, arm abduction, spine collinearity).
- Robust state-machine logic (`UP` <-> `DOWN`) with hysteresis to prevent false triggers or double-counting.
- **Visual Pose HUD**:
  - Mirrored gym view.
  - Glowing cybernetic skeleton overlay with color-coded posture feedback.
  - Floating joint angle degrees badge (e.g. `90°`) hovering right at the active joint.
  - Real-time flexion progress bar (0% - 100%).

### 2. 🔥 Real-Time Calorie Burn Engine
- Implements scientifically backed **MET (Metabolic Equivalent of Task)** calculations:
  $$\text{Calories} = \frac{\text{MET} \times 3.5 \times \text{Weight (kg)}}{200 \times 60} \times \text{Duration (seconds)}$$
- Calibrated per repetition and continuous isometric hold duration based on your custom body weight.

### 3. 🏋️ Supported Freehand Exercises
1. **Bodyweight Squats (उठक-बैठक)**: Tracks hip-knee-ankle angle (standing 170° down to <= 90° deep squat).
2. **Push-ups (पुश-अप्स)**: Tracks elbow angle (160° down to 90°) with spine posture sagging detection.
3. **Jumping Jacks (जंपिंग जैक)**: Tracks arm abduction angle and wide foot stance ratio.
4. **Lunges (लंजेस)**: Front knee bend depth tracking.
5. **High Knees (हाई नीज़)**: Tracks hip flexor knee elevation above waist level.
6. **Plank Hold (प्लैंक होल्ड)**: Isometric timer holding with straight-spine alignment detection and continuous calorie burn.
7. **Arm Flex / Freehand Curls (आर्म कर्ल्स)**: Tracks elbow flexion and bicep contraction.

### 4. ➕ Easy Extensibility ("Baadme naye exercises add krne ke liye")
- **In-App Exercise Creator**: Click the **"+ Add Custom"** button to create new exercises directly from the UI with custom angles, tracked joints, and MET values.
- **Code Extensibility**: Add any new exercise in `src/exercises.js` by simply calling `exerciseRegistry.register({ ... })`.

### 5. 🗣️ Voice Coach & Audio Feedback
- **Web Audio Synthesizer**: Crystal bell chime on each rep, fanfare chord on milestones (5, 10, 15 reps), and celebration victory chime.
- **Voice Coach (Web Speech API)**: Speaks rep numbers and encouragement.
- **Language Mode**: Choose between **English** or **Hinglish / Hindi Friendly** ("शाबाश! बढ़िया गति!").

### 6. 📊 Progress Tracking, Streaks & Badges
- **Today's Summary**: Reps, Calories, Workout Time, and Sessions completed.
- **Daily Streak**: Tracks consecutive workout days.
- **Interactive Analytics**:
  - Weekly Calorie Burn bar chart (past 7 days).
  - Exercise Reps Distribution chart.
  - Full Workout Session History log table.
- **Achievements & Badges**: Unlock badges like *First Step*, *Century Club (100 Reps)*, *Calorie Crusher*, *Squat Master*, and *Iron Core*.
- **Data Persistence**: Stored safely in browser `localStorage` with **Export JSON** and **Import** options.

### 7. 🤖 Simulation Demo & Video Upload
- **Simulation Demo Mode**: Test all rep counters, calorie burn formulas, audio cues, and charts with realistic synthetic human workout motion animations even without a camera.
- **Video Upload**: Test custom workout video files from your computer.

---

## 🏃 Running the Application

To run the app locally:
```bash
cd fitpulse
node server.js
```
Then open: **`http://localhost:3000`** in your browser (Google Chrome, Microsoft Edge, or Mozilla Firefox).
