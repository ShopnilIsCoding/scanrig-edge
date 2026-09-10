export const CORE_EXERCISES = [
  { id: 'push-up', name: 'Push-up', category: 'Upper body', difficulty: 'Beginner', target: 'Chest, shoulders and triceps', equipment: 'No equipment', duration: '3 sets × 8–12 reps', trackingMode: 'reps', baseTarget: 10, sets: 3, trackerTemplate: 'push-up' },
  { id: 'squat', name: 'Bodyweight squat', category: 'Lower body', difficulty: 'Beginner', target: 'Quadriceps, glutes and core', equipment: 'No equipment', duration: '3 sets × 12–15 reps', trackingMode: 'reps', baseTarget: 12, sets: 3, trackerTemplate: 'squat' },
  { id: 'lunge', name: 'Alternating lunge', category: 'Lower body', difficulty: 'Intermediate', target: 'Glutes, quadriceps and balance', equipment: 'No equipment', duration: '3 sets × 10 each side', trackingMode: 'reps', baseTarget: 16, sets: 3, trackerTemplate: 'lunge' },
  { id: 'jumping-jack', name: 'Jumping jack', category: 'Cardio', difficulty: 'Beginner', target: 'Full body and cardiovascular endurance', equipment: 'No equipment', duration: '3 sets × 20 reps', trackingMode: 'reps', baseTarget: 20, sets: 3, trackerTemplate: 'jumping-jack' },
  { id: 'shoulder-press', name: 'Dumbbell shoulder press', category: 'Upper body', difficulty: 'Beginner', target: 'Shoulders and triceps', equipment: 'Dumbbells or water bottles', duration: '3 sets × 10–12 reps', trackingMode: 'reps', baseTarget: 10, sets: 3, trackerTemplate: 'shoulder-press' },
  { id: 'biceps-curl', name: 'Hammer curl', category: 'Upper body', difficulty: 'Beginner', target: 'Biceps and forearms', equipment: 'Dumbbells or water bottles', duration: '3 sets × 10–15 reps', trackingMode: 'reps', baseTarget: 12, sets: 3, trackerTemplate: 'biceps-curl' },
  { id: 'high-knees', name: 'High knees', category: 'Cardio', difficulty: 'Beginner', target: 'Hip flexors, core and cardio fitness', equipment: 'No equipment', duration: '3 sets × 20 reps', trackingMode: 'reps', baseTarget: 20, sets: 3, trackerTemplate: 'high-knees' },
  { id: 'crunch', name: 'Abdominal crunch', category: 'Core', difficulty: 'Beginner', target: 'Abdominal muscles', equipment: 'Exercise mat', duration: '3 sets × 12–20 reps', trackingMode: 'reps', baseTarget: 12, sets: 3, trackerTemplate: 'crunch' },
  { id: 'plank', name: 'Forearm plank', category: 'Core', difficulty: 'Intermediate', target: 'Core stability and posture', equipment: 'Exercise mat', duration: '3 holds × 30–45 sec', trackingMode: 'hold', baseTarget: 30, sets: 3, trackerTemplate: 'plank' },
];

export const CORE_LABELS = CORE_EXERCISES.map((item) => item.id);

export function getCoreExercise(id) {
  return CORE_EXERCISES.find((item) => item.id === id) || null;
}
