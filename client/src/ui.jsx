import { Link } from 'react-router-dom';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';

/* ---------- Icons (inline, stroke) ---------- */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const Icon = {
  home: (p) => <svg viewBox="0 0 24 24" {...P} {...p}><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" /></svg>,
  doc: (p) => <svg viewBox="0 0 24 24" {...P} {...p}><path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" /></svg>,
  users: (p) => <svg viewBox="0 0 24 24" {...P} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></svg>,
  cog: (p) => <svg viewBox="0 0 24 24" {...P} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" {...P} {...p}><path d="M12 5v14M5 12h14" /></svg>,
  trash: (p) => <svg viewBox="0 0 24 24" {...P} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  check: (p) => <svg viewBox="0 0 24 24" {...P} strokeWidth={2.4} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  x: (p) => <svg viewBox="0 0 24 24" {...P} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>,
};

export function Wordmark({ to = '/' }) {
  return (
    <Link className="wordmark" to={to} aria-label="Folio home">
      <span className="wordmark__mark" aria-hidden="true">F</span>Folio
    </Link>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, kind = 'ok') => {
    const id = crypto.randomUUID();
    setItems((xs) => [...xs, { id, message, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'toast--error' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <span>{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}><Icon.x width="14" height="14" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Button with loading state ---------- */
export function Button({ loading, variant, size, block, className = '', children, ...rest }) {
  const cls = ['btn', variant && `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', className].filter(Boolean).join(' ');
  return <button type="button" {...rest} className={cls} data-loading={loading ? 'true' : undefined} disabled={rest.disabled || loading} aria-busy={loading || undefined}>{children}</button>;
}

/* ---------- Field ---------- */
export function Field({ label, hint, error, full, children, htmlFor }) {
  return (
    <div className={`field ${full ? 'full' : ''}`} data-invalid={error ? 'true' : undefined}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="error" id={`${htmlFor}-err`} role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({ label, hint, error, full, as = 'input', ...rest }) {
  const id = useId();
  const Tag = as === 'textarea' ? 'textarea' : 'input';
  return (
    <Field label={label} hint={hint} error={error} full={full} htmlFor={id}>
      <Tag id={id} className={as === 'textarea' ? 'textarea' : 'input'} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
    </Field>
  );
}

/* ---------- Dialog (focus trap, Esc, scroll lock) ---------- */
export function Dialog({ title, onClose, children, actions }) {
  const ref = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onClose = () => closeRef.current();
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
    (el.querySelector('[data-autofocus]') || focusables()[0] || el).focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key !== 'Tab') return;
      const f = [...focusables()];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, []);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>
        {children}
        {actions && <div className="dialog__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const label = { paid: 'Paid', partial: 'Part-paid', overdue: 'Overdue', unpaid: 'Unpaid' }[status] || status;
  return <span className={`badge badge--${status}`}>{label}</span>;
}

export const Skeleton = ({ h = 20, w = '100%' }) => <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />;

export function Empty({ title, children, action }) {
  return <div className="empty"><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function ErrorState({ error, retry }) {
  return (
    <div className="card" role="alert">
      <div className="empty">
        <h3>That didn't load</h3>
        <p>{error?.message || 'Something went wrong.'}</p>
        {retry && <Button variant="ghost" onClick={retry}>Try again</Button>}
      </div>
    </div>
  );
}

/** Data hook: always resolves loading, never leaves a spinner stuck on error. */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(fn).then(
      (data) => live && setState({ loading: false, data, error: null }),
      (error) => live && setState({ loading: false, data: null, error }),
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function useDocTitle(t) {
  useEffect(() => { document.title = t ? `${t} · Folio` : 'Folio · Invoicing for freelancers'; }, [t]);
}
