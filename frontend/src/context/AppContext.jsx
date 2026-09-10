import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  getPersonalizedPlan,
  getPublicExercises,
  getTodayReadiness,
  getWorkoutSessions,
  loginUser,
  registerUser,
  saveProfile,
  saveTodayReadiness,
  saveWorkoutSession,
} from '../services/api';
import { BASE_PROFILE, deriveProgress, profileIsComplete } from '../utils/personalization';

const AppContext = createContext(null);

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function scopedKey(userId, suffix) {
  return userId ? `scanrig:${userId}:${suffix}` : null;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normaliseSession(item) {
  return {
    id: item.id || item._id || `session-${Date.now()}`,
    completedAt: item.completedAt || item.createdAt || new Date().toISOString(),
    reps: Number(item.reps || 0),
    formScore: Number(item.formScore || 0),
    repQualityAverage: Number(item.repQualityAverage || 0),
    fatigueScore: Number(item.fatigueScore || 0),
    fatigueEvents: Number(item.fatigueEvents || 0),
    readinessScore: Number(item.readinessScore || 0),
    readinessBand: item.readinessBand || '',
    planVersion: item.planVersion || '',
    durationSeconds: Number(item.durationSeconds || 0),
    caloriesBurned: Number(item.caloriesBurned || 0),
    calorieTarget: Number(item.calorieTarget || 0),
    exerciseCalories: item.exerciseCalories || {},
    exercises: item.exercises || [],
    formReport: item.formReport || null,
    xp: Number(item.xp || 0),
  };
}

export function AppProvider({ children }) {
  const storedUser = readStored('scanrig-user', null);
  const hasToken = Boolean(localStorage.getItem('scanrig-token'));
  const initialUser = hasToken ? storedUser : null;
  const initialHistory = initialUser ? readStored(scopedKey(initialUser.id, 'history'), []) : [];
  const initialProgress = deriveProgress(initialHistory);

  const [currentUser, setCurrentUser] = useState(initialUser);
  const [profile, setProfileState] = useState(() => {
    if (!initialUser) return { ...BASE_PROFILE };
    return readStored(scopedKey(initialUser.id, 'profile'), { ...BASE_PROFILE, ...initialUser.profile, name: initialUser.name });
  });
  const [workoutHistory, setWorkoutHistory] = useState(initialHistory);
  const [points, setPoints] = useState(initialProgress.points);
  const [completedSessions, setCompletedSessions] = useState(initialProgress.completedSessions);
  const [accountLoading, setAccountLoading] = useState(Boolean(initialUser));
  const [customExercises, setCustomExercises] = useState([]);
  const [personalizedPlan, setPersonalizedPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [todayReadiness, setTodayReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const applyAccountData = (user, sessions = []) => {
    const history = sessions.map(normaliseSession);
    const nextProfile = { ...BASE_PROFILE, ...(user.profile || {}), name: user.name || '' };
    const progress = deriveProgress(history);
    setCurrentUser(user);
    setProfileState(nextProfile);
    setWorkoutHistory(history);
    setPoints(progress.points);
    setCompletedSessions(progress.completedSessions);
    localStorage.setItem('scanrig-user', JSON.stringify(user));
    localStorage.setItem(scopedKey(user.id, 'profile'), JSON.stringify(nextProfile));
    localStorage.setItem(scopedKey(user.id, 'history'), JSON.stringify(history));
  };

  const refreshExerciseCatalog = async () => {
    try {
      const { exercises = [] } = await getPublicExercises();
      setCustomExercises(exercises);
      return exercises;
    } catch (error) {
      console.warn('[ScanRig] Published exercise catalog unavailable.', error);
      return [];
    }
  };

  const refreshReadiness = async () => {
    if (!localStorage.getItem('scanrig-token')) return null;
    setReadinessLoading(true);
    try {
      const { checkin } = await getTodayReadiness(localDateKey());
      setTodayReadiness(checkin || null);
      return checkin || null;
    } catch (error) {
      console.warn('[ScanRig] Today readiness unavailable.', error);
      return null;
    } finally {
      setReadinessLoading(false);
    }
  };

  const refreshPersonalizedPlan = async () => {
    if (!localStorage.getItem('scanrig-token')) return null;
    setPlanLoading(true);
    try {
      const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
      const { plan } = await getPersonalizedPlan({ dateKey: localDateKey(), todayName });
      setPersonalizedPlan(plan || null);
      return plan || null;
    } catch (error) {
      console.warn('[ScanRig] Personalized plan unavailable; local planner remains active.', error);
      return null;
    } finally {
      setPlanLoading(false);
    }
  };

  const refreshAccount = async (fallbackUser = currentUser) => {
    if (!fallbackUser || !localStorage.getItem('scanrig-token')) return;
    setAccountLoading(true);
    try {
      const [{ user }, { sessions }] = await Promise.all([getCurrentUser(), getWorkoutSessions()]);
      applyAccountData(user, sessions || []);
      refreshExerciseCatalog();
      if (user?.profile?.onboardingComplete) {
        await refreshReadiness();
        await refreshPersonalizedPlan();
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem('scanrig-token');
        localStorage.removeItem('scanrig-user');
        setCurrentUser(null);
        setProfileState({ ...BASE_PROFILE });
        setWorkoutHistory([]);
        setPoints(0);
        setCompletedSessions(0);
        setPersonalizedPlan(null);
        setTodayReadiness(null);
      } else {
        console.warn('[ScanRig] Could not refresh account from the API. Using this user’s local cache.', error);
      }
    } finally {
      setAccountLoading(false);
    }
  };

  useEffect(() => {
    refreshExerciseCatalog();
    if (initialUser) refreshAccount(initialUser);
    // Only hydrate once on app boot. Login/register call refresh explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setProfile = (nextProfile) => {
    const merged = { ...BASE_PROFILE, ...nextProfile, name: nextProfile.name || currentUser?.name || '' };
    setProfileState(merged);
    if (currentUser) {
      localStorage.setItem(scopedKey(currentUser.id, 'profile'), JSON.stringify(merged));
      localStorage.setItem('scanrig-user', JSON.stringify({ ...currentUser, name: merged.name || currentUser.name, profile: merged }));
    }
    if (currentUser && localStorage.getItem('scanrig-token')) {
      const { name, ...profilePayload } = merged;
      saveProfile({ name, profile: profilePayload })
        .then(({ user }) => {
          setCurrentUser(user);
          localStorage.setItem('scanrig-user', JSON.stringify(user));
          if (user?.profile?.onboardingComplete) refreshPersonalizedPlan();
        })
        .catch((error) => console.warn('[ScanRig] Profile saved locally but API sync failed.', error));
    }
  };

  const login = async ({ email, password }) => {
    setAccountLoading(true);
    try {
      const { token, user } = await loginUser({ email, password });
      localStorage.setItem('scanrig-token', token);
      const { sessions } = await getWorkoutSessions();
      applyAccountData(user, sessions || []);
      refreshExerciseCatalog();
      if (user?.profile?.onboardingComplete) {
        await refreshReadiness();
        await refreshPersonalizedPlan();
      }
      return user;
    } finally {
      setAccountLoading(false);
    }
  };

  const register = async ({ name, email, password }) => {
    setAccountLoading(true);
    try {
      const { token, user } = await registerUser({ name, email, password });
      localStorage.setItem('scanrig-token', token);
      const newProfile = { ...BASE_PROFILE, name, gender: 'male', onboardingComplete: false };
      const cleanUser = { ...user, profile: newProfile };
      applyAccountData(cleanUser, []);
      setPersonalizedPlan(null);
      setTodayReadiness(null);
      refreshExerciseCatalog();
      return cleanUser;
    } finally {
      setAccountLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setProfileState({ ...BASE_PROFILE });
    setWorkoutHistory([]);
    setPoints(0);
    setCompletedSessions(0);
    setAccountLoading(false);
    setPersonalizedPlan(null);
    setTodayReadiness(null);
    localStorage.removeItem('scanrig-user');
    localStorage.removeItem('scanrig-token');
  };

  const submitReadiness = async (payload) => {
    const result = await saveTodayReadiness({ ...payload, dateKey: localDateKey() });
    setTodayReadiness(result.checkin || null);
    await refreshPersonalizedPlan();
    return result;
  };

  const completeWorkout = ({ reps = 0, formScore = 80, durationSeconds = 0, exercises = [], ...intelligence }) => {
    if (!currentUser) return 0;
    const earned = Math.max(50, Math.round(reps * 2 + formScore + exercises.length * 15));
    const payload = { reps, formScore, durationSeconds, exercises, ...intelligence };
    const session = normaliseSession({
      id: `session-${Date.now()}`,
      completedAt: new Date().toISOString(),
      ...payload,
      xp: earned,
    });
    const nextHistory = [session, ...workoutHistory].slice(0, 100);
    const progress = deriveProgress(nextHistory);
    setWorkoutHistory(nextHistory);
    setPoints(progress.points);
    setCompletedSessions(progress.completedSessions);
    localStorage.setItem(scopedKey(currentUser.id, 'history'), JSON.stringify(nextHistory));

    if (localStorage.getItem('scanrig-token')) {
      saveWorkoutSession(payload)
        .then(async () => { await refreshAccount(currentUser); await refreshPersonalizedPlan(); })
        .catch((error) => console.warn('[ScanRig] Workout saved to this account locally but API persistence failed.', error));
    }
    return earned;
  };

  const progress = useMemo(() => deriveProgress(workoutHistory), [workoutHistory]);

  const value = useMemo(() => ({
    currentUser,
    profile,
    profileComplete: profileIsComplete(profile),
    points,
    completedSessions,
    workoutHistory,
    progress,
    accountLoading,
    customExercises,
    personalizedPlan,
    planLoading,
    todayReadiness,
    readinessLoading,
    setProfile,
    login,
    register,
    logout,
    completeWorkout,
    submitReadiness,
    refreshReadiness,
    refreshAccount,
    refreshExerciseCatalog,
    refreshPersonalizedPlan,
  }), [currentUser, profile, points, completedSessions, workoutHistory, progress, accountLoading, customExercises, personalizedPlan, planLoading, todayReadiness, readinessLoading]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
