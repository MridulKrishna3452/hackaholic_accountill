import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, TextField, useDocTitle, Wordmark } from '../ui.jsx';

function Frame({ title, sub, children }) {
  useDocTitle(title);
  return (
    <div className="auth">
      <aside className="auth__side">
        <Wordmark />
        <div>
          <h2>The calm way to get paid.</h2>
          <p>Invoices, payments and clients, in one quiet place.</p>
        </div>
        <span style={{ fontSize: 'var(--text-sm)', opacity: 0.8 }}>Folio</span>
      </aside>
      <main className="auth__main">
        <div className="auth__card">
          <div><h1>{title}</h1>{sub && <p className="muted" style={{ marginTop: 'var(--space-xs)' }}>{sub}</p>}</div>
          {children}
        </div>
      </main>
    </div>
  );
}

function useForm(initial, submit) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try { await submit(v); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return { v, set, busy, err, onSubmit, fields: err?.fields || {} };
}

function GoogleButton({ onDone, onError }) {
  const box = useRef(null);
  const [clientId, setClientId] = useState(null);
  const cb = useRef({ onDone, onError });
  cb.current = { onDone, onError };
  useEffect(() => { api.get('/auth/config').then((c) => setClientId(c.googleClientId)).catch(() => {}); }, []);
  useEffect(() => {
    if (!clientId || !box.current) return;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try { cb.current.onDone(await api.post('/auth/google', { credential })); } catch (e) { cb.current.onError(e); }
        },
      });
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', width: Math.min(400, box.current.clientWidth || 380), text: 'continue_with' });
    };
    if (window.google?.accounts?.id) init();
    else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    }
    return () => { cancelled = true; };
  }, [clientId]);
  if (!clientId) return null;
  return (<><div ref={box} style={{ minHeight: 44 }} /><div className="divider">or</div></>);
}

export function SignIn() {
  const { accept } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const dest = loc.state?.from?.startsWith('/app') ? loc.state.from : '/app';
  const f = useForm({ email: '', password: '' }, async (v) => { accept(await api.post('/auth/signin', v)); nav(dest, { replace: true }); });
  return (
    <Frame title="Welcome back" sub="Sign in to your invoices.">
      <GoogleButton onDone={(r) => { accept(r); nav(dest, { replace: true }); }} onError={() => {}} />
      <form className="auth__form" onSubmit={f.onSubmit} noValidate>
        {f.err && <div className="banner banner--error" role="alert">{f.err.message}</div>}
        <TextField label="Email" type="email" autoComplete="email" value={f.v.email} onChange={f.set('email')} error={f.fields.email} required />
        <TextField label="Password" type="password" autoComplete="current-password" value={f.v.password} onChange={f.set('password')} required />
        <Button type="submit" loading={f.busy} block>Sign in</Button>
      </form>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 'var(--text-sm)' }}>
        <Link to="/forgot">Forgot password?</Link>
        <span className="muted">New here? <Link to="/signup">Create an account</Link></span>
      </div>
    </Frame>
  );
}

export function SignUp() {
  const { accept } = useAuth();
  const nav = useNavigate();
  const f = useForm({ name: '', email: '', password: '' }, async (v) => { accept(await api.post('/auth/signup', v)); nav('/app', { replace: true }); });
  return (
    <Frame title="Create your account" sub="Takes about a minute. No card needed.">
      <GoogleButton onDone={(r) => { accept(r); nav('/app', { replace: true }); }} onError={() => {}} />
      <form className="auth__form" onSubmit={f.onSubmit} noValidate>
        {f.err && <div className="banner banner--error" role="alert">{f.err.message}</div>}
        <TextField label="Your name" autoComplete="name" value={f.v.name} onChange={f.set('name')} error={f.fields.name} required />
        <TextField label="Email" type="email" autoComplete="email" value={f.v.email} onChange={f.set('email')} error={f.fields.email} required />
        <TextField label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." value={f.v.password} onChange={f.set('password')} error={f.fields.password} required />
        <Button type="submit" loading={f.busy} block>Create account</Button>
      </form>
      <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>Already have an account? <Link to="/signin">Sign in</Link></span>
    </Frame>
  );
}

export function Forgot() {
  const [done, setDone] = useState(null);
  const f = useForm({ email: '' }, async (v) => { setDone((await api.post('/auth/forgot', v)).message); });
  return (
    <Frame title="Reset your password" sub="We'll email you a link that works for one hour.">
      {done ? <div className="banner banner--info" role="status">{done}</div> : (
        <form className="auth__form" onSubmit={f.onSubmit} noValidate>
          {f.err && <div className="banner banner--error" role="alert">{f.err.message}</div>}
          <TextField label="Email" type="email" autoComplete="email" value={f.v.email} onChange={f.set('email')} error={f.fields.email} required />
          <Button type="submit" loading={f.busy} block>Send reset link</Button>
        </form>
      )}
      <Link to="/signin" style={{ fontSize: 'var(--text-sm)' }}>Back to sign in</Link>
    </Frame>
  );
}

export function Reset() {
  const { token } = useParams();
  const nav = useNavigate();
  const [done, setDone] = useState(false);
  const f = useForm({ password: '' }, async (v) => { await api.post('/auth/reset', { token, password: v.password }); setDone(true); });
  return (
    <Frame title="Choose a new password">
      {done ? (
        <div className="auth__form">
          <div className="banner banner--info" role="status">Password updated. You can sign in now.</div>
          <Button onClick={() => nav('/signin')} block>Go to sign in</Button>
        </div>
      ) : (
        <form className="auth__form" onSubmit={f.onSubmit} noValidate>
          {f.err && <div className="banner banner--error" role="alert">{f.err.message}</div>}
          <TextField label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={f.v.password} onChange={f.set('password')} error={f.fields.password} required />
          <Button type="submit" loading={f.busy} block>Update password</Button>
        </form>
      )}
    </Frame>
  );
}
