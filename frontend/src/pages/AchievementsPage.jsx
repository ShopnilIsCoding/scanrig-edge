import { Award, Crown, Dumbbell, Flame, Medal, ShieldCheck, Sparkles, Star, Trophy } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function AchievementsPage() {
  const { points, completedSessions, progress } = useApp();
  const badges = [
    { icon: Dumbbell, title: 'First workout', text: 'Complete your first camera session.', earned: completedSessions >= 1, xp: 100 },
    { icon: Flame, title: 'Four sessions', text: 'Complete four recorded workouts.', earned: completedSessions >= 4, xp: 180 },
    { icon: ShieldCheck, title: 'Form builder', text: 'Reach an 85% average form score.', earned: progress.averageForm >= 85, xp: 220 },
    { icon: Medal, title: 'Rep century', text: 'Complete 100 recorded repetitions.', earned: progress.totalReps >= 100, xp: 250 },
    { icon: Star, title: 'Training habit', text: 'Complete eight recorded workouts.', earned: completedSessions >= 8, xp: 400 },
    { icon: Crown, title: 'Movement master', text: 'Reach a 92% average form score after five sessions.', earned: completedSessions >= 5 && progress.averageForm >= 92, xp: 600 },
  ];
  const nextTarget = Math.max(5, Math.ceil((completedSessions + 1) / 5) * 5);

  return (
    <div className="app-page section-shell achievements-page">
      <header className="achievement-hero"><div><span className="eyebrow">REWARDS</span><h1>Achievements</h1><p>These rewards now unlock from your own workout history rather than demo data.</p></div><div className="xp-total"><Sparkles /><span><strong>{points.toLocaleString()}</strong><small>TOTAL XP</small></span></div></header>
      <section className="featured-badge"><div className="featured-emblem"><Trophy /></div><div><span className="eyebrow">NEXT SESSION MILESTONE</span><h2>{nextTarget} workouts</h2><p>Keep training with clean form to build your personal history and unlock the next milestone.</p><div className="xp-track"><span style={{ width: `${Math.min(100, (completedSessions / nextTarget) * 100)}%` }} /></div><small>{completedSessions} / {nextTarget} sessions</small></div></section>
      <div className="badge-grid">{badges.map(({ icon: Icon, title, text, earned, xp }) => <article className={`badge-card ${earned ? 'earned' : 'locked'}`} key={title}><span className="badge-emblem"><Icon /></span><small>{earned ? 'UNLOCKED' : 'LOCKED'}</small><h3>{title}</h3><p>{text}</p><strong>+{xp} XP</strong></article>)}</div>
      <section className="panel achievement-levels"><div className="panel-heading"><div><span className="eyebrow">LEVEL PATH</span><h2>Keep progressing</h2></div><Award /></div><div className="level-path">{[1, 2, 3, 4, 5, 6].map((level) => { const currentLevel = Math.max(1, Math.floor(points / 500) + 1); return <div className={level <= currentLevel ? 'complete' : ''} key={level}><span>{level < currentLevel ? '✓' : level}</span><small>LV {level}</small></div>; })}</div></section>
    </div>
  );
}
