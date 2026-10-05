# API

All routes live under `/api` and speak JSON. **23 routes**: 6 public, 17 that need `Authorization: Bearer <token>`.

**Error shape:** `{ "error": "message" }`. Validation errors add `"fields": { "<path>": "message" }` (for example `items.0.quantity`).

| Status | Meaning |
|---|---|
| 400 | Validation failed, malformed JSON, or a business rule on input (for example, a client that isn't yours) |
| 401 | Missing, invalid or expired token; wrong credentials |
| 404 | Not found, or not yours (never 403, so ids can't be probed) |
| 409 | Conflict: duplicate email, overpayment, edit below paid amount, client has invoices |
| 413 | Body too large (limit 600 KB) |
| 429 | Rate limit |
| 501 | Google sign-in not configured |
| 502 | Email could not be sent |
| 500 | Unexpected; generic message only |

Money in requests is in major units (`50.25`). Money in responses is integer cents. Dates are `YYYY-MM-DD`.

## Public

| Route | Input | Output | Errors |
|---|---|---|---|
| `GET /auth/config` | none | `{ googleClientId \| null }` | none |
| `POST /auth/signup` | `{ name, email, password (8+) }` | 201 `{ token, user }` | 400, 409 email taken, 429 |
| `POST /auth/signin` | `{ email, password }` | `{ token, user }` | 400, 401 `Invalid email or password` (same for unknown email), 429 |
| `POST /auth/google` | `{ credential }` (Google ID token) | `{ token, user }` | 401 unverifiable or unverified email, 501, 429 |
| `POST /auth/forgot` | `{ email }` | `{ message }`, the same whether or not the email has an account | 400 bad email, 429 |
| `POST /auth/reset` | `{ token, password (8+) }` | `{ message }` | 400 invalid, used or expired token; 429 |

`user` is an allow-listed object: `id, name, email, business_name, phone, address, website, payment_details, logo, currency, has_password, google_linked`. It never contains a hash.

## Authenticated (the owner is always the token's user)

| Route | Input | Output | Errors |
|---|---|---|---|
| `GET /auth/me` | none | `{ user }` | 401 |
| `GET /profile` | none | `{ user }` | 401 |
| `PUT /profile` | `{ name, business_name, phone, address, website, payment_details, currency, logo }` (logo: PNG or JPEG data URL or `""`) | `{ user }` | 400 |
| `GET /clients` | `?q &page &pageSize (max 200)` | `{ items[], total, page, pages }`, each with `invoice_count` | 401 |
| `POST /clients` | `{ name, email?, phone?, address? }` | 201 `{ client }` | 400 |
| `PUT /clients/:id` | same as above | `{ client }` | 400, 404 |
| `DELETE /clients/:id` | none | 204 | 404, 409 has invoices |
| `GET /invoices` | `?status (unpaid\|partial\|overdue\|paid) &q &page &pageSize (max 100)` | `{ items[], total, page, pages }` (no line items) | 401 |
| `POST /invoices` | `{ client_id, currency, issue_date, due_date, tax_percent, notes?, items[{description, quantity, unit_price}] }` (1–100 items). Any `number`, `total`, `status` or owner field is ignored | 201 `{ invoice }` | 400 (including a client that isn't yours) |
| `GET /invoices/:id` | none | `{ invoice }` with `label`, `items`, `payments`, `totals{subtotal,tax,total,paid,balance}`, `status` | 404 |
| `PUT /invoices/:id` | same as create | `{ invoice }` | 400, 404, 409 total would fall below payments |
| `DELETE /invoices/:id` | none | 204 | 404 |
| `POST /invoices/:id/payments` | `{ amount (>0), paid_on, method?, note? }` | 201 `{ invoice }` | 400, 404, 409 over the balance or already paid |
| `DELETE /invoices/:id/payments/:pid` | none | `{ invoice }` | 404 |
| `GET /invoices/:id/pdf` | none | `application/pdf`, attachment `INV-0001.pdf` | 404 |
| `POST /invoices/:id/send` | none (a body is ignored; the recipient is the client's stored email) | `{ delivered, to }`. `delivered:false` means SMTP isn't configured | 400 client has no email, 404, 429 (10 per hour per user), 502 |
| `GET /stats` | none | `{ currency, totals{received,outstanding,overdue,overdue_count}, other_currencies[], months[6], counts, recent[5] }` | 401 |

## Who may call what
- **Anyone:** the six public routes.
- **Signed-in users:** everything else, and only for their own data. Cross-user access returns 404.
