// FitPulse AI - Main Application Controller
import { exerciseRegistry, calculateAngle } from './exercises.js';
import { audioCoach } from './audioCoach.js';
import { storageManager, ACHIEVEMENTS } from './storage.js';
import { PoseEngine } from './poseEngine.js';
import { AnalyticsRenderer } from './analytics.js';

class FitPulseApp {
  constructor() {
    this.currentExercise = exerciseRegistry.getById('squats');
    this.exerciseState = { stage: 'up' };

    // Workout session state
    this.isWorkoutActive = false;
    this.sessionReps = 0;
    this.sessionHoldSeconds = 0;
    this.sessionCalories = 0.0;
    this.targetRepGoal = 0; // 0 = Free mode
    this.sessionStartTime = null;
    this.sessionElapsedSeconds = 0;
    this.timerInterval = null;
    this.holdTimerInterval = null;
    this.isCurrentlyHolding = false;

    // Last form cue time to prevent voice chatter overload
    this.lastFormCueTime = 0;

    // DOM Elements Cache
    this.dom = {
      video: document.getElementById('webcam-video'),
      canvas: document.getElementById('pose-canvas'),
      viewportBox: document.getElementById('viewport-box'),
      idleScreen: document.getElementById('idle-screen'),
      statusDot: document.getElementById('status-dot'),
      hudStatusText: document.getElementById('hud-status-text'),
      feedbackBanner: document.getElementById('hud-feedback-banner'),
      feedbackIcon: document.getElementById('feedback-icon'),
      feedbackText: document.getElementById('feedback-text'),
      hudRepCounter: document.getElementById('hud-rep-counter'),
      hudMetricTitle: document.getElementById('hud-metric-title'),
      hudGoalTag: document.getElementById('hud-goal-tag'),
      hudCalorieCounter: document.getElementById('hud-calorie-counter'),
      hudProgressBar: document.getElementById('hud-progress-bar'),
      hudProgressPct: document.getElementById('hud-progress-pct'),
      sessionTimerDisplay: document.getElementById('session-timer-display'),
      exerciseListContainer: document.getElementById('exercise-list-container'),
      guideExerciseTitle: document.getElementById('guide-exercise-title'),
      guideCategoryTag: document.getElementById('guide-category-tag'),
      guideInstructionsText: document.getElementById('guide-instructions-text'),
      guideTipsList: document.getElementById('guide-tips-list'),
      todayRepsVal: document.getElementById('today-reps-val'),
      todayCaloriesVal: document.getElementById('today-calories-val'),
      todayTimeVal: document.getElementById('today-time-val'),
      todaySessionsVal: document.getElementById('today-sessions-val'),
      todayGoalPct: document.getElementById('today-goal-pct'),
      headerStreakCount: document.getElementById('header-streak-count'),
      btnToggleSound: document.getElementById('btn-toggle-sound'),
      soundIcon: document.getElementById('sound-icon'),
      soundLabel: document.getElementById('sound-label'),
      toastContainer: document.getElementById('toast-container'),
      chartWeeklyCanvas: document.getElementById('chart-weekly-canvas'),
      chartDistributionCanvas: document.getElementById('chart-distribution-canvas'),
      chartWeekTotal: document.getElementById('chart-week-total'),
      historyTableBody: document.getElementById('history-table-body'),
      achievementsContainer: document.getElementById('achievements-container')
    };

    // Initialize engines
    this.poseEngine = new PoseEngine({
      videoElement: this.dom.video,
      canvasElement: this.dom.canvas,
      onResults: (landmarks, raw) => this.handlePoseResults(landmarks, raw),
      onError: (err) => this.showToast('⚠️ ' + err, 'warning')
    });

    this.init();
  }

  init() {
    this.renderExerciseList();
    this.updateActiveExerciseGuide();
    this.updateTodayStatsUI();
    this.setupEventListeners();
    this.loadProfileSettings();

    // Resize canvas to match display DPI
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    const rect = this.dom.viewportBox.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.dom.canvas.width = Math.min(1920, Math.round(rect.width * (window.devicePixelRatio || 1)));
      this.dom.canvas.height = Math.min(1080, Math.round(rect.height * (window.devicePixelRatio || 1)));
    }
  }

  setupEventListeners() {
    // Start Camera Button
    document.getElementById('btn-start-camera').addEventListener('click', async () => {
      this.dom.idleScreen.classList.add('hidden');
      this.dom.hudStatusText.textContent = 'Connecting Camera...';
      const ok = await this.poseEngine.startCamera();
      if (ok) {
        this.startWorkoutSession();
        this.dom.hudStatusText.textContent = 'Camera Active - Tracking Pose';
        audioCoach.speak('Camera active. Let\'s get moving!');
      } else {
        this.dom.idleScreen.classList.remove('hidden');
        this.dom.hudStatusText.textContent = 'Camera Unavailable';
      }
    });

    // Start Demo Mode Button
    document.getElementById('btn-start-demo').addEventListener('click', () => {
      this.dom.idleScreen.classList.add('hidden');
      this.poseEngine.startDemo(this.currentExercise.id);
      this.startWorkoutSession();
      this.dom.hudStatusText.textContent = 'Simulation Demo Mode Active';
      audioCoach.speak('Simulation demo started. Watch the AI counter in action!');
    });

    // Flip Camera Button
    document.getElementById('btn-switch-camera').addEventListener('click', async () => {
      if (this.poseEngine.activeMode === 'camera') {
        await this.poseEngine.switchCamera();
        this.showToast('Camera flipped', 'info');
      }
    });

    // Upload Video File for Testing
    document.getElementById('video-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileURL = URL.createObjectURL(file);
      this.dom.video.srcObject = null;
      this.dom.video.src = fileURL;
      this.dom.video.loop = true;
      this.dom.video.play();

      this.poseEngine.stop();
      this.poseEngine.activeMode = 'camera';
      this.poseEngine.isRunning = true;
      this.poseEngine.isMirrored = false;
      this.poseEngine.initMediaPipe().then(() => {
        this.poseEngine.processVideoFrame();
      });

      this.dom.idleScreen.classList.add('hidden');
      this.startWorkoutSession();
      this.dom.hudStatusText.textContent = `Analyzing Video: ${file.name}`;
      this.showToast(`Loaded test video: ${file.name}`, 'info');
    });

    // Finish / Save Workout
    document.getElementById('btn-finish-workout').addEventListener('click', () => {
      this.finishAndSaveWorkout();
    });

    // Sound / Voice Toggle
    this.dom.btnToggleSound.addEventListener('click', () => {
      const current = audioCoach.voiceEnabled;
      const next = !current;
      audioCoach.setVoiceEnabled(next);
      audioCoach.setSoundEffectsEnabled(next);

      if (next) {
        this.dom.btnToggleSound.classList.add('active');
        this.dom.soundIcon.textContent = '🔊';
        this.dom.soundLabel.textContent = 'Audio ON';
        this.showToast('Voice Coach & Audio Enabled', 'info');
      } else {
        this.dom.btnToggleSound.classList.remove('active');
        this.dom.soundIcon.textContent = '🔇';
        this.dom.soundLabel.textContent = 'Audio Muted';
        this.showToast('Audio Muted', 'info');
      }
    });

    // Goal chips selector
    document.querySelectorAll('.goal-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.goal-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const goal = parseInt(chip.getAttribute('data-goal'), 10);
        this.targetRepGoal = goal;
        this.dom.hudGoalTag.textContent = goal > 0 ? `/ ${goal}` : '/ Free';
        audioCoach.speak(goal > 0 ? `Target set to ${goal} reps` : 'Free workout mode');
      });
    });

    // Modals Open & Close
    document.getElementById('btn-open-history').addEventListener('click', () => {
      this.openAnalyticsModal();
    });

    document.getElementById('btn-open-profile').addEventListener('click', () => {
      this.openProfileModal();
    });

    document.getElementById('btn-add-exercise-modal').addEventListener('click', () => {
      document.getElementById('modal-custom-exercise').classList.add('open');
    });

    document.getElementById('btn-camera-help')?.addEventListener('click', () => {
      document.getElementById('modal-camera-troubleshoot')?.classList.add('open');
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        document.getElementById(modalId)?.classList.remove('open');
      });
    });

    // Analytics Modal Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const content = document.getElementById(tabId);
        if (content) content.style.display = 'block';

        if (tabId === 'tab-charts') {
          this.renderCharts();
        }
      });
    });

    // Profile Form Submit
    document.getElementById('profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const weight = parseFloat(document.getElementById('input-weight').value) || 70;
      const height = parseFloat(document.getElementById('input-height').value) || 175;
      const dailyReps = parseInt(document.getElementById('input-daily-reps').value, 10) || 50;
      const dailyCal = parseInt(document.getElementById('input-daily-calories').value, 10) || 150;
      const lang = document.getElementById('select-voice-lang').value;

      storageManager.saveProfile({
        weightKg: weight,
        heightCm: height,
        dailyRepGoal: dailyReps,
        dailyCalorieGoal: dailyCal,
        voiceLanguage: lang
      });

      audioCoach.setLanguage(lang);
      document.getElementById('modal-profile').classList.remove('open');
      this.updateTodayStatsUI();
      this.showToast('Profile and goals updated!', 'success');
    });

    // Custom Exercise Form Submit
    document.getElementById('custom-exercise-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateCustomExercise();
    });

    // Export Data JSON
    document.getElementById('btn-export-data').addEventListener('click', () => {
      const json = storageManager.exportDataJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fitpulse_workout_data_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Data exported successfully', 'success');
    });

    // Clear History
    document.getElementById('btn-clear-history').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your workout history? This cannot be undone.')) {
        storageManager.clearAllData();
        this.updateTodayStatsUI();
        this.openAnalyticsModal();
        this.showToast('Workout history cleared', 'info');
      }
    });
  }

  // --- Workout State & Core Loop ---

  startWorkoutSession() {
    this.isWorkoutActive = true;
    this.sessionReps = 0;
    this.sessionHoldSeconds = 0;
    this.sessionCalories = 0.0;
    this.sessionElapsedSeconds = 0;
    this.sessionStartTime = Date.now();
    this.exerciseState = { stage: this.currentExercise.isHold ? 'neutral' : 'up' };

    this.updateMetricsHUD();

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.sessionElapsedSeconds++;
      this.renderTimerDisplay();

      // For isometric exercises like Plank, increment continuous hold seconds & calories
      if (this.currentExercise.isHold && this.isCurrentlyHolding) {
        this.sessionHoldSeconds++;
        const userWeight = storageManager.profile.weightKg || 70;
        // Standard MET formula per second: (MET * 3.5 * weightKg / 200) / 60
        const calPerSec = (this.currentExercise.met * 3.5 * userWeight) / (200 * 60);
        this.sessionCalories += calPerSec;
        this.updateMetricsHUD();

        if (this.sessionHoldSeconds % 10 === 0) {
          audioCoach.playRepBeep();
          audioCoach.speak(`${this.sessionHoldSeconds} seconds held! Strong core!`);
        }
      }
    }, 1000);
  }

  renderTimerDisplay() {
    const mins = Math.floor(this.sessionElapsedSeconds / 60);
    const secs = this.sessionElapsedSeconds % 60;
    this.dom.sessionTimerDisplay.textContent = 
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  handlePoseResults(landmarks, rawResults) {
    if (!landmarks || !this.isWorkoutActive) return;

    // Evaluate pose with current exercise logic
    const evalResult = this.currentExercise.evaluate(landmarks, this.exerciseState);

    // Pass back to canvas renderer for angle badges and skeleton colors
    this.poseEngine.setEvaluationState(evalResult);

    if (!evalResult.valid) {
      this.updateFeedback(evalResult.feedback, evalResult.feedbackType || 'info');
      return;
    }

    // Update motion progress bar
    const progress = evalResult.progress || 0;
    this.dom.hudProgressBar.style.width = `${progress}%`;
    this.dom.hudProgressPct.textContent = `${progress}%`;

    // Handle feedback banner
    this.updateFeedback(evalResult.feedback, evalResult.feedbackType || 'info');

    // Handle isometric hold state
    if (this.currentExercise.isHold) {
      this.isCurrentlyHolding = !!evalResult.isHolding;
      return;
    }

    // Update state machine
    this.exerciseState.stage = evalResult.stage;

    // Check if rep was incremented!
    if (evalResult.repIncremented) {
      this.sessionReps++;
      
      // Calculate calorie burn for this rep
      const userWeight = storageManager.profile.weightKg || 70;
      // Rep calorie = (MET * 3.5 * Weight) / (200 * 60) * estimatedRepDuration (e.g. 2.5s)
      const baseRepCalories = (this.currentExercise.met * 3.5 * userWeight * 2.5) / 12000;
      this.sessionCalories += Math.max(0.15, baseRepCalories);

      this.triggerRepBumpAnimation();
      this.updateMetricsHUD();

      // Voice and sound cue
      audioCoach.announceRep(this.sessionReps, this.targetRepGoal);

      // Goal celebration
      if (this.targetRepGoal > 0 && this.sessionReps === this.targetRepGoal) {
        this.triggerCelebration();
      }
    }

    // Periodic voice form cues
    if (evalResult.feedbackType === 'warning') {
      const now = Date.now();
      if (now - this.lastFormCueTime > 4000) {
        this.lastFormCueTime = now;
        audioCoach.speakFormCue(evalResult.feedback);
      }
    }
  }

  triggerRepBumpAnimation() {
    this.dom.hudRepCounter.classList.remove('rep-bump');
    // Force reflow
    void this.dom.hudRepCounter.offsetWidth;
    this.dom.hudRepCounter.classList.add('rep-bump');
  }

  triggerCelebration() {
    if (window.confetti) {
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
    this.showToast('🎉 Goal Achieved! Magnificent Effort!', 'success');
  }

  updateFeedback(text, type = 'info') {
    this.dom.feedbackText.textContent = text;
    this.dom.feedbackBanner.className = `hud-feedback-banner ${type}`;

    if (type === 'success') {
      this.dom.feedbackIcon.textContent = '✅';
    } else if (type === 'warning') {
      this.dom.feedbackIcon.textContent = '⚠️';
    } else {
      this.dom.feedbackIcon.textContent = '💡';
    }
  }

  updateMetricsHUD() {
    if (this.currentExercise.isHold) {
      this.dom.hudMetricTitle.textContent = 'HOLD TIME';
      this.dom.hudRepCounter.textContent = `${this.sessionHoldSeconds}s`;
    } else {
      this.dom.hudMetricTitle.textContent = 'REPETITIONS';
      this.dom.hudRepCounter.textContent = `${this.sessionReps}`;
    }
    this.dom.hudCalorieCounter.textContent = this.sessionCalories.toFixed(1);
  }

  finishAndSaveWorkout() {
    if (!this.isWorkoutActive) return;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isWorkoutActive = false;
    this.poseEngine.stop();
    this.dom.idleScreen.classList.remove('hidden');
    this.dom.hudStatusText.textContent = 'Workout Saved';

    // Save to storage
    const result = storageManager.recordSession({
      exerciseId: this.currentExercise.id,
      exerciseName: this.currentExercise.name,
      reps: this.sessionReps,
      durationSeconds: this.sessionElapsedSeconds,
      caloriesBurned: this.sessionCalories,
      isHold: this.currentExercise.isHold
    });

    if (result && result.session) {
      audioCoach.speak('Workout completed and saved. Awesome work today!');
      this.triggerCelebration();

      // Show toast
      const countLabel = this.currentExercise.isHold ? `${this.sessionHoldSeconds}s plank` : `${this.sessionReps} reps`;
      this.showToast(
        `Workout Saved: ${countLabel} | ${this.sessionCalories.toFixed(1)} kcal burned!`, 
        'success'
      );

      // Check if badges were unlocked
      if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
        result.newlyUnlocked.forEach(badge => {
          setTimeout(() => {
            this.showToast(`🏆 Badge Unlocked: ${badge.title}!`, 'success');
            audioCoach.playMilestone();
          }, 600);
        });
      }
    }

    this.updateTodayStatsUI();
  }

  // --- UI Helpers & Exercise Selector ---

  selectExercise(exerciseId) {
    const exercise = exerciseRegistry.getById(exerciseId);
    if (!exercise) return;

    this.currentExercise = exercise;
    this.exerciseState = { stage: exercise.isHold ? 'neutral' : 'up' };

    // Update sidebar styling
    document.querySelectorAll('.exercise-card').forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-id') === exerciseId);
    });

    this.updateActiveExerciseGuide();
    this.updateMetricsHUD();

    // If demo is running, switch demo simulation
    if (this.poseEngine.activeMode === 'demo') {
      this.poseEngine.startDemo(exercise.id);
    }

    audioCoach.speak(`Selected ${exercise.name}`);
  }

  renderExerciseList() {
    const exercises = exerciseRegistry.getAll();
    this.dom.exerciseListContainer.innerHTML = '';

    exercises.forEach(ex => {
      const card = document.createElement('div');
      card.className = `exercise-card ${ex.id === this.currentExercise.id ? 'active' : ''}`;
      card.setAttribute('data-id', ex.id);

      const iconEmoji = ex.icon === 'squat' ? '🦵' 
        : ex.icon === 'pushup' ? '💪'
        : ex.icon === 'jumping' ? '⭐'
        : ex.icon === 'lunge' ? '🚶'
        : ex.icon === 'plank' ? '🛡️'
        : ex.icon === 'run' ? '🏃' : '⚡';

      card.innerHTML = `
        <div class="exercise-meta">
          <div class="exercise-icon-box">${iconEmoji}</div>
          <div class="exercise-info">
            <h4>${ex.name}</h4>
            <p>${ex.hindiName || ex.category.toUpperCase()}</p>
          </div>
        </div>
        <span class="exercise-badge">${ex.met} MET</span>
      `;

      card.addEventListener('click', () => {
        this.selectExercise(ex.id);
      });

      this.dom.exerciseListContainer.appendChild(card);
    });
  }

  updateActiveExerciseGuide() {
    const ex = this.currentExercise;
    this.dom.guideExerciseTitle.textContent = ex.name;
    this.dom.guideCategoryTag.textContent = ex.category.toUpperCase();
    this.dom.guideInstructionsText.textContent = ex.instructions || 'Perform movement with controlled form.';

    this.dom.guideTipsList.innerHTML = '';
    (ex.tips || []).forEach(tip => {
      const li = document.createElement('li');
      li.textContent = tip;
      this.dom.guideTipsList.appendChild(li);
    });
  }

  updateTodayStatsUI() {
    const stats = storageManager.getStats();
    this.dom.todayRepsVal.textContent = stats.today.reps;
    this.dom.todayCaloriesVal.textContent = `${stats.today.calories} kcal`;
    this.dom.todayTimeVal.textContent = `${stats.today.minutes} min`;
    this.dom.todaySessionsVal.textContent = stats.today.sessionsCount;

    this.dom.todayGoalPct.textContent = `${stats.today.repGoalProgress}% of Rep Goal`;
    this.dom.headerStreakCount.textContent = `${stats.currentStreak} Day Streak`;
  }

  // --- Modals & Analytics ---

  openAnalyticsModal() {
    const modal = document.getElementById('modal-history');
    modal.classList.add('open');

    // Populate History Table
    const history = storageManager.history;
    this.dom.historyTableBody.innerHTML = '';

    if (history.length === 0) {
      this.dom.historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No workout sessions recorded yet. Start your first session!
          </td>
        </tr>
      `;
    } else {
      history.slice(0, 30).forEach(session => {
        const d = new Date(session.timestamp);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${dateStr}</td>
          <td style="font-weight: 600;">${session.exerciseName}</td>
          <td style="color: var(--neon-cyan); font-weight: 700;">${session.isHold ? `${session.durationSeconds}s hold` : `${session.reps} reps`}</td>
          <td style="color: var(--neon-green);">${session.caloriesBurned} kcal</td>
          <td>${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s</td>
        `;
        this.dom.historyTableBody.appendChild(tr);
      });
    }

    // Populate Achievements
    this.renderAchievements();

    // Render Charts
    setTimeout(() => this.renderCharts(), 100);
  }

  renderCharts() {
    const daysData = storageManager.getLast7DaysActivity();
    const stats = storageManager.getStats();

    const weekTotalCalories = daysData.reduce((acc, d) => acc + d.calories, 0);
    this.dom.chartWeekTotal.textContent = `${weekTotalCalories} kcal total`;

    const weeklyRenderer = new AnalyticsRenderer(this.dom.chartWeeklyCanvas);
    weeklyRenderer.renderWeeklyCalories(daysData);

    const distRenderer = new AnalyticsRenderer(this.dom.chartDistributionCanvas);
    distRenderer.renderExerciseDistribution(stats.exerciseCounts);
  }

  renderAchievements() {
    const unlockedIds = storageManager.achievements;
    this.dom.achievementsContainer.innerHTML = '';

    ACHIEVEMENTS.forEach(ach => {
      const isUnlocked = unlockedIds.includes(ach.id);
      const card = document.createElement('div');
      card.className = `badge-card ${isUnlocked ? 'unlocked' : ''}`;
      card.innerHTML = `
        <div class="badge-icon">${ach.icon}</div>
        <div class="badge-title">${ach.title}</div>
        <div class="badge-desc">${ach.description}</div>
      `;
      this.dom.achievementsContainer.appendChild(card);
    });
  }

  openProfileModal() {
    const profile = storageManager.profile;
    document.getElementById('input-weight').value = profile.weightKg;
    document.getElementById('input-height').value = profile.heightCm;
    document.getElementById('input-daily-reps').value = profile.dailyRepGoal;
    document.getElementById('input-daily-calories').value = profile.dailyCalorieGoal;
    document.getElementById('select-voice-lang').value = profile.voiceLanguage || 'en';
    document.getElementById('modal-profile').classList.add('open');
  }

  loadProfileSettings() {
    const profile = storageManager.profile;
    audioCoach.setLanguage(profile.voiceLanguage || 'en');
  }

  handleCreateCustomExercise() {
    const name = document.getElementById('custom-name').value.trim();
    const category = document.getElementById('custom-category').value;
    const jointType = document.getElementById('custom-joint').value;
    const targetAngle = parseInt(document.getElementById('custom-target-angle').value, 10) || 90;
    const met = parseFloat(document.getElementById('custom-met').value) || 6.0;
    const instructions = document.getElementById('custom-instructions').value.trim() || `Lower until joint angle reaches ${targetAngle}°`;

    const customId = 'custom_' + Date.now();

    // Create modular exercise evaluator
    const newExercise = {
      id: customId,
      name,
      hindiName: name,
      category,
      icon: 'star',
      met,
      isHold: false,
      targetMuscles: [category.toUpperCase()],
      instructions,
      tips: [`Maintain steady pace`, `Aim for ${targetAngle}° at peak`],
      evaluate: (landmarks, state) => {
        // Evaluate based on chosen joint
        let pA, pB, pC, highlightJoints;
        if (jointType === 'knee') {
          pA = landmarks[23]; // Hip
          pB = landmarks[25]; // Knee
          pC = landmarks[27]; // Ankle
          highlightJoints = [23, 25, 27];
        } else if (jointType === 'elbow') {
          pA = landmarks[11]; // Shoulder
          pB = landmarks[13]; // Elbow
          pC = landmarks[15]; // Wrist
          highlightJoints = [11, 13, 15];
        } else {
          pA = landmarks[11]; // Shoulder
          pB = landmarks[23]; // Hip
          pC = landmarks[25]; // Knee
          highlightJoints = [11, 23, 25];
        }

        if (!pA || !pB || !pC) {
          return { valid: false, feedback: 'Position body clearly in camera frame', feedbackType: 'info' };
        }

        const angle = calculateAngle(pA, pB, pC);
        const progress = Math.min(100, Math.max(0, Math.round(((165 - angle) / (165 - targetAngle)) * 100)));

        let stage = state.stage || 'up';
        let repIncremented = false;
        let feedback = `Target: ${targetAngle}°`;
        let feedbackType = 'info';

        if (angle <= targetAngle + 5) {
          stage = 'down';
          feedback = 'Depth reached! Return back';
          feedbackType = 'success';
        } else if (angle > 150 && stage === 'down') {
          stage = 'up';
          repIncremented = true;
          feedback = 'Rep completed!';
          feedbackType = 'success';
        } else if (angle > 150) {
          stage = 'up';
        }

        return {
          valid: true,
          primaryAngle: angle,
          primaryJoint: pB,
          targetAngle,
          progress,
          stage,
          repIncremented,
          feedback,
          feedbackType,
          highlightJoints
        };
      }
    };

    exerciseRegistry.register(newExercise);
    this.renderExerciseList();
    this.selectExercise(customId);

    document.getElementById('modal-custom-exercise').classList.remove('open');
    document.getElementById('custom-exercise-form').reset();
    this.showToast(`Custom Exercise "${name}" Added!`, 'success');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.fitPulseApp = new FitPulseApp();
});
