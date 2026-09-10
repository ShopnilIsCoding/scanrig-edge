export const weeklyPlan = [
  { day: 'Mon', label: 'Upper body', duration: 24, completed: true, exercises: ['Push-up', 'Plank'] },
  { day: 'Tue', label: 'Recovery', duration: 12, completed: true, exercises: ['Mobility'] },
  { day: 'Wed', label: 'Legs + core', duration: 28, completed: false, active: true, exercises: ['Squat', 'Lunge', 'Crunch'] },
  { day: 'Thu', label: 'Rest day', duration: 0, completed: false, exercises: [] },
  { day: 'Fri', label: 'Full body', duration: 30, completed: false, exercises: ['Jumping jack', 'Push-up', 'Squat'] },
  { day: 'Sat', label: 'Core control', duration: 20, completed: false, exercises: ['Plank', 'Crunch'] },
  { day: 'Sun', label: 'Rest day', duration: 0, completed: false, exercises: [] },
];

export const dashboardStats = [
  { label: 'Weekly goal', value: '2 / 4', note: 'sessions completed', tone: 'orange' },
  { label: 'Current streak', value: '4 days', note: 'personal best: 8', tone: 'lime' },
  { label: 'Total reps', value: '286', note: '+64 this week', tone: 'cyan' },
  { label: 'Form score', value: '87%', note: '+3% this month', tone: 'violet' },
];

export const progressHistory = [
  { week: 'W1', workouts: 2, form: 72, reps: 128 },
  { week: 'W2', workouts: 3, form: 77, reps: 184 },
  { week: 'W3', workouts: 3, form: 82, reps: 224 },
  { week: 'W4', workouts: 4, form: 87, reps: 286 },
];
