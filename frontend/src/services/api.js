import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 12000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('scanrig-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function loginUser(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}

export async function registerUser(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function getCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function saveProfile(payload) {
  const { data } = await api.patch('/auth/profile', payload);
  return data;
}

export async function saveWorkoutSession(payload) {
  const { data } = await api.post('/workouts', payload);
  return data;
}

export async function getWorkoutSessions() {
  const { data } = await api.get('/workouts');
  return data;
}

export default api;

export async function saveTrainingSample(payload) {
  const { data } = await api.post('/ai-samples', payload);
  return data;
}

export async function getTrainingSampleSummary() {
  const { data } = await api.get('/ai-samples/summary');
  return data;
}

export async function getTrainingSamples(params = {}) {
  const { data } = await api.get('/ai-samples', { params });
  return data;
}

export async function updateTrainingSample(id, payload) {
  const { data } = await api.patch(`/ai-samples/${id}`, payload);
  return data;
}

export async function deleteTrainingSample(id) {
  const { data } = await api.delete(`/ai-samples/${id}`);
  return data;
}

export async function getTrainingDatasetExport({ includeRejected = false } = {}) {
  const { data } = await api.get('/ai-samples/export', { params: { includeRejected } });
  return data;
}

export async function getAITrainingStatus() {
  const { data } = await api.get('/ai-training/status');
  return data;
}

export async function getAIModelStatus() {
  const { data } = await api.get('/ai-model/status');
  return data;
}

export async function startAITraining() {
  const { data } = await api.post('/ai-training/start');
  return data;
}

export async function getPublicExercises() {
  const { data } = await api.get('/exercises/public');
  return data;
}

export async function getAdminExercises() {
  const { data } = await api.get('/exercises/admin');
  return data;
}

export async function createAdminExercise(payload) {
  const { data } = await api.post('/exercises/admin', payload);
  return data;
}

export async function updateAdminExercise(id, payload) {
  const { data } = await api.patch(`/exercises/admin/${id}`, payload);
  return data;
}

export async function deleteAdminExercise(id) {
  const { data } = await api.delete(`/exercises/admin/${id}`);
  return data;
}

export async function getPersonalizedPlan({ insight = false, dateKey, todayName } = {}) {
  const { data } = await api.get('/personalization/plan', { params: { insight, dateKey, todayName } });
  return data;
}

export async function getTodayReadiness(dateKey) {
  const { data } = await api.get('/readiness/today', { params: { dateKey } });
  return data;
}

export async function saveTodayReadiness(payload) {
  const { data } = await api.post('/readiness/today', payload);
  return data;
}

export async function getReadinessHistory(days = 14) {
  const { data } = await api.get('/readiness/history', { params: { days } });
  return data;
}

export async function getTrainerContext() {
  const { data } = await api.get('/trainer/context');
  return data;
}

export async function askTrainer(message, history = []) {
  const { data } = await api.post('/trainer/chat', { message, history });
  return data;
}
