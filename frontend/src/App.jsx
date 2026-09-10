import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ExerciseLibraryPage from './pages/ExerciseLibraryPage';
import ExerciseDetailPage from './pages/ExerciseDetailPage';
import WorkoutPage from './pages/WorkoutPage';
import ProgressPage from './pages/ProgressPage';
import AchievementsPage from './pages/AchievementsPage';
import NotFoundPage from './pages/NotFoundPage';
import AILabPage from './pages/AILabPage';
import ReadinessPage from './pages/ReadinessPage';
import TrainerChatPage from './pages/TrainerChatPage';
import { useApp } from './context/AppContext';

function SignedInRoute({ children, requireProfile = false }) {
  const { currentUser, profileComplete, accountLoading } = useApp();
  const location = useLocation();

  if (accountLoading && currentUser) {
    return <div className="route-loading-screen"><span className="live-dot" /> Loading your training profile…</div>;
  }
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (requireProfile && !profileComplete) return <Navigate to="/onboarding" replace />;
  return children;
}


function AdminRoute({ children }) {
  const { currentUser, accountLoading } = useApp();
  const location = useLocation();

  if (accountLoading && currentUser) {
    return <div className="route-loading-screen"><span className="live-dot" /> Opening training console…</div>;
  }
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (currentUser.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/exercises" element={<ExerciseLibraryPage />} />
        <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />

        <Route path="/onboarding" element={<SignedInRoute><OnboardingPage /></SignedInRoute>} />
        <Route path="/dashboard" element={<SignedInRoute requireProfile><DashboardPage /></SignedInRoute>} />
        <Route path="/workout" element={<SignedInRoute requireProfile><WorkoutPage /></SignedInRoute>} />
        <Route path="/readiness" element={<SignedInRoute requireProfile><ReadinessPage /></SignedInRoute>} />
        <Route path="/trainer" element={<SignedInRoute requireProfile><TrainerChatPage /></SignedInRoute>} />
        <Route path="/progress" element={<SignedInRoute requireProfile><ProgressPage /></SignedInRoute>} />
        <Route path="/achievements" element={<SignedInRoute requireProfile><AchievementsPage /></SignedInRoute>} />
        <Route path="/ai-lab" element={<AdminRoute><AILabPage /></AdminRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
