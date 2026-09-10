import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Award, BookOpen, BrainCircuit, ChartNoAxesCombined, Dumbbell, LayoutDashboard, LogIn, Menu, MessageCircle, Palette, Play, UserPlus, X } from 'lucide-react';
import Logo from './Logo';
import { useApp } from '../context/AppContext';

const appLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/exercises', label: 'Exercises', icon: BookOpen },
  { to: '/workout', label: 'Workout', icon: Play },
  { to: '/trainer', label: 'My trainer', icon: MessageCircle },
  { to: '/progress', label: 'Progress', icon: ChartNoAxesCombined },
  { to: '/achievements', label: 'Rewards', icon: Award },
];

const THEMES = ['dark', 'light', 'blue'];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => { const saved = localStorage.getItem('scanrig:theme'); return saved === 'orange' ? 'dark' : (THEMES.includes(saved) ? saved : 'dark'); });
  const { currentUser, points, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === '/';
  const visibleLinks = currentUser?.role === 'admin'
    ? [...appLinks, { to: '/ai-lab', label: 'AI Lab', icon: BrainCircuit }]
    : appLinks;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('scanrig:theme', theme);
  }, [theme]);

  const cycleTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
  };

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  return (
    <div className="site-shell">
      <header className={`topbar ${isLanding ? 'topbar-transparent' : ''}`}>
        <Logo />
        <button className="mobile-menu-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </button>
        <nav className={`main-nav ${open ? 'open' : ''}`}>
          {currentUser ? visibleLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>
          )) : (
            <>
              <a href="/#features" onClick={() => setOpen(false)}>Features</a>
              <Link to="/exercises" onClick={() => setOpen(false)}>Exercises</Link>
              <a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a>
            </>
          )}
        </nav>
        <div className="topbar-actions">
          <button className="theme-cycle-button" onClick={cycleTheme} title={`Theme: ${theme}. Click to change.`} aria-label={`Current theme ${theme}. Change theme.`}><Palette size={16} /><span>{theme}</span></button>
          {currentUser ? (
            <>
              <span className="points-pill"><Dumbbell size={15} /> {points.toLocaleString()} XP</span>
              <button className="avatar-button" onClick={handleLogout} title="Click to log out">
                {currentUser.name?.slice(0, 1).toUpperCase() || 'A'}
              </button>
            </>
          ) : (
            <>
              <Link className="text-button" to="/login"><LogIn size={16} /> Log in</Link>
              <Link className="button button-small" to="/register"><UserPlus size={16} /> Join free</Link>
            </>
          )}
        </div>
      </header>

      <main className="page-content"><Outlet /></main>

      {currentUser && (
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {appLinks.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}><Icon size={19} /><span>{label}</span></NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
