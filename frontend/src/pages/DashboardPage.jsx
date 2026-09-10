import { Activity, ArrowRight, Award, BatteryCharging, CalendarDays, Camera, Check, Clock3, Flame, MessageCircle, Play, Sparkles, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { exercises } from '../data/exercises';
import { useApp } from '../context/AppContext';
import { buildPersonalizedInsight, getRecommendedExerciseIds } from '../utils/personalization';
import { sameLocalDay } from '../utils/calories';

const statIcons = [Target, Flame, Activity, Trophy];
const weekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDay = (day) => day.slice(0, 3);

export default function DashboardPage() {
  const { profile, points, completedSessions, workoutHistory, progress, customExercises, personalizedPlan, planLoading, todayReadiness } = useApp();
  const catalog = [...exercises, ...(customExercises || [])];
  const recommendedIds = getRecommendedExerciseIds(profile, workoutHistory);
  const todayName = weekNames[new Date().getDay()];
  const todayPlan = personalizedPlan?.schedule?.find((item) => item.day === todayName);
  const todayPlanIds = todayPlan?.exercises?.map((item) => item.id) || recommendedIds;
  const todayExercises = todayPlanIds.map((id) => catalog.find((exercise) => exercise.id === id)).filter(Boolean);
  const trainingDays = profile.days?.length ? profile.days : ['Monday', 'Wednesday', 'Friday'];
  const weeklyGoal = trainingDays.length;
  const insight = buildPersonalizedInsight(profile, workoutHistory);
  const coachText = personalizedPlan?.coachNote || insight.text;
  const personalizedDays = personalizedPlan?.profile?.selectedDays || trainingDays;
  const workoutStartPath = todayReadiness ? '/workout' : '/readiness?next=workout';
  const readiness = personalizedPlan?.readiness || todayReadiness;
  const todayCalories = Math.round(workoutHistory.filter((item) => sameLocalDay(item.completedAt || item.createdAt)).reduce((sum, item) => sum + Number(item.caloriesBurned || 0), 0));
  const todayCalorieTarget = Math.round(Number(personalizedPlan?.caloriePlan?.todayTarget || todayPlan?.calorieTarget || 0));
  const weeklyCalories = Math.round(Number(progress.weeklyCalories || 0));
  const weeklyCalorieTarget = Math.round(Number(personalizedPlan?.caloriePlan?.weeklyTarget || 0));

  const dashboardStats = [
    { label: 'Today calories', value: `${todayCalories}${todayCalorieTarget ? ` / ${todayCalorieTarget}` : ''}`, note: 'estimated kcal burned / planned', tone: 'orange' },
    { label: 'Weekly calories', value: `${weeklyCalories}${weeklyCalorieTarget ? ` / ${weeklyCalorieTarget}` : ''}`, note: 'estimated kcal this week', tone: 'lime' },
    { label: 'Total reps', value: progress.totalReps.toLocaleString(), note: `${completedSessions} recorded workouts`, tone: 'cyan' },
    { label: 'Average form', value: progress.averageForm ? `${progress.averageForm}%` : '—', note: progress.bestForm ? `best session: ${progress.bestForm}%` : 'complete a camera workout', tone: 'violet' },
  ];

  return (
    <div className="app-page section-shell">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">{todayName.toUpperCase()} · {trainingDays.includes(todayName) ? 'TRAINING DAY' : 'RECOVERY / OPTIONAL DAY'}</span>
          <h1>Ready to move, {profile.name}?</h1>
          <p>{planLoading ? 'Updating your training plan…' : coachText}</p>
        </div>
        <Link className="button button-large" to={workoutStartPath}><Camera size={19} /> {todayReadiness ? 'Start workout' : 'Quick check & start'}</Link>
      </header>

      <section className="stats-grid">
        {dashboardStats.map((stat, index) => <StatCard {...stat} icon={statIcons[index]} key={stat.label} />)}
      </section>

      <div className="dashboard-grid">
        <section className="panel today-panel">
          <div className="panel-heading"><div><span className="eyebrow">TODAY'S WORKOUT</span><h2>Your planned session</h2></div><span className="duration-pill"><Clock3 size={16} /> {profile.sessionLength || 30} min</span></div>
          <div className="session-progress"><span style={{ width: `${Math.min(100, (progress.weeklySessions / Math.max(1, weeklyGoal)) * 100)}%` }} /><small>{progress.weeklySessions} sessions completed this week</small></div>
          <div className="calorie-goal-strip"><Flame /><div><small>TODAY'S ESTIMATED CALORIE GOAL</small><strong>{todayCalories} / {todayCalorieTarget || '—'} kcal</strong></div><span>{todayCalorieTarget ? `${Math.min(100, Math.round(todayCalories / Math.max(1,todayCalorieTarget) * 100))}%` : '—'}</span></div>
          <div className="today-exercises">
            {todayExercises.map((exercise, index) => {
              const dose = todayPlan?.exercises?.find((item) => item.id === exercise.id);
              return (
              <div className="today-exercise" key={exercise.id}>
                <span className={`exercise-mini-icon accent-${exercise.accent || 'cyan'}`}>{exercise.icon || '◆'}</span>
                <div><small>EXERCISE {index + 1}</small><strong>{exercise.name}</strong><span>{dose ? `${dose.sets} × ${dose.target} ${dose.unit}` : exercise.duration}</span></div>
                <Link to={`/exercises/${exercise.id}`}><ArrowRight /></Link>
              </div>
              );
            })}
          </div>
          <Link className="button button-full" to={workoutStartPath}><Play size={18} /> {todayReadiness ? 'Begin workout' : 'Quick check first'}</Link>
        </section>

        <section className="panel week-panel">
          <div className="panel-heading"><div><span className="eyebrow">YOUR WEEK</span><h2>{weeklyGoal}-session goal</h2></div><CalendarDays /></div>
          <div className="week-list">
            {weekNames.slice(1).concat(weekNames[0]).map((day) => {
              const active = day === todayName;
              const planned = personalizedDays.includes(day);
              const dayPlan = personalizedPlan?.schedule?.find((item) => item.day === day);
              return (
                <div className={`week-item ${active ? 'active' : ''}`} key={day}>
                  <span className="day-box">{shortDay(day)}</span>
                  <div><strong>{planned ? (dayPlan?.focus || 'Personalized session') : 'Recovery day'}</strong><small>{planned ? `${dayPlan?.exercises?.slice(0,2).map((item) => item.name).join(' + ') || 'Training'} · ${dayPlan?.sessionLength || profile.sessionLength || 30} min` : 'Rest or mobility'}</small></div>
                  {active ? <span className="today-tag">TODAY</span> : planned ? <i><Check size={15} /></i> : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className={`panel readiness-dashboard-card ${readiness?.band || 'unscored'}`}>
          <div className="panel-heading"><div><span className="eyebrow">HOW YOU FEEL TODAY</span><h2>{readiness ? `${readiness.score}/100 · ${readiness.band}` : 'Check in before training'}</h2></div><BatteryCharging /></div>
          {readiness ? (
            <>
              <div className="readiness-dashboard-meter"><span style={{ width: `${readiness.score || 0}%` }} /></div>
              <p>{personalizedPlan?.readiness?.message || 'Today’s plan has been adjusted from your check-in.'}</p>
              <div className="readiness-mini-stats"><span><small>VOLUME</small><strong>{personalizedPlan?.schedule?.find((item) => item.day === todayName)?.volumeMultiplier ? `${Math.round(personalizedPlan.schedule.find((item) => item.day === todayName).volumeMultiplier * 100)}%` : 'Normal'}</strong></span><span><small>EXTRA REST</small><strong>+{personalizedPlan?.schedule?.find((item) => item.day === todayName)?.restBonusSeconds || 0}s</strong></span></div>
              <Link className="text-link" to="/readiness">Update how I feel <ArrowRight size={16} /></Link>
            </>
          ) : (
            <>
              <div className="readiness-empty-icon"><Sparkles /></div>
              <p>Energy, sleep, soreness and stress can change what a sensible session looks like today. ScanRig keeps your selected day but adapts its volume and rest.</p>
              <Link className="button button-full button-secondary" to="/readiness?next=workout">Quick check-in <ArrowRight size={16} /></Link>
            </>
          )}
        </section>

        <section className="panel progress-card-panel">
          <div className="panel-heading"><div><span className="eyebrow">COACH'S NOTE</span><h2>{insight.headline}</h2></div><Award /></div>
          <div className="level-orbit"><div><strong>{String(Math.max(1, Math.floor(points / 500) + 1)).padStart(2, '0')}</strong><span>LEVEL</span></div></div>
          <div className="xp-row"><span>{points.toLocaleString()} XP</span><span>{(Math.floor(points / 500) + 1) * 500} XP</span></div>
          <div className="xp-track"><span style={{ width: `${((points % 500) / 500) * 100}%` }} /></div>
          <p>{personalizedPlan?.rationale || (insight.bmi ? `Your profile BMI is ${insight.bmi}. Your plan is driven mainly by your selected days, goal, experience, session length, and recent performance.` : 'Complete your profile and first session to unlock more tailored coaching.')}</p>
          <Link className="text-link" to="/achievements">View achievements <ArrowRight size={16} /></Link>
        </section>


        <section className="panel trainer-dashboard-card">
          <div className="panel-heading"><div><span className="eyebrow">YOUR TRAINER</span><h2>Talk to {profile.gender === 'female' ? 'Jody' : 'James'}</h2></div><MessageCircle /></div>
          <p>Ask about today’s workout, your latest form, recovery, progress, or what is coming up this week. You can type or use your microphone.</p>
          <Link className="button button-full button-secondary" to="/trainer"><MessageCircle size={17} /> Talk to my trainer</Link>
        </section>

        <section className="panel activity-panel calorie-dashboard-panel">
          <div className="panel-heading"><div><span className="eyebrow">CALORIE PROGRESS</span><h2>Your exercise burn estimate</h2></div><Flame /></div>
          <div className="large-activity-number"><strong>{progress.totalCalories || 0}</strong><span>estimated kcal across {completedSessions} workouts</span></div>
          <div className="calorie-week-summary"><span><small>THIS WEEK</small><strong>{weeklyCalories} kcal</strong></span><span><small>WEEK TARGET</small><strong>{weeklyCalorieTarget || '—'} kcal</strong></span></div>
          <div className="activity-bars">
            {[...workoutHistory.slice(0, 5)].reverse().map((session, index) => <span key={session.id || index} style={{ height: `${Math.max(10, Math.min(100, Number(session.caloriesBurned || 0) / Math.max(1, Number(session.calorieTarget || todayCalorieTarget || 1)) * 100))}%` }} title={`~${Math.round(Number(session.caloriesBurned||0))} kcal`} />)}
            {!workoutHistory.length && [18, 18, 18, 18, 18].map((height, index) => <span key={index} style={{ height: `${height}%`, opacity: .2 }} />)}
          </div>
          <small className="calorie-estimate-note">Calories are estimates based on exercise type, active time, body weight, and plan intensity.</small>
          <Link className="text-link" to="/progress">Open full progress <ArrowRight size={16} /></Link>
        </section>
      </div>
    </div>
  );
}
