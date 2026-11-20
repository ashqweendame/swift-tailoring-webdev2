import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { homeFor, useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(form.username.trim(), form.password);
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Navbar right={<Link className="link-muted" to="/">Track Orders</Link>} />
      <div className="auth-container">
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="auth-card">
          <div className="auth-header">
            <h1>Welcome Back</h1>
            <p className="muted">Swift Tailoring Access Gateway</p>
          </div>
          <form className="auth-body" onSubmit={submit}>
            <div className="field">
              <label htmlFor="u">Username</label>
              <input id="u" className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Enter workspace handle" autoComplete="username" required />
            </div>
            <div className="field">
              <label htmlFor="p">Password</label>
              <input id="p" type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete="current-password" required />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign In to Workspace'}</button>
          </form>
          <div className="auth-footer">
            <p className="brand-script">Swift Tailoring</p>
            <p className="brand-tagline">Elegance In Motion</p>
          </div>
        </div>
      </div>
    </>
  );
}
