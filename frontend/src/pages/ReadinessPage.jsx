import { useMemo, useState } from 'react';
import { Activity, ArrowRight, BatteryCharging, BedDouble, Brain, ShieldAlert, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const scales = {
  energy: { label: 'Energy', low: 'Drained', high: 'Energized', icon: BatteryCharging },
  sleep: { label: 'Sleep quality', low: 'Poor', high: 'Excellent', icon: BedDouble },
  soreness: { label: 'Muscle soreness', low: 'Very low', high: 'Very high', icon: Activity },
  stress: { label: 'Stress', low: 'Very low', high: 'Very high', icon: Brain },
};

function Scale({ name, value, onChange }) {
  const config = scales[name];
  const Icon = config.icon;
  return (
    <div className="readiness-scale">
      <div className="readiness-scale-title"><span><Icon size={18} /> {config.label}</span><strong>{value}/5</strong></div>
      <div className="readiness-scale-buttons">
        {[1, 2, 3, 4, 5].map((number) => (
          <button key={number} className={value === number ? 'active' : ''} onClick={() => onChange(number)}>{number}</button>
        ))}
      </div>
      <div className="readiness-scale-ends"><small>{config.low}</small><small>{config.high}</small></div>
    </div>
  );
}

export default function ReadinessPage() {
  const { todayReadiness, submitReadiness, readinessLoading } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') === 'workout' ? '/workout' : '/dashboard';
  const [form, setForm] = useState(() => ({
    energy: Number(todayReadiness?.energy || 3),
    sleep: Number(todayReadiness?.sleep || 3),
    soreness: Number(todayReadiness?.soreness || 2),
    stress: Number(todayReadiness?.stress || 2),
    discomfort: Number(todayReadiness?.discomfort || 0),
    note: todayReadiness?.note || '',
  }));
  const [assessment, setAssessment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    const raw = ((form.energy - 1) / 4) * 30 + ((form.sleep - 1) / 4) * 30 + ((5 - form.soreness) / 4) * 22 + ((5 - form.stress) / 4) * 18;
    let score = Math.round(raw);
    if (form.discomfort >= 4) score = Math.min(score, 25);
    else if (form.discomfort >= 2) score = Math.min(score, 48);
    return Math.max(0, Math.min(100, score));
  }, [form]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await submitReadiness(form);
      setAssessment(result.assessment || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save today’s check-in.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-page section-shell readiness-page">
      <header className="page-header readiness-header">
        <span className="eyebrow">HOW DO YOU FEEL TODAY?</span>
        <h1>How ready are you today?</h1>
        <p>A quick check of your energy, sleep, soreness and stress helps ScanRig choose a sensible pace and rest time for today.</p>
      </header>

      <div className="readiness-layout">
        <section className="panel readiness-form-panel">
          {Object.keys(scales).map((name) => <Scale key={name} name={name} value={form[name]} onChange={(value) => setForm((current) => ({ ...current, [name]: value }))} />)}

          <div className="readiness-scale discomfort-scale">
            <div className="readiness-scale-title"><span><ShieldAlert size={18} /> Movement discomfort</span><strong>{form.discomfort}/5</strong></div>
            <div className="readiness-scale-buttons six">
              {[0, 1, 2, 3, 4, 5].map((number) => <button key={number} className={form.discomfort === number ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, discomfort: number }))}>{number}</button>)}
            </div>
            <div className="readiness-scale-ends"><small>None</small><small>High</small></div>
          </div>

          <label className="readiness-note-field">
            <span>Optional note</span>
            <textarea maxLength={280} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Example: legs feel tired after yesterday’s session" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-full" disabled={saving || readinessLoading} onClick={save}><Sparkles size={18} /> {saving ? 'Updating today’s plan…' : todayReadiness ? 'Update today’s check-in' : 'Save today’s check-in'}</button>
          <small className="readiness-safety-note">This check-in adjusts training conservatively; it does not diagnose injury or replace professional medical guidance.</small>
        </section>

        <aside className="panel readiness-score-panel">
          <span className="eyebrow">LIVE PREVIEW</span>
          <div className={`readiness-score-orbit ${preview >= 72 ? 'ready' : preview >= 48 ? 'moderate' : 'recovery'}`}><strong>{assessment?.score ?? preview}</strong><small>/100</small></div>
          <h2>{assessment ? (assessment.band === 'ready' ? 'Ready to train' : assessment.band === 'moderate' ? 'Controlled session' : 'Recovery-biased session') : 'Today’s training score'}</h2>
          <p>{assessment?.message || 'This score reflects how you feel today and helps set the pace for your workout.'}</p>
          <div className="readiness-adjustment-list">
            <div><span>Volume</span><strong>{assessment ? `${Math.round(assessment.adjustments.volumeMultiplier * 100)}%` : 'after save'}</strong></div>
            <div><span>Extra rest</span><strong>{assessment ? `+${assessment.adjustments.restBonusSeconds}s` : 'after save'}</strong></div>
            <div><span>Mode</span><strong>{assessment?.adjustments.sessionMode || 'normal'}</strong></div>
          </div>
          {assessment && <button className="button button-full button-secondary" onClick={() => navigate(next)}>Continue <ArrowRight size={18} /></button>}
        </aside>
      </div>
    </div>
  );
}
