import { Link } from 'react-router-dom';
import { api, fmtDate, money } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Empty, ErrorState, Icon, Skeleton, StatusBadge, useDocTitle, useLoad } from '../ui.jsx';

export default function Dashboard() {
  useDocTitle('Home');
  const { user } = useAuth();
  const s = useLoad(() => api.get('/stats'), []);
  const c = useLoad(() => api.get('/clients?pageSize=1'), []);
  const first = user.name.split(' ')[0];

  if (s.error) return <ErrorState error={s.error} retry={s.reload} />;
  const d = s.data;
  const profileDone = !!(user.business_name && user.address);
  const hasClient = (c.data?.total || 0) > 0;
  const hasInvoice = (d?.counts.total || 0) > 0;
  const max = Math.max(1, ...(d?.months.map((m) => m.amount) || [1]));

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Hello, {first}.</h1><p>Here is where your money stands.</p></div>
        <Link className="btn" to="/app/invoices/new"><Icon.plus width="18" height="18" /> New invoice</Link>
      </div>

      <div className="stats">
        {!d ? [0, 1, 2].map((i) => <div className="stat" key={i}><Skeleton h={14} w="40%" /><div style={{ height: 10 }} /><Skeleton h={32} w="60%" /></div>) : (
          <>
            <div className="stat"><div className="stat__label">Received</div><div className="stat__value num">{money(d.totals.received, d.currency)}</div><div className="stat__sub">All payments recorded</div></div>
            <div className="stat"><div className="stat__label">Outstanding</div><div className="stat__value num">{money(d.totals.outstanding, d.currency)}</div><div className="stat__sub">{d.counts.open} open invoice{d.counts.open === 1 ? '' : 's'}</div></div>
            <div className={`stat ${d.totals.overdue_count ? 'stat--alert' : ''}`}><div className="stat__label">Overdue</div><div className="stat__value num">{money(d.totals.overdue, d.currency)}</div><div className="stat__sub">{d.totals.overdue_count ? `${d.totals.overdue_count} past due` : 'Nothing past due'}</div></div>
          </>
        )}
      </div>
      {d?.other_currencies.length > 0 && <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>Totals show {d.currency}. You also have invoices in {d.other_currencies.join(', ')}.</p>}

      {d && !(profileDone && hasClient && hasInvoice) && (
        <div className="card">
          <h3 style={{ fontSize: 'var(--text-xl)' }}>Get set up</h3>
          <ul className="checklist">
            {[
              [profileDone, 'Add your business details', '/app/settings', 'Open settings'],
              [hasClient, 'Add your first client', '/app/clients', 'Add client'],
              [hasInvoice, 'Create your first invoice', '/app/invoices/new', 'Create invoice'],
            ].map(([done, label, to, cta]) => (
              <li key={label}>
                <span className="tick" data-done={done} aria-hidden="true">{done && <Icon.check width="12" height="12" />}</span>
                <span style={done ? { color: 'var(--color-muted)', textDecoration: 'line-through' } : undefined}>{label}</span>
                {!done && <Link to={to} style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)' }}>{cta}</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="two-col">
        <section className="card" aria-labelledby="rec">
          <h2 id="rec" style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Payments received, last 6 months</h2>
          {!d ? <Skeleton h={190} /> : (
            <div className="bars" role="img" aria-label={`Payments received per month: ${d.months.map((m) => `${m.label} ${money(m.amount, d.currency)}`).join(', ')}`}>
              {d.months.map((m) => (
                <div className="bar" key={m.key} title={`${m.label}: ${money(m.amount, d.currency)}`}>
                  <div className="bar__col" data-zero={m.amount === 0} style={{ height: `${Math.max(2, (m.amount / max) * 100)}%` }} />
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card card--flush" aria-labelledby="recent">
          <div style={{ padding: 'var(--space-lg) var(--space-lg) var(--space-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 id="recent" style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Recent invoices</h2>
            <Link to="/app/invoices" style={{ fontSize: 'var(--text-sm)' }}>View all</Link>
          </div>
          {!d ? <div style={{ padding: 'var(--space-lg)' }}><Skeleton h={80} /></div> : d.recent.length === 0 ? (
            <Empty title="No invoices yet">Your latest invoices will appear here.</Empty>
          ) : (
            <ul className="pay-list" style={{ margin: 0, padding: '0 var(--space-lg) var(--space-sm)' }}>
              {d.recent.map((i) => (
                <li key={i.id}>
                  <div style={{ minWidth: 0 }}>
                    <Link className="row-link" style={{ fontWeight: 600, textDecoration: 'none' }} to={`/app/invoices/${i.id}`}>{i.label}</Link>
                    <div className="muted" style={{ fontSize: 'var(--text-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.client_name} · due {fmtDate(i.due_date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}><div className="num" style={{ fontWeight: 600 }}>{money(i.totals.total, i.currency)}</div><StatusBadge status={i.status} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
