import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDays, api, money, todayIso } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, ErrorState, Field, Icon, Skeleton, TextField, useDocTitle, useLoad, useToast } from '../ui.jsx';
import { ClientDialog } from './Clients.jsx';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'SGD', 'AED'];
const blankItem = () => ({ key: crypto.randomUUID(), description: '', quantity: '1', unit_price: '' });
const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
const lineCents = (it) => Math.round((Math.round(num(it.quantity) * 1000) * Math.round(num(it.unit_price) * 100)) / 1000);

export default function InvoiceEditor() {
  const { id } = useParams();
  const editing = !!id;
  useDocTitle(editing ? 'Edit invoice' : 'New invoice');
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const clients = useLoad(() => api.get('/clients?pageSize=200'), []);
  const existing = useLoad(() => (editing ? api.get(`/invoices/${id}`) : null), [id]);

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [newClient, setNewClient] = useState(false);

  useEffect(() => {
    if (editing) {
      const inv = existing.data?.invoice;
      if (inv) setForm({
        client_id: inv.client_id, currency: inv.currency, issue_date: inv.issue_date, due_date: inv.due_date,
        tax_percent: String(inv.tax_bps / 100), notes: inv.notes,
        items: inv.items.map((it) => ({ key: crypto.randomUUID(), description: it.description, quantity: String(it.quantity_milli / 1000), unit_price: (it.unit_cents / 100).toFixed(2) })),
      });
    } else {
      const t = todayIso();
      setForm({ client_id: '', currency: user.currency || 'USD', issue_date: t, due_date: addDays(t, 14), tax_percent: '0', notes: '', items: [blankItem()] });
    }
  }, [editing, existing.data, user.currency]);

  const sums = useMemo(() => {
    if (!form) return { sub: 0, tax: 0, total: 0 };
    const sub = form.items.reduce((s, it) => s + lineCents(it), 0);
    const tax = Math.round((sub * Math.round(num(form.tax_percent) * 100)) / 10000);
    return { sub, tax, total: sub + tax };
  }, [form]);

  if (existing.error) return <ErrorState error={existing.error} retry={existing.reload} />;
  if (!form || (clients.loading && !clients.data)) return <div className="stack"><Skeleton h={40} w="30%" /><Skeleton h={300} /></div>;
  if (clients.error) return <ErrorState error={clients.error} retry={clients.reload} />;

  const list = clients.data.items;
  const f = err?.fields || {};
  const set = (k) => (e) => setForm((x) => ({ ...x, [k]: e.target.value }));
  const setItem = (key, k) => (e) => setForm((x) => ({ ...x, items: x.items.map((it) => (it.key === key ? { ...it, [k]: e.target.value } : it)) }));
  const fieldErr = (path) => f[path];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const body = {
      client_id: form.client_id, currency: form.currency, issue_date: form.issue_date, due_date: form.due_date,
      tax_percent: num(form.tax_percent), notes: form.notes,
      items: form.items.map((it) => ({ description: it.description, quantity: num(it.quantity), unit_price: num(it.unit_price) })),
    };
    try {
      const r = editing ? await api.put(`/invoices/${id}`, body) : await api.post('/invoices', body);
      toast(editing ? 'Invoice updated' : `${r.invoice.label} created`);
      nav(`/app/invoices/${r.invoice.id}`);
    } catch (x) {
      setErr(x);
      toast(x.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <>
    <form onSubmit={submit} noValidate>
      <div className="page-head">
        <div><h1>{editing ? `Edit ${existing.data.invoice.label}` : 'New invoice'}</h1><p>{editing ? 'Totals update automatically.' : 'The number is assigned when you save.'}</p></div>
        <div className="actions">
          <Link className="btn btn--ghost" to={editing ? `/app/invoices/${id}` : '/app/invoices'}>Cancel</Link>
          <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Create invoice'}</Button>
        </div>
      </div>

      {err && <div className="banner banner--error" role="alert" style={{ marginBottom: 'var(--space-md)' }}>{err.message}</div>}

      <div className="editor">
        <div className="stack">
          <section className="card">
            <div className="form-grid">
              <Field label="Client" htmlFor="client" error={fieldErr('client_id')} full>
                {list.length === 0 ? (
                  <div className="banner banner--info">You haven't added a client yet. <button type="button" className="btn btn--link" onClick={() => setNewClient(true)}>Add one now</button></div>
                ) : (
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <select id="client" className="select" value={form.client_id} onChange={set('client_id')} aria-invalid={!!fieldErr('client_id')}>
                      <option value="">Choose a client</option>
                      {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button variant="ghost" onClick={() => setNewClient(true)}>New</Button>
                  </div>
                )}
              </Field>
              <TextField label="Issue date" type="date" value={form.issue_date} onChange={set('issue_date')} error={fieldErr('issue_date')} />
              <div className="field" data-invalid={fieldErr('due_date') ? 'true' : undefined}>
                <TextField label="Due date" type="date" value={form.due_date} onChange={set('due_date')} error={fieldErr('due_date')} />
                <div className="chips" role="group" aria-label="Payment terms">
                  {[[0, 'On receipt'], [7, 'Net 7'], [14, 'Net 14'], [30, 'Net 30']].map(([d, l]) => (
                    <button key={d} type="button" className="chip" aria-pressed={form.due_date === addDays(form.issue_date, d)} onClick={() => setForm((x) => ({ ...x, due_date: addDays(x.issue_date, d) }))}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="li">
            <h2 id="li" style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-md)' }}>Line items</h2>
            {fieldErr('items') && <div className="banner banner--error" role="alert" style={{ marginBottom: 'var(--space-sm)' }}>{fieldErr('items')}</div>}
            <div className="items">
              <div className="item item-head" aria-hidden="true"><span>Description</span><span>Qty</span><span>Unit price</span><span style={{ textAlign: 'right' }}>Amount</span><span /></div>
              {form.items.map((it, i) => (
                <div className="item" key={it.key}>
                  <TextField label={<span className="sr-only">Description {i + 1}</span>} placeholder="What did you do?" value={it.description} onChange={setItem(it.key, 'description')} error={fieldErr(`items.${i}.description`)} />
                  <TextField label={<span className="sr-only">Quantity {i + 1}</span>} type="number" inputMode="decimal" min="0" step="any" value={it.quantity} onChange={setItem(it.key, 'quantity')} error={fieldErr(`items.${i}.quantity`)} />
                  <TextField label={<span className="sr-only">Unit price {i + 1}</span>} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={it.unit_price} onChange={setItem(it.key, 'unit_price')} error={fieldErr(`items.${i}.unit_price`)} />
                  <div className="item__amount num" aria-label={`Line ${i + 1} amount`}>{money(lineCents(it), form.currency)}</div>
                  <button type="button" className="icon-btn" aria-label={`Remove line ${i + 1}`} disabled={form.items.length === 1} onClick={() => setForm((x) => ({ ...x, items: x.items.filter((y) => y.key !== it.key) }))}><Icon.trash /></button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'var(--space-md)' }}>
              <Button variant="ghost" size="sm" onClick={() => setForm((x) => ({ ...x, items: [...x.items, blankItem()] }))}><Icon.plus width="16" height="16" /> Add line</Button>
            </div>
          </section>

          <section className="card">
            <TextField label="Notes" as="textarea" hint="Shown on the invoice. Payment terms, thank-you, anything else." value={form.notes} onChange={set('notes')} error={fieldErr('notes')} />
          </section>
        </div>

        <aside className="card sticky" aria-label="Summary">
          <div className="stack" style={{ gap: 'var(--space-md)' }}>
            <Field label="Currency" htmlFor="cur" error={fieldErr('currency')}>
              <select id="cur" className="select" value={form.currency} onChange={set('currency')}>
                {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <TextField label="Tax rate (%)" type="number" inputMode="decimal" min="0" max="100" step="any" value={form.tax_percent} onChange={set('tax_percent')} error={fieldErr('tax_percent')} />
            <div className="sum" aria-live="polite">
              <div><span className="muted">Subtotal</span><span className="num">{money(sums.sub, form.currency)}</span></div>
              <div><span className="muted">Tax</span><span className="num">{money(sums.tax, form.currency)}</span></div>
              <div className="grand"><span>Total</span><span className="num">{money(sums.total, form.currency)}</span></div>
            </div>
            <Button type="submit" loading={busy} block>{editing ? 'Save changes' : 'Create invoice'}</Button>
          </div>
        </aside>
      </div>
    </form>
    {/* Rendered outside the <form>: submit events bubble through the React tree, and forms cannot nest. */}
    {newClient && <ClientDialog onClose={() => setNewClient(false)} onSaved={(c) => { clients.reload(); setForm((x) => ({ ...x, client_id: c.id })); setNewClient(false); }} />}
    </>
  );
}
