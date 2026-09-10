import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(form);
      if (user?.role === 'admin') navigate('/ai-lab');
      else navigate(user?.profile?.onboardingComplete ? '/dashboard' : '/onboarding');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not connect to your ScanRig account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <span className="eyebrow">WELCOME BACK</span>
        <h1>Continue your training.</h1>
        <p>Sign in to sync your training profile and workout history.</p>
        <form onSubmit={submit}>
          <label>Email address<div className="input-with-icon"><Mail /><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div></label>
          <label>Password<div className="input-with-icon"><LockKeyhole /><input type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="button button-full" disabled={submitting}>{submitting ? 'Signing in…' : 'Log in'} <ArrowRight size={18} /></button>
        </form>
        <p className="auth-switch">New to ScanRig? <Link to="/register">Create an account</Link></p>
      </section>
      <aside className="auth-visual"><div className="auth-scan-ring" /><strong>LIVE</strong><span>camera coach</span><p>Sign in to continue your own plan, progress, and workout history.</p></aside>
    </div>
  );
}
