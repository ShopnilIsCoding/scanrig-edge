import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function RegisterPage() {
  const { register } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/onboarding');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <span className="eyebrow">CREATE YOUR ACCOUNT</span>
        <h1>Save your plan and progress.</h1>
        <p>Create an account to save your training profile and workout history.</p>
        <form onSubmit={submit}>
          <label>Full name<div className="input-with-icon"><UserRound /><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div></label>
          <label>Email address<div className="input-with-icon"><Mail /><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div></label>
          <label>Password<div className="input-with-icon"><LockKeyhole /><input type="password" required minLength="6" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="button button-full" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'} <ArrowRight size={18} /></button>
        </form>
        <p className="auth-switch">Already registered? <Link to="/login">Log in</Link></p>
      </section>
      <aside className="auth-visual register-visual"><div className="auth-scan-ring" /><strong>YOUR</strong><span>training partner</span><p>Plans, camera workouts, progress and rewards in one account.</p></aside>
    </div>
  );
}
