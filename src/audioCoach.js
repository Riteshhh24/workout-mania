// FitPulse AI - Audio Coach & Sound Synthesizer
// Zero external audio files required: Uses Web Audio API & Web Speech API

class AudioCoach {
  constructor() {
    this.ctx = null;
    this.synth = window.speechSynthesis || null;
    this.voiceEnabled = true;
    this.soundEffectsEnabled = true;
    this.voiceLanguage = 'en'; // 'en' or 'hi' (Hinglish/Hindi phrases)
    this.lastSpokenText = '';
    this.lastSpokenTime = 0;
    this.speechQueue = [];
    this.isSpeaking = false;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Sound Effects Synthesizer (Web Audio API) ---

  playRepBeep() {
    if (!this.soundEffectsEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Bright ascending chime
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playMilestone() {
    if (!this.soundEffectsEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    // Harmonic triad: C5, E5, G5, C6
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  playCountdown(count) {
    if (!this.soundEffectsEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (count === 0) {
      // "GO" high tone
      osc.frequency.setValueAtTime(987.77, now); // B5
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      // 3, 2, 1 tone
      osc.frequency.setValueAtTime(440, now); // A4
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);
  }

  playWarning() {
    if (!this.soundEffectsEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // --- Voice Synthesis Coach (Web Speech API) ---

  speak(text, priority = false) {
    if (!this.voiceEnabled || !this.synth) return;

    const now = Date.now();
    // Prevent repeating identical feedback within 3 seconds
    if (!priority && text === this.lastSpokenText && (now - this.lastSpokenTime < 3000)) {
      return;
    }

    this.lastSpokenText = text;
    this.lastSpokenTime = now;

    if (priority) {
      this.synth.cancel(); // Interrupt current speech for high priority cues
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.15; // Slightly athletic brisk tempo
    utterance.pitch = 1.05;

    // Pick a natural voice if available
    const voices = this.synth.getVoices();
    if (voices.length > 0) {
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
      if (preferred) utterance.voice = preferred;
    }

    this.synth.speak(utterance);
  }

  /**
   * Motivational feedback based on rep count and milestones
   */
  announceRep(repNumber, targetGoal = null) {
    this.playRepBeep();

    if (targetGoal && repNumber === targetGoal) {
      this.playMilestone();
      const victoryMsg = this.voiceLanguage === 'hi'
        ? `Lakhshay poora hua! ${repNumber} reps shandaar!`
        : `Target reached! ${repNumber} reps completed! You are on fire!`;
      this.speak(victoryMsg, true);
      return;
    }

    if (repNumber % 5 === 0) {
      this.playMilestone();
      const encouragement = this.getMilestonePhrase(repNumber);
      this.speak(`${repNumber}! ${encouragement}`, true);
    } else {
      // Announce the number
      this.speak(`${repNumber}`);
    }
  }

  getMilestonePhrase(rep) {
    const enPhrases = [
      "Keep pushing!",
      "Awesome momentum!",
      "Strong form, keep it up!",
      "You're crushing it!",
      "Halfway there!",
      "Unstoppable power!"
    ];

    const hiPhrases = [
      "Bohot badhiya, lage raho!",
      "Shabash! Shandaar tempo!",
      "Power dikhao, dumdaar!",
      "Zabardast form!",
      "Lage raho fighter!"
    ];

    const list = this.voiceLanguage === 'hi' ? hiPhrases : enPhrases;
    return list[(rep / 5) % list.length];
  }

  speakFormCue(cueText) {
    this.speak(cueText, false);
  }

  setVoiceEnabled(enabled) {
    this.voiceEnabled = enabled;
    if (!enabled && this.synth) {
      this.synth.cancel();
    }
  }

  setSoundEffectsEnabled(enabled) {
    this.soundEffectsEnabled = enabled;
  }

  setLanguage(lang) {
    this.voiceLanguage = lang;
  }
}

export const audioCoach = new AudioCoach();
