import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, Field, TextField, useDocTitle, useToast } from '../ui.jsx';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'SGD', 'AED'];

/** Resizes the chosen image in the browser and returns a small PNG data URL. */
function toLogo(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return reject(new Error('Choose a PNG or JPEG image.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.onload = () => {
      // A data: URL (not blob:) keeps the strict Content-Security-Policy intact.
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 320 / img.width, 160 / img.height);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('That image could not be read.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  useDocTitle('Settings');
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [v, setV] = useState({ name: user.name, business_name: user.business_name, phone: user.phone, address: user.address, website: user.website, payment_details: user.payment_details, currency: user.currency, logo: user.logo });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const file = useRef(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const f = err?.fields || {};

  const pick = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    try { const logo = await toLogo(picked); setV((x) => ({ ...x, logo })); } catch (x) { toast(x.message, 'error'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.put('/profile', v);
      setUser(r.user);
      toast('Settings saved');
    } catch (x) { setErr(x); toast(x.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="page-head">
        <div><h1>Settings</h1><p>Your details appear on every invoice you send.</p></div>
        <Button type="submit" loading={busy}>Save changes</Button>
      </div>
      <div className="stack">
        <section className="card" aria-labelledby="biz">
          <h2 id="biz" style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-md)' }}>Business</h2>
          <div className="form-grid">
            <TextField label="Your name" value={v.name} onChange={set('name')} error={f.name} />
            <TextField label="Business name" value={v.business_name} onChange={set('business_name')} error={f.business_name} />
            <TextField label="Phone" type="tel" value={v.phone} onChange={set('phone')} error={f.phone} />
            <TextField label="Website" value={v.website} onChange={set('website')} error={f.website} />
            <TextField label="Address" as="textarea" full value={v.address} onChange={set('address')} error={f.address} />
            <Field label="Logo" htmlFor="logo" error={f.logo} full hint="Shown on invoices and the PDF. We shrink it for you.">
              <div className="logo-pick">
                <div className="logo-pick__preview">{v.logo ? <img src={v.logo} alt="Your logo" /> : 'No logo'}</div>
                <input ref={file} id="logo" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
                <Button variant="ghost" size="sm" onClick={() => file.current.click()}>{v.logo ? 'Replace' : 'Upload logo'}</Button>
                {v.logo && <Button variant="danger" size="sm" onClick={() => setV((x) => ({ ...x, logo: '' }))}>Remove</Button>}
              </div>
            </Field>
          </div>
        </section>

        <section className="card" aria-labelledby="pay">
          <h2 id="pay" style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-md)' }}>Getting paid</h2>
          <div className="form-grid">
            <Field label="Default currency" htmlFor="dcur">
              <select id="dcur" className="select" value={v.currency} onChange={set('currency')}>
                {[...new Set([v.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <div />
            <TextField label="Payment details" as="textarea" full hint="Bank account, PayPal, anything your client needs. Printed on each invoice." value={v.payment_details} onChange={set('payment_details')} error={f.payment_details} />
          </div>
        </section>

        <section className="card" aria-labelledby="acct">
          <h2 id="acct" style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-xs)' }}>Account</h2>
          <p className="muted">Signed in as <strong style={{ color: 'var(--color-ink)' }}>{user.email}</strong>{user.google_linked ? ' (linked to Google)' : ''}.</p>
        </section>
      </div>
    </form>
  );
}
