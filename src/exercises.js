// FitPulse AI - Freehand Exercises Engine
// Modular exercise definitions and state machines with angle & form evaluation

/**
 * MediaPipe Pose Landmark Indices:
 * 0: NOSE, 11: LEFT_SHOULDER, 12: RIGHT_SHOULDER
 * 13: LEFT_ELBOW, 14: RIGHT_ELBOW, 15: LEFT_WRIST, 16: RIGHT_WRIST
 * 23: LEFT_HIP, 24: RIGHT_HIP, 25: LEFT_KNEE, 26: RIGHT_KNEE
 * 27: LEFT_ANKLE, 28: RIGHT_ANKLE, 29: LEFT_HEEL, 30: RIGHT_HEEL
 * 31: LEFT_FOOT_INDEX, 32: RIGHT_FOOT_INDEX
 */

/**
 * Calculate 2D angle between three landmarks in degrees (0 - 180)
 * B is the vertex point (e.g., knee, elbow, hip)
 */
export function calculateAngle(a, b, c) {
  if (!a || !b || !c) return 0;
  
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return Math.round(angle);
}

/**
 * Calculate Euclidean distance between two 2D points
 */
export function calculateDistance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Determine primary side (Left or Right) based on visibility of landmarks
 */
export function getVisibleSide(landmarks, leftJoints, rightJoints) {
  const leftVis = leftJoints.reduce((acc, idx) => acc + (landmarks[idx]?.visibility || 0), 0) / leftJoints.length;
  const rightVis = rightJoints.reduce((acc, idx) => acc + (landmarks[idx]?.visibility || 0), 0) / rightJoints.length;
  return leftVis >= rightVis ? 'left' : 'right';
}

export const EXERCISES = [
  {
    id: 'squats',
    name: 'Bodyweight Squats',
    hindiName: 'स्क्वैट्स (उठक-बैठक)',
    category: 'lower',
    icon: 'squat',
    met: 5.5,
    caloriesPerRep: 0.35, // Average for ~70kg person
    isHold: false,
    targetMuscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],
    instructions: 'Stand sideways or 45° to camera. Feet shoulder-width apart. Lower your hips until thighs are parallel to ground (knee angle <= 90°), then stand fully back up.',
    tips: [
      'Keep your chest high and back straight',
      'Lower down until knee angle reaches 90° or below',
      'Push through your heels to return to standing'
    ],
    evaluate: (landmarks, state) => {
      // Choose side with best visibility
      const side = getVisibleSide(landmarks, [11, 23, 25, 27], [12, 24, 26, 28]);
      const hipIdx = side === 'left' ? 23 : 24;
      const kneeIdx = side === 'left' ? 25 : 26;
      const ankleIdx = side === 'left' ? 27 : 28;
      const shoulderIdx = side === 'left' ? 11 : 12;

      const hip = landmarks[hipIdx];
      const knee = landmarks[kneeIdx];
      const ankle = landmarks[ankleIdx];
      const shoulder = landmarks[shoulderIdx];

      if (!hip || !knee || !ankle) {
        return {
          valid: false,
          feedback: 'Position full body in camera frame',
          feedbackType: 'info'
        };
      }

      // Knee flexion angle: 170° = standing, <= 90° = deep squat
      const kneeAngle = calculateAngle(hip, knee, ankle);
      // Torso/Back angle (Shoulder - Hip - Knee)
      const hipAngle = calculateAngle(shoulder, hip, knee);

      // Percentage progress: from 165° (0%) down to 85° (100%)
      const progress = Math.min(100, Math.max(0, Math.round(((165 - kneeAngle) / (165 - 85)) * 100)));

      let stage = state.stage || 'up';
      let repIncremented = false;
      let feedback = 'Good form! Lower down';
      let feedbackType = 'info';

      // Posture check: Torso collapse
      if (kneeAngle < 120 && hipAngle < 55) {
        feedback = 'Keep your chest up! Don\'t bend too forward';
        feedbackType = 'warning';
      }

      // State transition with hysteresis to prevent false double-counts
      if (kneeAngle <= 95) {
        stage = 'down';
        feedback = 'Great depth! Now push up';
        feedbackType = 'success';
      } else if (kneeAngle > 155 && stage === 'down') {
        stage = 'up';
        repIncremented = true;
        feedback = 'Rep counted! Keep going';
        feedbackType = 'success';
      } else if (kneeAngle > 155) {
        stage = 'up';
      } else if (stage === 'up' && kneeAngle < 135) {
        feedback = 'Go deeper (thighs parallel to floor)';
        feedbackType = 'info';
      }

      return {
        valid: true,
        primaryAngle: kneeAngle,
        primaryJoint: knee,
        targetAngle: 90,
        progress,
        stage,
        repIncremented,
        feedback,
        feedbackType,
        highlightJoints: [hipIdx, kneeIdx, ankleIdx],
        activeSide: side
      };
    }
  },

  {
    id: 'pushups',
    name: 'Push-ups',
    hindiName: 'पुश-अप्स (Push-ups)',
    category: 'upper',
    icon: 'pushup',
    met: 8.0,
    caloriesPerRep: 0.45,
    isHold: false,
    targetMuscles: ['Chest (Pectorals)', 'Triceps', 'Anterior Deltoids', 'Core'],
    instructions: 'Place camera at side angle on the floor. Start in a high plank with arms extended. Lower chest until elbows are bent to 90° or less, then push back up.',
    tips: [
      'Maintain a straight line from shoulders through hips to ankles',
      'Lower until elbows reach at least 90°',
      'Avoid sagging your hips or arching high'
    ],
    evaluate: (landmarks, state) => {
      const side = getVisibleSide(landmarks, [11, 13, 15, 23, 27], [12, 14, 16, 24, 28]);
      const shoulderIdx = side === 'left' ? 11 : 12;
      const elbowIdx = side === 'left' ? 13 : 14;
      const wristIdx = side === 'left' ? 15 : 16;
      const hipIdx = side === 'left' ? 23 : 24;
      const ankleIdx = side === 'left' ? 27 : 28;

      const shoulder = landmarks[shoulderIdx];
      const elbow = landmarks[elbowIdx];
      const wrist = landmarks[wristIdx];
      const hip = landmarks[hipIdx];
      const ankle = landmarks[ankleIdx];

      if (!shoulder || !elbow || !wrist) {
        return {
          valid: false,
          feedback: 'Make sure your arms & shoulders are visible',
          feedbackType: 'info'
        };
      }

      const elbowAngle = calculateAngle(shoulder, elbow, wrist);
      
      // Spine alignment check (Shoulder - Hip - Ankle)
      let spineAngle = 180;
      if (hip && ankle) {
        spineAngle = calculateAngle(shoulder, hip, ankle);
      }

      const progress = Math.min(100, Math.max(0, Math.round(((160 - elbowAngle) / (160 - 85)) * 100)));

      let stage = state.stage || 'up';
      let repIncremented = false;
      let feedback = 'Lower your chest smoothly';
      let feedbackType = 'info';

      // Spine posture warning
      if (spineAngle < 150) {
        feedback = 'Keep your back straight! Engage your core';
        feedbackType = 'warning';
      }

      if (elbowAngle <= 90) {
        stage = 'down';
        feedback = 'Excellent depth! Now push up';
        feedbackType = 'success';
      } else if (elbowAngle > 155 && stage === 'down') {
        stage = 'up';
        repIncremented = true;
        feedback = 'Great push-up rep!';
        feedbackType = 'success';
      } else if (elbowAngle > 155) {
        stage = 'up';
      } else if (stage === 'up' && elbowAngle < 130) {
        feedback = 'Go lower till elbows bend 90°';
        feedbackType = 'info';
      }

      return {
        valid: true,
        primaryAngle: elbowAngle,
        primaryJoint: elbow,
        targetAngle: 85,
        progress,
        stage,
        repIncremented,
        feedback,
        feedbackType,
        highlightJoints: [shoulderIdx, elbowIdx, wristIdx, hipIdx],
        activeSide: side
      };
    }
  },

  {
    id: 'jumping-jacks',
    name: 'Jumping Jacks',
    hindiName: 'जंपिंग जैक (Jumping Jacks)',
    category: 'cardio',
    icon: 'jumping',
    met: 8.5,
    caloriesPerRep: 0.22,
    isHold: false,
    targetMuscles: ['Calves', 'Deltoids', 'Lats', 'Cardiovascular System'],
    instructions: 'Face camera straight on. Stand upright with feet together and hands at sides. Jump to spread feet wide while raising hands above head, then jump back.',
    tips: [
      'Clap or bring hands together above head',
      'Spread feet wider than shoulder-width on the jump',
      'Maintain a continuous athletic bounce'
    ],
    evaluate: (landmarks, state) => {
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftAnkle = landmarks[27];
      const rightAnkle = landmarks[28];

      if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist || !leftAnkle || !rightAnkle) {
        return {
          valid: false,
          feedback: 'Step back so full body is visible in camera',
          feedbackType: 'info'
        };
      }

      // Arm abduction angle: Shoulder to Wrist relative to torso
      const leftArmAngle = calculateAngle(leftHip, leftShoulder, leftWrist);
      const rightArmAngle = calculateAngle(rightHip, rightShoulder, rightWrist);
      const avgArmAngle = Math.round((leftArmAngle + rightArmAngle) / 2);

      // Stance width: Ankle distance compared to Shoulder distance
      const shoulderDist = calculateDistance(leftShoulder, rightShoulder) || 0.2;
      const ankleDist = calculateDistance(leftAnkle, rightAnkle);
      const stanceRatio = ankleDist / shoulderDist;

      // Hands above head check: Wrist Y coordinate lower than Shoulder Y (in screen space Y is 0 at top)
      const handsOverhead = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;

      // Progress from closed (arm angle ~30°) to open (arm angle ~150°)
      const progress = Math.min(100, Math.max(0, Math.round(((avgArmAngle - 30) / (150 - 30)) * 100)));

      let stage = state.stage || 'down';
      let repIncremented = false;
      let feedback = 'Jump and raise hands overhead';
      let feedbackType = 'info';

      // Open state: arms high and legs spread
      if (avgArmAngle >= 140 && stanceRatio >= 1.5 && handsOverhead) {
        stage = 'up';
        feedback = 'Great extension! Return hands to sides';
        feedbackType = 'success';
      } else if (avgArmAngle <= 45 && stanceRatio < 1.2 && stage === 'up') {
        stage = 'down';
        repIncremented = true;
        feedback = 'Rep counted! Keep jumping!';
        feedbackType = 'success';
      } else if (avgArmAngle <= 45) {
        stage = 'down';
      }

      return {
        valid: true,
        primaryAngle: avgArmAngle,
        primaryJoint: leftShoulder,
        targetAngle: 150,
        progress,
        stage,
        repIncremented,
        feedback,
        feedbackType,
        highlightJoints: [11, 12, 15, 16, 27, 28]
      };
    }
  },

  {
    id: 'lunges',
    name: 'Walking / Static Lunges',
    hindiName: 'लंजेस (Lunges)',
    category: 'lower',
    icon: 'lunge',
    met: 6.0,
    caloriesPerRep: 0.38,
    isHold: false,
    targetMuscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
    instructions: 'Stand sideways to camera. Step forward with one leg and lower your hips until both knees are bent at about 90 degrees. Return to standing position.',
    tips: [
      'Keep front knee aligned over front ankle (do not push knee beyond toes)',
      'Keep upper body tall and upright',
      'Lower rear knee gently towards the floor'
    ],
    evaluate: (landmarks, state) => {
      const side = getVisibleSide(landmarks, [23, 25, 27], [24, 26, 28]);
      const hipIdx = side === 'left' ? 23 : 24;
      const kneeIdx = side === 'left' ? 25 : 26;
      const ankleIdx = side === 'left' ? 27 : 28;

      const hip = landmarks[hipIdx];
      const knee = landmarks[kneeIdx];
      const ankle = landmarks[ankleIdx];

      if (!hip || !knee || !ankle) {
        return {
          valid: false,
          feedback: 'Make sure your legs are in frame',
          feedbackType: 'info'
        };
      }

      const kneeAngle = calculateAngle(hip, knee, ankle);
      const progress = Math.min(100, Math.max(0, Math.round(((165 - kneeAngle) / (165 - 90)) * 100)));

      let stage = state.stage || 'up';
      let repIncremented = false;
      let feedback = 'Step down into a deep lunge';
      let feedbackType = 'info';

      if (kneeAngle <= 95) {
        stage = 'down';
        feedback = 'Perfect depth! Step back up';
        feedbackType = 'success';
      } else if (kneeAngle > 155 && stage === 'down') {
        stage = 'up';
        repIncremented = true;
        feedback = 'Lunge completed!';
        feedbackType = 'success';
      } else if (kneeAngle > 155) {
        stage = 'up';
      }

      return {
        valid: true,
        primaryAngle: kneeAngle,
        primaryJoint: knee,
        targetAngle: 90,
        progress,
        stage,
        repIncremented,
        feedback,
        feedbackType,
        highlightJoints: [hipIdx, kneeIdx, ankleIdx],
        activeSide: side
      };
    }
  },

  {
    id: 'high-knees',
    name: 'High Knees',
    hindiName: 'हाई नीज़ (High Knees)',
    category: 'cardio',
    icon: 'run',
    met: 9.0,
    caloriesPerRep: 0.16,
    isHold: false,
    targetMuscles: ['Hip Flexors', 'Quads', 'Abs', 'Cardiovascular'],
    instructions: 'Stand facing camera or 45°. Jog in place bringing each knee up to hip height (waist level) vigorously.',
    tips: [
      'Pump arms rhythmically with leg drive',
      'Aim to bring knees above waist level',
      'Stay on the balls of your feet'
    ],
    evaluate: (landmarks, state) => {
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftKnee = landmarks[25];
      const rightKnee = landmarks[26];

      if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
        return {
          valid: false,
          feedback: 'Step back to show hips and knees',
          feedbackType: 'info'
        };
      }

      // Check elevation: Knee Y compared to Hip Y (Y is inverted: lower Y value means higher in physical space)
      const leftElevation = (leftHip.y - leftKnee.y); // Positive when knee is near or above hip
      const rightElevation = (rightHip.y - rightKnee.y);

      const maxElevation = Math.max(leftElevation, rightElevation);
      const activeLeg = leftElevation > rightElevation ? 'left' : 'right';

      // Normalized progress: knee reaching hip height (diff ~ 0 or positive)
      const progress = Math.min(100, Math.max(0, Math.round(((maxElevation + 0.15) / 0.20) * 100)));

      let stage = state.stage || 'down';
      let repIncremented = false;
      let feedback = 'Drive knees higher to waist level';
      let feedbackType = 'info';

      if (maxElevation >= -0.04) {
        if (stage === 'down') {
          stage = 'up';
          repIncremented = true;
          feedback = 'High knee counted! Keep tempo up';
          feedbackType = 'success';
        }
      } else if (maxElevation < -0.15) {
        stage = 'down';
      }

      return {
        valid: true,
        primaryAngle: Math.round(progress),
        primaryJoint: activeLeg === 'left' ? leftKnee : rightKnee,
        targetAngle: 100,
        progress,
        stage,
        repIncremented,
        feedback,
        feedbackType,
        highlightJoints: [23, 24, 25, 26]
      };
    }
  },

  {
    id: 'plank',
    name: 'Plank Hold',
    hindiName: 'प्लैंक होल्ड (Plank)',
    category: 'core',
    icon: 'plank',
    met: 3.8,
    caloriesPerSecond: 0.05,
    isHold: true, // Special hold exercise: timer based!
    targetMuscles: ['Rectus Abdominis', 'Transverse Abdominis', 'Lower Back', 'Shoulders'],
    instructions: 'Place camera at side angle. Support body on forearms/hands and toes. Keep straight line from shoulders to heels. Hold position steady.',
    tips: [
      'Do not allow lower back or hips to sag',
      'Do not pike hips up into the air',
      'Engage glutes and core throughout the hold'
    ],
    evaluate: (landmarks, state) => {
      const side = getVisibleSide(landmarks, [11, 23, 25, 27], [12, 24, 26, 28]);
      const shoulderIdx = side === 'left' ? 11 : 12;
      const hipIdx = side === 'left' ? 23 : 24;
      const ankleIdx = side === 'left' ? 27 : 28;

      const shoulder = landmarks[shoulderIdx];
      const hip = landmarks[hipIdx];
      const ankle = landmarks[ankleIdx];

      if (!shoulder || !hip || !ankle) {
        return {
          valid: false,
          feedback: 'Position body horizontally in camera view',
          feedbackType: 'info',
          isHolding: false
        };
      }

      // Straight spine angle (Shoulder - Hip - Ankle)
      const spineAngle = calculateAngle(shoulder, hip, ankle);
      const isHorizontal = Math.abs(shoulder.y - hip.y) < 0.25;

      let feedback = 'Hold steady! Squeeze core';
      let feedbackType = 'success';
      let isHolding = false;

      // Ideal plank alignment: 160° to 195° and roughly horizontal
      if (spineAngle >= 155 && spineAngle <= 195 && isHorizontal) {
        isHolding = true;
        feedback = 'Perfect plank alignment! Holding strong 🔥';
        feedbackType = 'success';
      } else if (spineAngle < 155) {
        feedback = 'Hips sagging or too high! Align straight';
        feedbackType = 'warning';
      } else if (!isHorizontal) {
        feedback = 'Get down in horizontal plank position';
        feedbackType = 'info';
      }

      return {
        valid: true,
        primaryAngle: spineAngle,
        primaryJoint: hip,
        targetAngle: 180,
        progress: isHolding ? 100 : 0,
        isHolding,
        feedback,
        feedbackType,
        highlightJoints: [shoulderIdx, hipIdx, ankleIdx],
        activeSide: side
      };
    }
  },

  {
    id: 'bicep-curls',
    name: 'Arm Flex / Freehand Curls',
    hindiName: 'आर्म कर्ल्स (Arm Curls)',
    category: 'upper',
    icon: 'curl',
    met: 4.5,
    caloriesPerRep: 0.25,
    isHold: false,
    targetMuscles: ['Biceps', 'Brachialis', 'Forearms'],
    instructions: 'Face camera or stand slightly turned. Keep elbows tucked at your sides. Curl your hands up towards your shoulders, then lower fully.',
    tips: [
      'Keep your upper arms stationary at your sides',
      'Squeeze biceps tight at the top of the movement',
      'Lower under control to full arm extension'
    ],
    evaluate: (landmarks, state) => {
      const side = getVisibleSide(landmarks, [11, 13, 15], [12, 14, 16]);
      const shoulderIdx = side === 'left' ? 11 : 12;
      const elbowIdx = side === 'left' ? 13 : 14;
      const wristIdx = side === 'left' ? 15 : 16;

      const shoulder = landmarks[shoulderIdx];
      const elbow = landmarks[elbowIdx];
      const wrist = landmarks[wristIdx];

      if (!shoulder || !elbow || !wrist) {
        return {
          valid: false,
          feedback: 'Make sure your arm is visible to the camera',
          feedbackType: 'info'
        };
      }

      const elbowAngle = calculateAngle(shoulder, elbow, wrist);
      const progress = Math.min(100, Math.max(0, Math.round(((160 - elbowAngle) / (160 - 45)) * 100)));

      let stage = state.stage || 'down';
      let repIncremented = false;
      let feedback = 'Curl hand up towards shoulder';
      let feedbackType = 'info';

      if (elbowAngle <= 50) {
        stage = 'up';
        feedback = 'Full squeeze! Now lower down slowly';
        feedbackType = 'success';
      } else if (elbowAngle > 150 && stage === 'up') {
        stage = 'down';
        repIncremented = true;
        feedback = 'Rep counted! Keep pumping';
        feedbackType = 'success';
      } else if (elbowAngle > 150) {
        stage = 'down';
      }

      return {
        valid: true,
        primaryAngle: elbowAngle,
        primaryJoint: elbow,
        targetAngle: 45,
        progress,
        stage,
        repIncremented,
        feedback,
        feedbackType,
        highlightJoints: [shoulderIdx, elbowIdx, wristIdx],
        activeSide: side
      };
    }
  }
];

/**
 * Exercise Manager - Handles registration of custom exercises and retrieval
 */
class ExerciseRegistry {
  constructor() {
    this.exercises = [...EXERCISES];
  }

  getAll() {
    return this.exercises;
  }

  getById(id) {
    return this.exercises.find(e => e.id === id) || this.exercises[0];
  }

  /**
   * Allows the user to easily add custom exercises in future!
   */
  register(newExercise) {
    if (!newExercise.id || !newExercise.name || !newExercise.evaluate) {
      throw new Error('Exercise must have id, name, and evaluate function');
    }
    const existingIndex = this.exercises.findIndex(e => e.id === newExercise.id);
    if (existingIndex >= 0) {
      this.exercises[existingIndex] = newExercise;
    } else {
      this.exercises.push(newExercise);
    }
    return newExercise;
  }
}

export const exerciseRegistry = new ExerciseRegistry();
