import { BatteryCharging, CalendarCheck, Download, Dumbbell, FileText, Flame, Gauge, Sparkles, Target } from 'lucide-react';
import StatCard from '../components/StatCard';
import { useApp } from '../context/AppContext';

function formatMinutes(seconds) { return Math.round(Number(seconds || 0) / 60); }
function csvCell(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }

export default function ProgressPage() {
  const { completedSessions, workoutHistory, progress, profile } = useApp();
  const chartSessions = [...workoutHistory].slice(0, 8).reverse();
  const latestReportSession = workoutHistory.find((item) => item.formReport?.coachSummary);
  const latestReport = latestReportSession?.formReport || null;

  const exportCsv = () => {
    const rows = [['Date','Exercises','Reps','Minutes','Estimated kcal','Calorie target','Form %','Readiness','Fatigue','XP']];
    workoutHistory.forEach((item)=>rows.push([
      new Date(item.completedAt || item.createdAt || Date.now()).toISOString(), (item.exercises || []).join(' | '), item.reps || 0,
      formatMinutes(item.durationSeconds), Math.round(Number(item.caloriesBurned || 0)), Math.round(Number(item.calorieTarget || 0)), item.formScore || 0, item.readinessScore || '', item.fatigueScore || '', item.xp || 0,
    ]));
    const blob = new Blob([rows.map((row)=>row.map(csvCell).join(',')).join('\n')], { type:'text/csv;charset=utf-8' });
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='scanrig-workout-history.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const win = window.open('', '_blank', 'noopener,noreferrer'); if (!win) return;
    const rows = workoutHistory.slice(0,20).map((item)=>`<tr><td>${new Date(item.completedAt || item.createdAt || Date.now()).toLocaleDateString()}</td><td>${(item.exercises||[]).join(', ')}</td><td>${item.reps||0}</td><td>${item.formScore||0}%</td><td>${Math.round(Number(item.caloriesBurned||0))} kcal</td><td>${formatMinutes(item.durationSeconds)} min</td></tr>`).join('');
    win.document.write(`<!doctype html><html><head><title>ScanRig progress report</title><style>body{font-family:Arial,sans-serif;padding:34px;color:#111}h1{margin-bottom:4px}p{color:#555}table{width:100%;border-collapse:collapse;margin-top:22px}td,th{border:1px solid #ddd;padding:8px;text-align:left}.stats{display:flex;gap:24px;margin:22px 0}.stats b{font-size:24px;display:block}@media print{button{display:none}}</style></head><body><h1>ScanRig Progress Report</h1><p>${profile?.name || 'User'} · generated ${new Date().toLocaleString()}</p><div class="stats"><span><b>${completedSessions}</b>workouts</span><span><b>${progress.totalReps}</b>reps</span><span><b>${progress.totalCalories || 0}</b>estimated kcal</span><span><b>${progress.averageForm || '—'}${progress.averageForm?'%':''}</b>average form</span></div><table><thead><tr><th>Date</th><th>Exercises</th><th>Reps</th><th>Form</th><th>Est. kcal</th><th>Time</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No workouts recorded yet.</td></tr>'}</tbody></table><p>Use your browser’s Print dialog and choose “Save as PDF”.</p><button onclick="window.print()">Print / Save PDF</button></body></html>`); win.document.close();
  };

  return (
    <div className="app-page section-shell progress-page">
      <header className="page-header progress-page-head"><div><span className="eyebrow">YOUR WORKOUT HISTORY</span><h1>Your progress</h1><p>See your reps, form and recovery patterns across completed workouts.</p></div><div className="progress-export-actions"><button onClick={exportCsv}><Download size={16}/> Download CSV</button><button onClick={printReport}><FileText size={16}/> Save / print PDF</button></div></header>
      <section className="stats-grid">
        <StatCard label="Completed sessions" value={completedSessions} note="your recorded workouts" tone="orange" icon={CalendarCheck} />
        <StatCard label="Total reps" value={progress.totalReps.toLocaleString()} note="all camera-tracked sessions" tone="lime" icon={Dumbbell} />
        <StatCard label="Estimated calories" value={`${progress.totalCalories || 0} kcal`} note={`${progress.weeklyCalories || 0} kcal this week`} tone="orange" icon={Flame} />
        <StatCard label="Average form" value={progress.averageForm ? `${progress.averageForm}%` : '—'} note={progress.bestForm ? `best session: ${progress.bestForm}%` : 'complete your first workout'} tone="cyan" icon={Target} />
      </section>

      <div className="progress-grid">
        <section className="panel chart-panel wide-chart"><div className="panel-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Workout volume</h2></div></div>{chartSessions.length ? <div className="bar-chart">{chartSessions.map((item,index)=><div key={item.id||index}><span className="bar-value">{item.reps}</span><i style={{height:`${Math.max(10,Math.min(100,item.reps/1.5))}%`}}/><small>S{index+1}</small></div>)}</div> : <div className="empty-progress-state">Complete a live workout to build your first progress chart.</div>}</section>
        <section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">FORM TREND</span><h2>Movement quality</h2></div><Target /></div><div className="focus-list-simple">{chartSessions.length ? chartSessions.map((item,index)=><div className="focus-row" key={item.id||index}><div><span>Session {index+1}</span><strong>{item.formScore||0}%</strong></div><i><span style={{width:`${item.formScore||0}%`}}/></i></div>) : <p>No form scores recorded yet.</p>}</div></section>
        <section className="panel chart-panel adaptive-history-panel"><div className="panel-heading"><div><span className="eyebrow">RECOVERY TREND</span><h2>Fatigue signal</h2></div><Gauge /></div>{chartSessions.some((item)=>item.fatigueScore) ? <div className="focus-list-simple">{chartSessions.map((item,index)=><div className="focus-row" key={item.id||index}><div><span>Session {index+1}</span><strong>{item.fatigueScore||0}/100</strong></div><i className="fatigue-track"><span style={{width:`${item.fatigueScore||0}%`}}/></i></div>)}</div> : <p>Your fatigue trend begins after camera-guided sessions.</p>}<small className="adaptive-history-note">A higher number means your recent rep quality dropped more during that workout.</small></section>
        {latestReport && <section className="panel latest-form-report-panel"><div className="panel-heading"><div><span className="eyebrow">LATEST FORM REPORT</span><h2>Coach report · Grade {latestReport.grade || '—'}</h2></div><Target /></div><p>{latestReport.coachSummary}</p><div className="latest-report-metrics"><span><small>CONSISTENCY</small><strong>{latestReport.consistency||0}%</strong></span><span><small>STRONG REPS</small><strong>{latestReport.strongReps||0}</strong></span><span><small>ADJUST REPS</small><strong>{latestReport.adjustReps||0}</strong></span></div><div className="latest-report-focus"><Sparkles/><span><small>NEXT FORM FOCUS</small><strong>{latestReport.focus?.name||'Movement consistency'}</strong><p>{latestReport.focusTip}</p></span></div></section>}
        <section className="panel body-progress"><span className="eyebrow">RECENT WORKOUTS</span><h2>Your session log</h2>{workoutHistory.slice(0,6).map((item,index)=><div className="focus-row session-intelligence-row" key={item.id||index}><div><span>{(item.exercises||[]).join(' · ')||'Workout'}</span><strong>+{item.xp||0} XP</strong></div><small>{new Date(item.completedAt).toLocaleDateString()} · {formatMinutes(item.durationSeconds)} min · form {item.formScore||0}%{item.readinessScore?` · today ${item.readinessScore}`:''}{item.fatigueScore?` · fatigue ${item.fatigueScore}`:''}{item.caloriesBurned?` · ~${Math.round(item.caloriesBurned)} kcal`:''}</small></div>)}{!workoutHistory.length&&<p>Nothing recorded yet. Your first completed session will appear here.</p>}</section>
      </div>
    </div>
  );
}
