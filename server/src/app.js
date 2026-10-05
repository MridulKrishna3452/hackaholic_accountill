import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { ZodError } from 'zod';
import { tx } from './db.js';
import { HttpError, notFound, wrap } from './errors.js';
import { requireAuth, signToken } from './auth.js';
import { totals as calcTotals, statusOf } from './money.js';
import { renderInvoicePdf, invoiceLabel } from './pdf.js';
import { sendMail } from './mail.js';
import * as S from './schemas.js';

const id = () => crypto.randomUUID();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const today = () => new Date().toISOString().slice(0, 10);
const DUMMY_HASH = bcrypt.hashSync('folio-dummy-password', 10);
const limiterOff = () => process.env.RATE_LIMIT === 'off';
const toCents = (n) => Math.round(n * 100);

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, business_name: u.business_name, phone: u.phone,
  address: u.address, website: u.website, payment_details: u.payment_details, logo: u.logo,
  currency: u.currency, has_password: !!u.password_hash, google_linked: !!u.google_sub,
});

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        frameSrc: ['https://accounts.google.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  app.use(express.json({ limit: '600kb' }));

  const api = express.Router();
  const auth = requireAuth(db);
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: limiterOff, message: { error: 'Too many attempts. Try again in a few minutes.' } });
  const sendLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, skip: limiterOff, keyGenerator: (req) => req.userId, validate: false, message: { error: 'You can send 10 invoices per hour. Try again later.' } });

  const q = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  };

  // ---------- Auth (public) ----------
  const session = (u) => ({ token: signToken(u.id), user: publicUser(u) });

  api.post('/auth/signup', authLimiter, wrap((req, res) => {
    const b = S.signup.parse(req.body);
    if (q.userByEmail.get(b.email)) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
    const uid = id();
    db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?,?,?,?)').run(uid, b.email, b.name, bcrypt.hashSync(b.password, 10));
    res.status(201).json(session(q.userById.get(uid)));
  }));

  api.post('/auth/signin', authLimiter, wrap((req, res) => {
    const b = S.signin.parse(req.body);
    const u = q.userByEmail.get(b.email);
    // Always run one bcrypt compare so response time doesn't reveal whether the email exists.
    const ok = bcrypt.compareSync(b.password, u?.password_hash || DUMMY_HASH);
    if (!u || !u.password_hash || !ok) throw new HttpError(401, 'Invalid email or password');
    res.json(session(u));
  }));

  api.get('/auth/config', (_req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null }));

  api.post('/auth/google', authLimiter, wrap(async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) throw new HttpError(501, 'Google sign-in is not configured on this server');
    const { credential } = S.google.parse(req.body);
    let p;
    try {
      const ticket = await new OAuth2Client(process.env.GOOGLE_CLIENT_ID).verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
      p = ticket.getPayload();
    } catch { throw new HttpError(401, 'Google sign-in could not be verified'); }
    if (!p?.sub || !p.email || !p.email_verified) throw new HttpError(401, 'Google account email is not verified');
    const email = p.email.toLowerCase();
    // The stable Google `sub` links repeat sign-ins to one Folio user.
    let u = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(p.sub) || q.userByEmail.get(email);
    if (!u) {
      const uid = id();
      db.prepare('INSERT INTO users (id, email, name, google_sub) VALUES (?,?,?,?)').run(uid, email, p.name || email.split('@')[0], p.sub);
      u = q.userById.get(uid);
    } else if (!u.google_sub) {
      db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(p.sub, u.id);
      u = q.userById.get(u.id);
    }
    res.json(session(u));
  }));

  api.post('/auth/forgot', authLimiter, wrap(async (req, res) => {
    const { email } = S.forgot.parse(req.body);
    const u = q.userByEmail.get(email);
    if (u) {
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT OR REPLACE INTO reset_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)').run(u.id, sha256(token), Date.now() + 3600_000);
      const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      try {
        await sendMail({ to: u.email, subject: 'Reset your Folio password', text: `Use this link within one hour to choose a new password:\n\n${base}/reset/${token}\n\nIf you did not ask for this, ignore this email.` });
      } catch (e) { console.error('reset mail failed:', e.message); }
    }
    res.json({ message: 'If that email has an account, a reset link is on its way.' });
  }));

  api.post('/auth/reset', authLimiter, wrap((req, res) => {
    const b = S.reset.parse(req.body);
    const row = db.prepare('SELECT * FROM reset_tokens WHERE token_hash = ?').get(sha256(b.token));
    if (!row || row.expires_at < Date.now()) throw new HttpError(400, 'This reset link is invalid or has expired');
    tx(db, () => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(b.password, 10), row.user_id);
      db.prepare('DELETE FROM reset_tokens WHERE user_id = ?').run(row.user_id);
    });
    res.json({ message: 'Password updated. You can sign in now.' });
  }));

  // ---------- Everything below requires a verified token ----------
  api.use(auth);

  api.get('/auth/me', (req, res) => res.json({ user: publicUser(q.userById.get(req.userId)) }));

  api.get('/profile', (req, res) => res.json({ user: publicUser(q.userById.get(req.userId)) }));
  api.put('/profile', wrap((req, res) => {
    const b = S.profile.parse(req.body);
    db.prepare('UPDATE users SET name=?, business_name=?, phone=?, address=?, website=?, payment_details=?, currency=?, logo=? WHERE id=?')
      .run(b.name, b.business_name, b.phone, b.address, b.website, b.payment_details, b.currency, b.logo, req.userId);
    res.json({ user: publicUser(q.userById.get(req.userId)) });
  }));

  // ---------- Clients (always scoped to the verified user) ----------
  const ownClient = (uid, cid) => db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(cid, uid);

  api.get('/clients', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const size = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 20));
    const term = `%${String(req.query.q || '').trim().replace(/[%_]/g, '')}%`;
    const where = 'c.user_id = ? AND (c.name LIKE ? OR c.email LIKE ?)';
    const total = db.prepare(`SELECT COUNT(*) n FROM clients c WHERE ${where}`).get(req.userId, term, term).n;
    const items = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id) AS invoice_count FROM clients c WHERE ${where} ORDER BY c.created_at DESC, c.rowid DESC LIMIT ? OFFSET ?`)
      .all(req.userId, term, term, size, (page - 1) * size);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / size)) });
  });

  api.post('/clients', wrap((req, res) => {
    const b = S.client.parse(req.body);
    const cid = id();
    db.prepare('INSERT INTO clients (id, user_id, name, email, phone, address) VALUES (?,?,?,?,?,?)').run(cid, req.userId, b.name, b.email, b.phone, b.address);
    res.status(201).json({ client: ownClient(req.userId, cid) });
  }));

  api.put('/clients/:id', wrap((req, res) => {
    if (!ownClient(req.userId, req.params.id)) throw notFound('Client not found');
    const b = S.client.parse(req.body);
    db.prepare('UPDATE clients SET name=?, email=?, phone=?, address=? WHERE id=? AND user_id=?').run(b.name, b.email, b.phone, b.address, req.params.id, req.userId);
    res.json({ client: ownClient(req.userId, req.params.id) });
  }));

  api.delete('/clients/:id', wrap((req, res) => {
    if (!ownClient(req.userId, req.params.id)) throw notFound('Client not found');
    const n = db.prepare('SELECT COUNT(*) c FROM invoices WHERE client_id = ?').get(req.params.id).c;
    if (n > 0) throw new HttpError(409, `This client has ${n} invoice${n === 1 ? '' : 's'}. Delete those first.`);
    db.prepare('DELETE FROM clients WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.status(204).end();
  }));

  // ---------- Invoices ----------
  function hydrate(inv) {
    const items = db.prepare('SELECT description, quantity_milli, unit_cents FROM invoice_items WHERE invoice_id = ? ORDER BY position').all(inv.id);
    const payments = db.prepare('SELECT id, amount_cents, paid_on, method, note, created_at FROM payments WHERE invoice_id = ? ORDER BY paid_on, created_at, rowid').all(inv.id);
    const paid = payments.reduce((s, p) => s + p.amount_cents, 0);
    const t = calcTotals(items, inv.tax_bps, paid);
    return { ...inv, label: invoiceLabel(inv.number), items, payments, totals: t, status: statusOf(t, inv.due_date, today()) };
  }
  const findInvoice = (uid, iid) => {
    const inv = db.prepare('SELECT i.*, c.name AS client_name, c.email AS client_email FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.id = ? AND i.user_id = ?').get(iid, uid);
    if (!inv) throw notFound('Invoice not found');
    return hydrate(inv);
  };

  const writeItems = (iid, items) => {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(iid);
    const ins = db.prepare('INSERT INTO invoice_items (invoice_id, position, description, quantity_milli, unit_cents) VALUES (?,?,?,?,?)');
    items.forEach((it, i) => ins.run(iid, i, it.description, Math.round(it.quantity * 1000), toCents(it.unit_price)));
  };

  api.get('/invoices', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const status = String(req.query.status || '');
    const term = String(req.query.q || '').trim().toLowerCase();
    const rows = db.prepare('SELECT i.*, c.name AS client_name, c.email AS client_email FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.user_id = ? ORDER BY i.number DESC').all(req.userId).map(hydrate)
      .filter((i) => (!status || i.status === status) && (!term || i.client_name.toLowerCase().includes(term) || i.label.toLowerCase().includes(term)))
      .map(({ items, ...rest }) => rest);
    res.json({ items: rows.slice((page - 1) * size, page * size), total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / size)) });
  });

  api.get('/invoices/:id', wrap((req, res) => res.json({ invoice: findInvoice(req.userId, req.params.id) })));

  api.post('/invoices', wrap((req, res) => {
    const b = S.invoice.parse(req.body); // owner, number, totals and status in the body are never read
    if (!ownClient(req.userId, b.client_id)) throw new HttpError(400, 'Choose one of your clients');
    const iid = id();
    tx(db, () => {
      db.prepare('INSERT INTO counters (user_id, last_number) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING').run(req.userId);
      // Atomic per-user counter: numbers never repeat, even after deletes or parallel requests.
      const { last_number: n } = db.prepare('UPDATE counters SET last_number = last_number + 1 WHERE user_id = ? RETURNING last_number').get(req.userId);
      db.prepare('INSERT INTO invoices (id, user_id, client_id, number, currency, issue_date, due_date, tax_bps, notes) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(iid, req.userId, b.client_id, n, b.currency, b.issue_date, b.due_date, Math.round(b.tax_percent * 100), b.notes);
      writeItems(iid, b.items);
    });
    res.status(201).json({ invoice: findInvoice(req.userId, iid) });
  }));

  api.put('/invoices/:id', wrap((req, res) => {
    const cur = findInvoice(req.userId, req.params.id);
    const b = S.invoice.parse(req.body);
    if (!ownClient(req.userId, b.client_id)) throw new HttpError(400, 'Choose one of your clients');
    tx(db, () => {
      db.prepare('UPDATE invoices SET client_id=?, currency=?, issue_date=?, due_date=?, tax_bps=?, notes=? WHERE id=? AND user_id=?')
        .run(b.client_id, b.currency, b.issue_date, b.due_date, Math.round(b.tax_percent * 100), b.notes, cur.id, req.userId);
      writeItems(cur.id, b.items);
      const t = hydrate(db.prepare('SELECT * FROM invoices WHERE id = ?').get(cur.id)).totals;
      if (t.balance < 0) throw new HttpError(409, 'The new total is lower than the payments already recorded. Remove a payment first.');
    });
    res.json({ invoice: findInvoice(req.userId, cur.id) });
  }));

  api.delete('/invoices/:id', wrap((req, res) => {
    const cur = findInvoice(req.userId, req.params.id);
    db.prepare('DELETE FROM invoices WHERE id = ? AND user_id = ?').run(cur.id, req.userId);
    res.status(204).end();
  }));

  api.post('/invoices/:id/payments', wrap((req, res) => {
    const b = S.payment.parse(req.body);
    const cents = toCents(b.amount);
    if (cents <= 0) throw new HttpError(400, 'Amount must be above 0');
    tx(db, () => {
      const inv = findInvoice(req.userId, req.params.id); // re-read inside the transaction: no lost updates
      if (cents > inv.totals.balance) throw new HttpError(409, inv.totals.balance === 0 ? 'This invoice is already fully paid.' : 'That is more than the balance due.');
      db.prepare('INSERT INTO payments (id, invoice_id, amount_cents, paid_on, method, note) VALUES (?,?,?,?,?,?)').run(id(), inv.id, cents, b.paid_on, b.method, b.note);
    });
    res.status(201).json({ invoice: findInvoice(req.userId, req.params.id) });
  }));

  api.delete('/invoices/:id/payments/:pid', wrap((req, res) => {
    const inv = findInvoice(req.userId, req.params.id);
    const r = db.prepare('DELETE FROM payments WHERE id = ? AND invoice_id = ?').run(req.params.pid, inv.id);
    if (!r.changes) throw notFound('Payment not found');
    res.json({ invoice: findInvoice(req.userId, inv.id) });
  }));

  async function pdfFor(uid, iid) {
    const inv = findInvoice(uid, iid);
    const seller = q.userById.get(uid);
    const client = ownClient(uid, inv.client_id);
    const buf = await renderInvoicePdf({ invoice: inv, items: inv.items, totals: inv.totals, client, seller, status: inv.status });
    return { inv, seller, client, buf };
  }

  api.get('/invoices/:id/pdf', wrap(async (req, res) => {
    const { inv, buf } = await pdfFor(req.userId, req.params.id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${inv.label}.pdf"`, 'Cache-Control': 'private, no-store' }).send(buf);
  }));

  // Recipient is always the client's stored email, never an address from the request.
  api.post('/invoices/:id/send', sendLimiter, wrap(async (req, res) => {
    const { inv, seller, client, buf } = await pdfFor(req.userId, req.params.id);
    if (!client.email) throw new HttpError(400, 'Add an email address to this client first.');
    const biz = seller.business_name || seller.name;
    const r = await sendMail({
      to: client.email,
      replyTo: seller.email,
      subject: `Invoice ${inv.label} from ${biz}`,
      text: `Hi ${client.name},\n\nPlease find invoice ${inv.label} attached. The balance due is ${new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency }).format(inv.totals.balance / 100)}, due ${inv.due_date}.\n\nThank you,\n${biz}`,
      attachments: [{ filename: `${inv.label}.pdf`, content: buf, contentType: 'application/pdf' }],
    }).catch(() => { throw new HttpError(502, 'The email could not be sent. Check your mail settings and try again.'); });
    res.json({ delivered: r.delivered, to: client.email });
  }));

  // ---------- Dashboard ----------
  api.get('/stats', (req, res) => {
    const all = db.prepare('SELECT i.*, c.name AS client_name, c.email AS client_email FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.user_id = ? ORDER BY i.number DESC').all(req.userId).map(hydrate);
    const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
    const byCur = {};
    for (const i of all) {
      const c = (byCur[i.currency] ||= { received: 0, outstanding: 0, overdue: 0, overdue_count: 0 });
      c.received += i.totals.paid;
      c.outstanding += i.totals.balance;
      if (i.status === 'overdue') { c.overdue += i.totals.balance; c.overdue_count++; }
    }
    const months = [];
    const d = new Date();
    for (let k = 5; k >= 0; k--) {
      const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1));
      months.push({ key: m.toISOString().slice(0, 7), label: m.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), amount: 0 });
    }
    const pays = db.prepare('SELECT p.amount_cents a, p.paid_on d, i.currency cur FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.user_id = ?').all(req.userId);
    const primary = q.userById.get(req.userId).currency;
    for (const p of pays) if (p.cur === primary) { const m = months.find((x) => x.key === p.d.slice(0, 7)); if (m) m.amount += p.a; }
    res.json({
      currency: primary,
      totals: byCur[primary] || { received: 0, outstanding: 0, overdue: 0, overdue_count: 0 },
      other_currencies: Object.keys(byCur).filter((c) => c !== primary),
      months,
      counts: { total: all.length, paid: all.filter((i) => i.status === 'paid').length, open: sum(all, (i) => (i.status === 'paid' ? 0 : 1)) },
      recent: all.slice(0, 5).map(({ items, ...r }) => r),
    });
  });

  api.use((_req, _res, next) => next(notFound('Not found')));
  app.use('/api', api);

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const fields = {};
      for (const i of err.issues) fields[i.path.join('.') || '_'] ||= i.message;
      return res.status(400).json({ error: err.issues[0].message, fields });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large' });
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Malformed JSON' });
    if (String(err.message).includes('UNIQUE constraint failed: users.email')) return res.status(409).json({ error: 'An account with this email already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  return app;
}
