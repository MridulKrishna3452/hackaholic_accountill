import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmtDate, money, todayIso } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, Dialog, ErrorState, Icon, Skeleton, StatusBadge, TextField, useDocTitle, useLoad, useToast } from '../ui.jsx';

function PaymentForm({ inv, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ amount: (inv.totals.balance / 100).toFixed(2), paid_on: todayIso(), method: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post(`/invoices/${inv.id}/payments`, { ...v, amount: parseFloat(v.amount) || 0 });
      toast('Payment recorded');
      onDone(r.invoice);
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const f = err?.fields || {};
  return (
    <form onSubmit={submit} noValidate className="auth__form">
      {err && <div className="banner banner--error" role="alert">{err.message}</div>}
      <TextField label="Amount" type="number" inputMode="decimal" min="0" step="0.01" value={v.amount} onChange={set('amount')} error={f.amount} />
      <TextField label="Date received" type="date" value={v.paid_on} onChange={set('paid_on')} error={f.paid_on} />
      <TextField label="Method" placeholder="Bank transfer, cash, card…" value={v.method} onChange={set('method')} error={f.method} />
      <Button type="submit" loading={busy} block>Record payment</Button>
    </form>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { loading, data, error, reload } = useLoad(() => api.get(`/invoices/${id}`), [id]);
  const [inv, setInv] = useState(null);
  const [dlg, setDlg] = useState(null); // 'send' | 'delete'
  const [busy, setBusy] = useState('');
  const current = inv && inv.id === id ? inv : data?.invoice;
  useDocTitle(current?.label || 'Invoice');

  if (error) return <ErrorState error={error} retry={reload} />;
  if (loading && !current) return <div className="stack"><Skeleton h={40} w="30%" /><Skeleton h={420} /></div>;
  if (!current) return null;
  const t = current.totals;
  const pct = t.total ? Math.min(100, Math.round((t.paid / t.total) * 100)) : 0;
  const run = (name, fn) => async () => { setBusy(name); try { await fn(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); } };

  const send = run('send', async () => {
    const r = await api.post(`/invoices/${current.id}/send`);
    setDlg(null);
    if (r.delivered) toast(`Sent to ${r.to}`);
    else toast('Email is not set up on this server, so nothing was sent. Download the PDF instead.', 'error');
  });
  const download = run('pdf', () => api.download(`/invoices/${current.id}/pdf`, `${current.label}.pdf`));
  const remove = run('delete', async () => { await api.del(`/invoices/${current.id}`); toast(`${current.label} deleted`); nav('/app/invoices', { replace: true }); });
  const removePayment = (p) => run(`pay-${p.id}`, async () => { const r = await api.del(`/invoices/${current.id}/payments/${p.id}`); setInv(r.invoice); toast('Payment removed'); })();

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to="/app/invoices" className="muted" style={{ fontSize: 'var(--text-sm)' }}>← All invoices</Link>
          <h1 style={{ marginTop: 'var(--space-2xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>{current.label} <StatusBadge status={current.status} /></h1>
        </div>
        <div className="actions">
          <Button variant="ghost" onClick={download} loading={busy === 'pdf'}>Download PDF</Button>
          <Button onClick={() => setDlg('send')}>Email to client</Button>
          <Link className="btn btn--ghost" to={`/app/invoices/${current.id}/edit`}>Edit</Link>
          <Button variant="danger" onClick={() => setDlg('delete')}>Delete</Button>
        </div>
      </div>

      <div className="detail">
        <article className="doc" aria-label={`Invoice ${current.label}`}>
          <div className="doc__top">
            <div>
              {user.logo ? <img className="doc__logo" src={user.logo} alt="" /> : <strong style={{ fontSize: 'var(--text-lg)' }}>{user.business_name || user.name}</strong>}
            </div>
            <div style={{ textAlign: 'right' }}><h2>Invoice</h2><span className="mono muted">{current.label}</span></div>
          </div>
          <div className="doc__parties">
            <div><h4>From</h4><p><strong>{user.business_name || user.name}</strong>{'\n'}{[user.address, user.email, user.phone].filter(Boolean).join('\n')}</p></div>
            <div><h4>Billed to</h4><p><strong>{current.client_name}</strong>{'\n'}{current.client_email}</p></div>
          </div>
          <dl className="kv">
            <div><dt>Issued</dt><dd>{fmtDate(current.issue_date)}</dd></div>
            <div><dt>Due</dt><dd>{fmtDate(current.due_date)}</dd></div>
          </dl>
          <table className="list">
            <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Unit</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {current.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.description}</td>
                  <td className="right num">{it.quantity_milli / 1000}</td>
                  <td className="right num">{money(it.unit_cents, current.currency)}</td>
                  <td className="right num">{money(Math.round((it.quantity_milli * it.unit_cents) / 1000), current.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sum doc__sum">
            <div><span className="muted">Subtotal</span><span className="num">{money(t.subtotal, current.currency)}</span></div>
            <div><span className="muted">Tax ({current.tax_bps / 100}%)</span><span className="num">{money(t.tax, current.currency)}</span></div>
            <div><span className="muted">Paid</span><span className="num">{money(t.paid, current.currency)}</span></div>
            <div className="grand"><span>Balance due</span><span className="num">{money(t.balance, current.currency)}</span></div>
          </div>
          {(current.notes || user.payment_details) && (
            <div className="doc__notes">
              {current.notes && <div><h4 className="label">Notes</h4><p>{current.notes}</p></div>}
              {user.payment_details && <div><h4 className="label">Payment details</h4><p>{user.payment_details}</p></div>}
            </div>
          )}
        </article>

        <aside className="stack">
          <section className="card" aria-labelledby="pay">
            <h2 id="pay" style={{ fontSize: 'var(--text-xl)' }}>Payments</h2>
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="Paid so far"><span style={{ width: `${pct}%` }} /></div>
            <div className="sum">
              <div><span className="muted">Paid</span><span className="num">{money(t.paid, current.currency)}</span></div>
              <div className="grand"><span>Balance</span><span className="num">{money(t.balance, current.currency)}</span></div>
            </div>
            {current.payments.length > 0 && (
              <ul className="pay-list">
                {current.payments.map((p) => (
                  <li key={p.id}>
                    <div><div className="num" style={{ fontWeight: 600 }}>{money(p.amount_cents, current.currency)}</div><div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{fmtDate(p.paid_on)}{p.method ? ` · ${p.method}` : ''}</div></div>
                    <button type="button" className="icon-btn" aria-label={`Remove payment of ${money(p.amount_cents, current.currency)}`} disabled={busy === `pay-${p.id}`} onClick={() => removePayment(p)}><Icon.trash /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {t.balance > 0 ? (
            <section className="card" aria-labelledby="rec">
              <h2 id="rec" style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-md)' }}>Record a payment</h2>
              <PaymentForm key={`${current.id}-${t.paid}`} inv={current} onDone={setInv} />
            </section>
          ) : (
            <div className="banner banner--info" role="status">Fully paid. Nothing more to collect.</div>
          )}
        </aside>
      </div>

      {dlg === 'send' && (
        <Dialog title="Email this invoice?" onClose={() => setDlg(null)}
          actions={<><Button variant="ghost" onClick={() => setDlg(null)}>Cancel</Button><Button loading={busy === 'send'} onClick={send} data-autofocus>Send invoice</Button></>}>
          {current.client_email
            ? <p className="muted">{current.label} will be sent as a PDF to <strong style={{ color: 'var(--color-ink)' }}>{current.client_email}</strong>.</p>
            : <div className="banner banner--error">{current.client_name} has no email address. Add one on the Clients page first.</div>}
        </Dialog>
      )}
      {dlg === 'delete' && (
        <Dialog title={`Delete ${current.label}?`} onClose={() => setDlg(null)}
          actions={<><Button variant="ghost" onClick={() => setDlg(null)} data-autofocus>Cancel</Button><Button variant="danger" loading={busy === 'delete'} onClick={remove}>Delete invoice</Button></>}>
          <p className="muted">This permanently removes the invoice and its payments. Its number will not be reused.</p>
        </Dialog>
      )}
    </div>
  );
}
