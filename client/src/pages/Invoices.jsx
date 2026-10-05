import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fmtDate, money } from '../api.js';
import { Button, Empty, ErrorState, Icon, Skeleton, StatusBadge, useDocTitle, useLoad } from '../ui.jsx';

const FILTERS = [['', 'All'], ['unpaid', 'Unpaid'], ['partial', 'Part-paid'], ['overdue', 'Overdue'], ['paid', 'Paid']];

export default function Invoices() {
  useDocTitle('Invoices');
  const nav = useNavigate();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 250); return () => clearTimeout(t); }, [q]);
  const { loading, data, error, reload } = useLoad(
    () => api.get(`/invoices?page=${page}&status=${status}&q=${encodeURIComponent(dq)}`),
    [page, status, dq],
  );
  const filtered = status || dq;

  return (
    <div>
      <div className="page-head">
        <div><h1>Invoices</h1><p>Every invoice you have written.</p></div>
        <Link className="btn" to="/app/invoices/new"><Icon.plus width="18" height="18" /> New invoice</Link>
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filter by status">
          {FILTERS.map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={status === v} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>)}
        </div>
        <input className="input" type="search" placeholder="Search client or number" aria-label="Search invoices" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: 'auto' }} />
      </div>

      {error ? <ErrorState error={error} retry={reload} /> : (
        <div className="card card--flush">
          {loading && !data ? <div style={{ padding: 'var(--space-lg)', display: 'grid', gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={28} />)}</div>
            : data.items.length === 0 ? (
              <Empty title={filtered ? 'No invoices match' : 'No invoices yet'} action={!filtered && <Link className="btn" to="/app/invoices/new">Create your first invoice</Link>}>
                {filtered ? 'Try another status or search.' : 'Create one and it will show up here with its payment status.'}
              </Empty>
            ) : (
              <>
                <table className="list stackable" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity var(--dur-base)' }}>
                  <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th className="right">Total</th><th className="right">Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.items.map((i) => (
                      <tr key={i.id} onClick={(e) => { if (!e.target.closest('a')) nav(`/app/invoices/${i.id}`); }} style={{ cursor: 'pointer' }}>
                        <td data-label="Invoice"><Link className="row-link mono" to={`/app/invoices/${i.id}`}>{i.label}</Link></td>
                        <td data-label="Client">{i.client_name}</td>
                        <td data-label="Due" className="num">{fmtDate(i.due_date)}</td>
                        <td data-label="Total" className="right num">{money(i.totals.total, i.currency)}</td>
                        <td data-label="Balance" className="right num">{money(i.totals.balance, i.currency)}</td>
                        <td data-label="Status"><StatusBadge status={i.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.pages > 1 && (
                  <div className="pager">
                    <span>Page {data.page} of {data.pages} · {data.total} invoices</span>
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
    </div>
  );
}
