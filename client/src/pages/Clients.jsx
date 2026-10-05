import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Dialog, Empty, ErrorState, Icon, Skeleton, TextField, useDocTitle, useLoad, useToast } from '../ui.jsx';

const BLANK = { name: '', email: '', phone: '', address: '' };

/** Shared by the Clients page and the invoice editor's "new client" flow. */
export function ClientDialog({ client, onClose, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState(client ? { name: client.name, email: client.email, phone: client.phone, address: client.address } : BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = client ? await api.put(`/clients/${client.id}`, v) : await api.post('/clients', v);
      toast(client ? 'Client updated' : 'Client added');
      onSaved(r.client);
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const f = err?.fields || {};
  return (
    <Dialog title={client ? 'Edit client' : 'New client'} onClose={onClose}>
      <form className="auth__form" onSubmit={submit} noValidate id="client-form">
        {err && !Object.keys(f).length && <div className="banner banner--error" role="alert">{err.message}</div>}
        <TextField label="Name" value={v.name} onChange={set('name')} error={f.name} data-autofocus required />
        <TextField label="Email" type="email" hint="Invoices are emailed to this address." value={v.email} onChange={set('email')} error={f.email} />
        <TextField label="Phone" type="tel" value={v.phone} onChange={set('phone')} error={f.phone} />
        <TextField label="Address" as="textarea" value={v.address} onChange={set('address')} error={f.address} />
      </form>
      <div className="dialog__actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="client-form" loading={busy}>{client ? 'Save changes' : 'Add client'}</Button>
      </div>
    </Dialog>
  );
}

export default function Clients() {
  useDocTitle('Clients');
  const toast = useToast();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null); // null | {} (new) | client
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 250); return () => clearTimeout(t); }, [q]);
  const { loading, data, error, reload } = useLoad(() => api.get(`/clients?page=${page}&pageSize=10&q=${encodeURIComponent(dq)}`), [page, dq]);

  const remove = async () => {
    setDeleting(true);
    try {
      await api.del(`/clients/${del.id}`);
      toast('Client deleted');
      setDel(null);
      if (data.items.length === 1 && page > 1) setPage(page - 1); else reload();
    } catch (e) { toast(e.message, 'error'); setDel(null); } finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="page-head">
        <div><h1>Clients</h1><p>The people and companies you bill.</p></div>
        <Button onClick={() => setEdit({})}><Icon.plus width="18" height="18" /> New client</Button>
      </div>
      <div className="toolbar"><input className="input" type="search" placeholder="Search name or email" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} /></div>

      {error ? <ErrorState error={error} retry={reload} /> : (
        <div className="card card--flush">
          {loading && !data ? <div style={{ padding: 'var(--space-lg)', display: 'grid', gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={28} />)}</div>
            : data.items.length === 0 ? (
              <Empty title={dq ? 'No clients match' : 'No clients yet'} action={!dq && <Button onClick={() => setEdit({})}>Add your first client</Button>}>
                {dq ? 'Try a different search.' : 'Add a client once and reuse them on every invoice.'}
              </Empty>
            ) : (
              <>
                <table className="list stackable" style={{ opacity: loading ? 0.6 : 1 }}>
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th className="right">Invoices</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {data.items.map((c) => (
                      <tr key={c.id}>
                        <td data-label="Name"><strong>{c.name}</strong></td>
                        <td data-label="Email">{c.email || <span className="muted">No email</span>}</td>
                        <td data-label="Phone">{c.phone || <span className="muted">-</span>}</td>
                        <td data-label="Invoices" className="right num">{c.invoice_count}</td>
                        <td className="right"><div className="actions" style={{ justifyContent: 'flex-end' }}>
                          <Button variant="ghost" size="sm" onClick={() => setEdit(c)} aria-label={`Edit ${c.name}`}>Edit</Button>
                          <Button variant="danger" size="sm" onClick={() => setDel(c)} aria-label={`Delete ${c.name}`}>Delete</Button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.pages > 1 && (
                  <div className="pager">
                    <span>Page {data.page} of {data.pages} · {data.total} clients</span>
                    <div className="actions">
                      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                      <Button variant="ghost" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
        </div>
      )}

      {edit && <ClientDialog client={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {del && (
        <Dialog title={`Delete ${del.name}?`} onClose={() => setDel(null)}
          actions={<><Button variant="ghost" onClick={() => setDel(null)} data-autofocus>Cancel</Button><Button variant="danger" loading={deleting} onClick={remove}>Delete client</Button></>}>
          <p className="muted">This removes the client. Clients that already have invoices can't be deleted.</p>
        </Dialog>
      )}
    </div>
  );
}
