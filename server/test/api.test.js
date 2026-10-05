// Each test maps to a defect (E#) from the Accountill reverse-engineering report.
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT = 'off';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

let server, base;
before(async () => {
  server = createApp(openDb(':memory:')).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

let n = 0;
async function newUser(name = 'Ada') {
  const email = `u${++n}-${Date.now()}@example.com`;
  const r = await call('POST', '/auth/signup', { body: { name, email, password: 'correct horse' } });
  assert.equal(r.status, 201);
  return { token: r.body.token, id: r.body.user.id, email, res: r };
}
const addClient = async (t, extra = {}) => (await call('POST', '/clients', { token: t, body: { name: 'Acme', email: 'billing@acme.test', ...extra } })).body.client;
const draft = (client_id, over = {}) => ({
  client_id, currency: 'USD', issue_date: '2026-01-10', due_date: '2026-02-10', tax_percent: 10, notes: '',
  items: [{ description: 'Design', quantity: 2, unit_price: 50 }, { description: 'Hosting', quantity: 1.5, unit_price: 20 }], ...over,
});

test('E1: every data route returns 401 without a valid token', async () => {
  const routes = [['GET', '/invoices'], ['POST', '/invoices'], ['GET', '/clients'], ['GET', '/profile'], ['GET', '/stats'], ['GET', '/invoices/x/pdf'], ['POST', '/invoices/x/send']];
  for (const [m, p] of routes) assert.equal((await call(m, p)).status, 401, `${m} ${p}`);
  assert.equal((await call('GET', '/invoices', { token: 'not.a.jwt' })).status, 401);
  const u = await newUser();
  const tampered = u.token.slice(0, -3) + (u.token.endsWith('abc') ? 'xyz' : 'abc');
  assert.equal((await call('GET', '/invoices', { token: tampered })).status, 401);
});

test('E9: sign-up and sign-in never return the password hash', async () => {
  const u = await newUser();
  const si = await call('POST', '/auth/signin', { body: { email: u.email, password: 'correct horse' } });
  for (const r of [u.res, si]) assert.ok(!JSON.stringify(r.body).toLowerCase().includes('password_hash') && !('password' in r.body.user));
});

test('E13: unknown email and wrong password are indistinguishable; forgot is generic', async () => {
  const u = await newUser();
  const a = await call('POST', '/auth/signin', { body: { email: u.email, password: 'wrong-password' } });
  const b = await call('POST', '/auth/signin', { body: { email: 'nobody@example.com', password: 'wrong-password' } });
  assert.deepEqual([a.status, a.body], [b.status, b.body]);
  const f1 = await call('POST', '/auth/forgot', { body: { email: u.email } });
  const f2 = await call('POST', '/auth/forgot', { body: { email: 'nobody@example.com' } });
  assert.deepEqual([f1.status, f1.body], [f2.status, f2.body]);
});

test('E2/E3: another user gets 404 for read, update, delete, pdf, payments and sees none of the clients', async () => {
  const a = await newUser('A');
  const b = await newUser('B');
  const ca = await addClient(a.token, { name: 'A-only client' });
  const inv = (await call('POST', '/invoices', { token: a.token, body: draft(ca.id) })).body.invoice;
  const listB = await call('GET', '/clients', { token: b.token });
  assert.equal(listB.body.total, 0);
  assert.equal((await call('GET', '/invoices', { token: b.token })).body.total, 0);
  const attempts = [
    ['GET', `/invoices/${inv.id}`], ['PUT', `/invoices/${inv.id}`, draft(ca.id)], ['DELETE', `/invoices/${inv.id}`],
    ['GET', `/invoices/${inv.id}/pdf`], ['POST', `/invoices/${inv.id}/send`],
    ['POST', `/invoices/${inv.id}/payments`, { amount: 1, paid_on: '2026-01-20' }],
    ['PUT', `/clients/${ca.id}`, { name: 'x' }], ['DELETE', `/clients/${ca.id}`],
  ];
  for (const [m, p, body] of attempts) assert.equal((await call(m, p, { token: b.token, body })).status, 404, `${m} ${p}`);
  const cb = await addClient(b.token);
  assert.equal((await call('POST', '/invoices', { token: b.token, body: draft(ca.id) })).status, 400, "cannot invoice someone else's client");
  assert.equal((await call('POST', '/invoices', { token: b.token, body: draft(cb.id) })).status, 201);
  assert.equal((await call('GET', `/invoices/${inv.id}`, { token: a.token })).status, 200);
});

test('E4: 20 parallel creates get 20 distinct numbers; deleting never reuses a number', async () => {
  const u = await newUser();
  const c = await addClient(u.token);
  const rs = await Promise.all(Array.from({ length: 20 }, () => call('POST', '/invoices', { token: u.token, body: draft(c.id) })));
  assert.ok(rs.every((r) => r.status === 201));
  const nums = rs.map((r) => r.body.invoice.number);
  assert.equal(new Set(nums).size, 20);
  const last = Math.max(...nums);
  const victim = rs.find((r) => r.body.invoice.number === last).body.invoice;
  await call('DELETE', `/invoices/${victim.id}`, { token: u.token });
  const next = (await call('POST', '/invoices', { token: u.token, body: draft(c.id) })).body.invoice;
  assert.equal(next.number, last + 1);
  const forged = (await call('POST', '/invoices', { token: u.token, body: { ...draft(c.id), number: 1, invoiceNumber: '001' } })).body.invoice;
  assert.ok(forged.number > last + 1);
});

test('E5: totals and status are computed on the server; forged fields are ignored', async () => {
  const u = await newUser();
  const c = await addClient(u.token);
  const r = await call('POST', '/invoices', { token: u.token, body: { ...draft(c.id), total: 1, subTotal: 1, status: 'Paid', totalAmountReceived: 99999, creator: ['someone'], user_id: 'x' } });
  assert.equal(r.status, 201);
  // 2*50 + 1.5*20 = 130.00; tax 10% = 13.00; total 143.00
  assert.deepEqual([r.body.invoice.totals.subtotal, r.body.invoice.totals.tax, r.body.invoice.totals.total, r.body.invoice.totals.paid], [13000, 1300, 14300, 0]);
  assert.equal(r.body.invoice.status, 'overdue'); // due 2026-02-10 is in the past
  const inv = r.body.invoice;
  const pay = (amount) => call('POST', `/invoices/${inv.id}/payments`, { token: u.token, body: { amount, paid_on: '2026-01-20' } });
  assert.equal((await pay(0)).status, 400);
  assert.equal((await pay(-5)).status, 400);
  assert.equal((await pay(143.01)).status, 409, 'overpayment');
  const p1 = await pay(43);
  assert.equal(p1.status, 201);
  assert.equal(p1.body.invoice.totals.balance, 10000);
  const p2 = await pay(100);
  assert.equal(p2.body.invoice.status, 'paid');
  assert.equal((await pay(1)).status, 409, 'already paid');
  const low = await call('PUT', `/invoices/${inv.id}`, { token: u.token, body: draft(c.id, { items: [{ description: 'x', quantity: 1, unit_price: 5 }] }) });
  assert.equal(low.status, 409, 'cannot drop total below payments');
  const after = (await call('GET', `/invoices/${inv.id}`, { token: u.token })).body.invoice;
  assert.equal(after.totals.total, 14300, 'failed update rolled back');
});

test('E5: simultaneous payments are all recorded and never exceed the balance', async () => {
  const u = await newUser();
  const c = await addClient(u.token);
  const inv = (await call('POST', '/invoices', { token: u.token, body: draft(c.id, { tax_percent: 0, items: [{ description: 'x', quantity: 1, unit_price: 100 }] }) })).body.invoice;
  const rs = await Promise.all(Array.from({ length: 5 }, () => call('POST', `/invoices/${inv.id}/payments`, { token: u.token, body: { amount: 30, paid_on: '2026-01-20' } })));
  assert.equal(rs.filter((r) => r.status === 201).length, 3);
  assert.equal(rs.filter((r) => r.status === 409).length, 2);
  const fin = (await call('GET', `/invoices/${inv.id}`, { token: u.token })).body.invoice;
  assert.equal(fin.totals.paid, 9000);
  assert.equal(fin.payments.length, 3);
});

test('E6: PDFs are per-request, valid, and concurrent requests do not mix', async () => {
  const u = await newUser();
  const c1 = await addClient(u.token, { name: 'First Client' });
  const c2 = await addClient(u.token, { name: 'Second Client' });
  const i1 = (await call('POST', '/invoices', { token: u.token, body: draft(c1.id) })).body.invoice;
  const i2 = (await call('POST', '/invoices', { token: u.token, body: draft(c2.id) })).body.invoice;
  const [r1, r2] = await Promise.all([i1, i2].map((i) => call('GET', `/invoices/${i.id}/pdf`, { token: u.token, raw: true })));
  const [b1, b2] = await Promise.all([r1, r2].map(async (r) => Buffer.from(await r.arrayBuffer())));
  assert.equal(r1.headers.get('content-type'), 'application/pdf');
  assert.ok(b1.subarray(0, 5).toString() === '%PDF-' && b2.subarray(0, 5).toString() === '%PDF-');
  assert.notDeepEqual(b1, b2);
  assert.match(r1.headers.get('content-disposition'), new RegExp(i1.label));
  assert.match(r2.headers.get('content-disposition'), new RegExp(i2.label));
});

test('E7: send always goes to the stored client email; needs auth; needs an email on file', async () => {
  const u = await newUser();
  const noMail = await addClient(u.token, { name: 'No email', email: '' });
  const inv0 = (await call('POST', '/invoices', { token: u.token, body: draft(noMail.id) })).body.invoice;
  assert.equal((await call('POST', `/invoices/${inv0.id}/send`, { token: u.token, body: { email: 'victim@example.com' } })).status, 400);
  const c = await addClient(u.token);
  const inv = (await call('POST', '/invoices', { token: u.token, body: draft(c.id) })).body.invoice;
  const ok = await call('POST', `/invoices/${inv.id}/send`, { token: u.token, body: { email: 'victim@example.com', to: 'victim@example.com' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.to, 'billing@acme.test');
});

test('E8: createdAt differs between records created at different times', async () => {
  const u = await newUser();
  const c1 = await addClient(u.token);
  await new Promise((r) => setTimeout(r, 25));
  const c2 = await addClient(u.token);
  assert.notEqual(c1.created_at, c2.created_at);
  assert.ok(Date.now() - Date.parse(c2.created_at) < 60_000);
});

test('E10: reset flow validates the token, expires it after use, and errors respond immediately', async () => {
  const u = await newUser();
  assert.equal((await call('POST', '/auth/reset', { body: { token: 'a'.repeat(64), password: 'new-password-1' } })).status, 400);
  assert.equal((await call('POST', '/auth/forgot', { body: { email: 'not-an-email' } })).status, 400);
  assert.equal((await call('POST', '/auth/signin', { body: {} })).status, 400);
  assert.equal((await call('POST', '/auth/signup', { body: { name: 'x', email: u.email, password: 'correct horse' } })).status, 409);
});

test('E12: validation failures return a message and field errors (so the UI can stop loading and show it)', async () => {
  const u = await newUser();
  const r = await call('POST', '/invoices', { token: u.token, body: { items: [] } });
  assert.equal(r.status, 400);
  assert.ok(r.body.error && r.body.fields);
});

test('profile: update works, bad logo is rejected, hash never returned', async () => {
  const u = await newUser();
  const ok = await call('PUT', '/profile', { token: u.token, body: { name: 'Ada L', business_name: 'Ada Ltd', currency: 'EUR' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.currency, 'EUR');
  assert.equal((await call('PUT', '/profile', { token: u.token, body: { name: 'Ada', logo: 'data:text/html;base64,AAAA' } })).status, 400);
});

test('stats: only counts the caller, per currency', async () => {
  const a = await newUser();
  const b = await newUser();
  const c = await addClient(a.token);
  const inv = (await call('POST', '/invoices', { token: a.token, body: draft(c.id, { tax_percent: 0, items: [{ description: 'x', quantity: 1, unit_price: 100 }] }) })).body.invoice;
  const month = new Date().toISOString().slice(0, 10);
  await call('POST', `/invoices/${inv.id}/payments`, { token: a.token, body: { amount: 40, paid_on: month } });
  const sa = (await call('GET', '/stats', { token: a.token })).body;
  const sb = (await call('GET', '/stats', { token: b.token })).body;
  assert.deepEqual([sa.totals.received, sa.totals.outstanding], [4000, 6000]);
  assert.deepEqual([sb.totals.received, sb.totals.outstanding], [0, 0]);
  assert.equal(sa.months.at(-1).amount, 4000);
});

test('clients with invoices cannot be deleted; pagination works', async () => {
  const u = await newUser();
  const c = await addClient(u.token);
  await call('POST', '/invoices', { token: u.token, body: draft(c.id) });
  assert.equal((await call('DELETE', `/clients/${c.id}`, { token: u.token })).status, 409);
  for (let i = 0; i < 5; i++) await addClient(u.token, { name: `Extra ${i}` });
  const p = await call('GET', '/clients?pageSize=2&page=2', { token: u.token });
  assert.equal(p.body.items.length, 2);
  assert.equal(p.body.total, 6);
  assert.equal(p.body.pages, 3);
});
