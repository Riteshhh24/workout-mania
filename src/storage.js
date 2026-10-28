// FitPulse AI - Storage & Progress Tracking System
// Manages user profile, workout history, daily streaks, and achievement badges

const STORAGE_KEYS = {
  PROFILE: 'fitpulse_user_profile',
  HISTORY: 'fitpulse_workout_history',
  ACHIEVEMENTS: 'fitpulse_achievements'
};

const DEFAULT_PROFILE = {
  name: 'Athlete',
  weightKg: 70,
  heightCm: 175,
  age: 26,
  gender: 'male',
  dailyRepGoal: 50,
  dailyCalorieGoal: 150,
  soundEffects: true,
  voiceEnabled: true,
  voiceLanguage: 'en',
  theme: 'cyber-dark'
};

export const ACHIEVEMENTS = [
  {
    id: 'first_rep',
    title: 'First Step',
    hindiTitle: 'शुरुआत',
    description: 'Complete your first workout session',
    icon: '⚡',
    check: (history, stats) => history.length >= 1
  },
  {
    id: 'reps_50',
    title: 'Warmup Hero',
    hindiTitle: 'हाफ सेंचुरी',
    description: 'Complete 50 total reps',
    icon: '🔥',
    check: (history, stats) => stats.totalReps >= 50
  },
  {
    id: 'century_club',
    title: 'Century Club',
    hindiTitle: 'सेंचुरी क्लब',
    description: 'Complete 100 total reps',
    icon: '💯',
    check: (history, stats) => stats.totalReps >= 100
  },
  {
    id: 'calorie_100',
    title: 'Calorie Crusher',
    hindiTitle: 'कैलोरी बर्नर',
    description: 'Burn 100+ calories in total',
    icon: '🚀',
    check: (history, stats) => stats.totalCalories >= 100
  },
  {
    id: 'squat_master',
    title: 'Squat Master',
    hindiTitle: 'स्क्वैट्स उस्ताद',
    description: 'Perform 30 squats in a single session',
    icon: '🦵',
    check: (history) => history.some(s => s.exerciseId === 'squats' && s.reps >= 30)
  },
  {
    id: 'pushup_pro',
    title: 'Push-up Titan',
    hindiTitle: 'पुश-अप सम्राट',
    description: 'Perform 20 push-ups in a single session',
    icon: '💪',
    check: (history) => history.some(s => s.exerciseId === 'pushups' && s.reps >= 20)
  },
  {
    id: 'iron_plank',
    title: 'Iron Core',
    hindiTitle: 'फौलादी कोर',
    description: 'Hold a plank for 45+ seconds in one set',
    icon: '🛡️',
    check: (history) => history.some(s => s.exerciseId === 'plank' && s.durationSeconds >= 45)
  },
  {
    id: 'streak_3',
    title: 'Streak Warrior',
    hindiTitle: 'स्ट्राइक वॉरियर',
    description: 'Work out for 3 consecutive days',
    icon: '⭐',
    check: (history, stats) => stats.currentStreak >= 3
  }
];

class StorageManager {
  constructor() {
    this.profile = this.loadProfile();
    this.history = this.loadHistory();
    this.achievements = this.loadAchievements();
  }

  // --- Profile Management ---

  loadProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return data ? { ...DEFAULT_PROFILE, ...JSON.parse(data) } : { ...DEFAULT_PROFILE };
    } catch (e) {
      console.warn('Could not read profile from storage, using defaults', e);
      return { ...DEFAULT_PROFILE };
    }
  }

  saveProfile(updatedProfile) {
    this.profile = { ...this.profile, ...updatedProfile };
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(this.profile));
    } catch (e) {
      console.error('Failed to save profile', e);
    }
    return this.profile;
  }

  // --- History Management ---

  loadHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Could not read history from storage', e);
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(this.history));
    } catch (e) {
      console.error('Failed to save history', e);
    }
  }

  recordSession({ exerciseId, exerciseName, reps, durationSeconds, caloriesBurned, isHold = false }) {
    if ((!isHold && reps <= 0) || (isHold && durationSeconds < 3)) {
      return null; // Ignore trivial accidental taps
    }

    const session = {
      id: 'session_' + Date.now(),
      timestamp: new Date().toISOString(),
      dateKey: this.getLocalDateKey(new Date()),
      exerciseId,
      exerciseName,
      reps: isHold ? 0 : reps,
      durationSeconds: Math.round(durationSeconds),
      caloriesBurned: parseFloat(caloriesBurned.toFixed(2)),
      isHold
    };

    this.history.unshift(session);
    // Retain up to 250 recent sessions to prevent unbounded storage growth
    if (this.history.length > 250) {
      this.history = this.history.slice(0, 250);
    }
    this.saveHistory();

    const newlyUnlocked = this.checkAchievements();
    return { session, newlyUnlocked };
  }

  // --- Achievements & Badges ---

  loadAchievements() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveAchievements() {
    try {
      localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(this.achievements));
    } catch (e) {
      console.error('Failed to save achievements', e);
    }
  }

  checkAchievements() {
    const stats = this.getStats();
    const newlyUnlocked = [];

    ACHIEVEMENTS.forEach(ach => {
      if (!this.achievements.includes(ach.id)) {
        if (ach.check(this.history, stats)) {
          this.achievements.push(ach.id);
          newlyUnlocked.push(ach);
        }
      }
    });

    if (newlyUnlocked.length > 0) {
      this.saveAchievements();
    }
    return newlyUnlocked;
  }

  // --- Analytics & Statistics Calculations ---

  getLocalDateKey(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getStats() {
    let totalReps = 0;
    let totalCalories = 0;
    let totalSeconds = 0;
    const datesSet = new Set();
    const exerciseCounts = {};

    this.history.forEach(s => {
      totalReps += (s.reps || 0);
      totalCalories += (s.caloriesBurned || 0);
      totalSeconds += (s.durationSeconds || 0);
      if (s.dateKey) datesSet.add(s.dateKey);

      exerciseCounts[s.exerciseId] = (exerciseCounts[s.exerciseId] || 0) + (s.reps || Math.round(s.durationSeconds / 5));
    });

    const currentStreak = this.calculateStreak(datesSet);

    // Today's stats
    const todayKey = this.getLocalDateKey(new Date());
    const todaySessions = this.history.filter(s => s.dateKey === todayKey);
    const todayReps = todaySessions.reduce((acc, s) => acc + (s.reps || 0), 0);
    const todayCalories = todaySessions.reduce((acc, s) => acc + (s.caloriesBurned || 0), 0);
    const todaySeconds = todaySessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

    return {
      totalReps,
      totalCalories: Math.round(totalCalories),
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
      currentStreak,
      totalWorkouts: this.history.length,
      exerciseCounts,
      today: {
        reps: todayReps,
        calories: Math.round(todayCalories),
        seconds: todaySeconds,
        minutes: Math.round(todaySeconds / 60),
        sessionsCount: todaySessions.length,
        repGoalProgress: Math.min(100, Math.round((todayReps / (this.profile.dailyRepGoal || 1)) * 100)),
        calorieGoalProgress: Math.min(100, Math.round((todayCalories / (this.profile.dailyCalorieGoal || 1)) * 100))
      }
    };
  }

  calculateStreak(datesSet) {
    if (datesSet.size === 0) return 0;

    let streak = 0;
    const now = new Date();
    const todayKey = this.getLocalDateKey(now);

    // If worked out today, start from today; otherwise if worked out yesterday, start from yesterday
    let checkDate = new Date(now);
    let checkKey = this.getLocalDateKey(checkDate);

    if (!datesSet.has(checkKey)) {
      // Check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
      checkKey = this.getLocalDateKey(checkDate);
      if (!datesSet.has(checkKey)) {
        return 0; // Streak broken
      }
    }

    while (datesSet.has(checkKey)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      checkKey = this.getLocalDateKey(checkDate);
    }

    return streak;
  }

  /**
   * Returns data for the last 7 days for charting
   */
  getLast7DaysActivity() {
    const days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = this.getLocalDateKey(d);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const daySessions = this.history.filter(s => s.dateKey === key);
      const reps = daySessions.reduce((acc, s) => acc + (s.reps || 0), 0);
      const calories = daySessions.reduce((acc, s) => acc + (s.caloriesBurned || 0), 0);
      const minutes = Math.round(daySessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) / 60);

      days.push({
        dateKey: key,
        dayName,
        reps,
        calories: Math.round(calories),
        minutes
      });
    }

    return days;
  }

  clearAllData() {
    this.history = [];
    this.achievements = [];
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
  }

  exportDataJson() {
    const dump = {
      profile: this.profile,
      history: this.history,
      achievements: this.achievements,
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(dump, null, 2);
  }

  importDataJson(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (data.profile) this.saveProfile(data.profile);
      if (Array.isArray(data.history)) {
        this.history = data.history;
        this.saveHistory();
      }
      if (Array.isArray(data.achievements)) {
        this.achievements = data.achievements;
        this.saveAchievements();
      }
      return true;
    } catch (e) {
      console.error('Failed to import JSON data', e);
      return false;
    }
  }
}

export const storageManager = new StorageManager();
