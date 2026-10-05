import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useDocTitle, Wordmark } from '../ui.jsx';

const STEPS = [
  ['Add who you bill', 'Save a client once. Their name, email and address fill every invoice after that.'],
  ['Write the invoice', 'Line items, tax and a due date. Folio does the arithmetic and numbers it for you, in order, without gaps or repeats.'],
  ['Send it as a PDF', 'One click emails a clean PDF to the address on file for that client. You can also download it.'],
  ['Record payments', 'Log each payment as it lands. The balance and the status (unpaid, part-paid, paid, overdue) follow on their own.'],
];

const KEPT = [
  ['Your books stay yours', 'Every request is checked against your sign-in. Nobody else can open your invoices or clients, even with a guessed link.'],
  ['Totals can’t be edited by hand', 'The server calculates every total and status from the line items and payments. Nothing is taken on trust from the browser.'],
  ['Numbers never repeat', 'Invoice numbers come from a counter on the server, so deleting one never causes another to reuse its number.'],
  ['Mail goes where it should', 'Invoices are only ever emailed to the address saved on the client, never to one typed into a request.'],
];

export default function Landing() {
  useDocTitle('');
  const { user } = useAuth();
  return (
    <>
      <header className="site-nav">
        <Wordmark />
        <nav className="site-nav__links" aria-label="Account">
          {user ? <Link className="btn btn--sm" to="/app">Open dashboard</Link> : (
            <>
              <Link to="/signin">Sign in</Link>
              <Link className="btn btn--sm" to="/signup">Start free</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div>
            <h1>Invoices that get <span>paid</span>, not lost.</h1>
            <p className="hero__lede">Folio is invoicing for freelancers and small studios. Write an invoice, send it as a PDF, and watch every payment settle the balance.</p>
            <div className="hero__cta">
              <Link className="btn" to={user ? '/app' : '/signup'}>{user ? 'Open dashboard' : 'Create your first invoice'}</Link>
              {!user && <Link className="btn btn--ghost" to="/signin">I have an account</Link>}
            </div>
            <p className="hero__note">Free to run. Your data lives on your own server.</p>
          </div>

          <figure className="specimen" aria-label="Sample invoice">
            <div className="specimen__head">
              <div>
                <div className="specimen__title">Invoice</div>
                <div className="muted mono">INV-0007 · sample</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }}>
                <div className="muted">Billed to</div>
                <strong>Northlight Studio</strong>
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <div className="specimen__row"><span>Brand identity, round two</span><span className="num">$1,800.00</span></div>
              <div className="specimen__row"><span>Landing page build (12 hrs)</span><span className="num">$1,440.00</span></div>
              <div className="specimen__row"><span>Hosting setup</span><span className="num">$120.00</span></div>
            </div>
            <div className="specimen__total"><span>Balance due</span><span className="num">$0.00</span></div>
            <div className="specimen__stamp" aria-hidden="true">PAID</div>
          </figure>
        </section>

        <section className="section" aria-labelledby="how">
          <h2 id="how">From blank page to paid in four steps</h2>
          <ol className="steps">
            {STEPS.map(([t, d], i) => (
              <li key={t}><span className="steps__n" aria-hidden="true">{i + 1}</span><div><h3>{t}</h3><p>{d}</p></div></li>
            ))}
          </ol>
        </section>

        <section className="section" aria-labelledby="kept">
          <h2 id="kept">Built to be trusted with money</h2>
          <div className="kept">
            {KEPT.map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </section>

        <section className="closer">
          <div className="closer__inner">
            <h2>Send your next invoice in about two minutes.</h2>
            <Link className="btn" to={user ? '/app' : '/signup'}>{user ? 'Open dashboard' : 'Start free'}</Link>
          </div>
        </section>
      </main>

      <footer className="site-foot">
        <span>Folio · invoicing for freelancers</span>
        <span>No tracking. No ads.</span>
      </footer>
    </>
  );
}
