# Gaps in the original, and our two improvements

Evidence is in [OBSERVATIONS.md](OBSERVATIONS.md). Each gap below is fixed in Folio and covered by a test.

| ID | Gap | Type | Severity | Evidence | Fix in Folio |
|---|---|---|---|---|---|
| G1 | No route checks who is calling | Security | Critical | `server/index.js:30-35`; `middleware/auth.js` never imported | One middleware, 401 otherwise |
| G2 | Owner id comes from the caller; update/delete check no owner | Security | Critical | `invoices.js:10,13,85-98` | Owner = token user. `id AND user_id` on every query, 404 otherwise |
| G3 | `GET /clients` returns every user's clients | Privacy | High | `clients.js:44-45` | Filtered by user |
| G4 | Invoice number is `count + 1` in the browser, with no unique rule | Data integrity | High | `Invoice.js:93-96`; `InvoiceModel.js:13` | Atomic server counter and `UNIQUE(user_id, number)` |
| G5 | Server stores totals, status and payments as sent | Correctness | High | `invoices.js:53-57,87` | Derived on the server; payments endpoint with checks |
| G6 | One shared `invoice.pdf`; errors sent as `Promise.reject()` | Reliability | High | `index.js:57,88-99` | In-memory PDF per request |
| G7 | `/send-pdf` mails any address for any caller | Abuse | High | `index.js:54,62` | Auth, stored client email, rate limit |
| G8 | `createdAt` default evaluated once | Correctness | Medium | `InvoiceModel.js:21` | Per-row database default |
| G9 | Password hash returned to the browser | Security | Medium | `user.js:37` | Allow-listed user shape |
| G10 | Reset/sign-in errors never respond; token stored raw | Reliability / security | Medium | `user.js:113,153-155` | Async wrapper; hashed, single-use token |
| G11 | Failed save leaves spinner on | UX | Medium | `invoiceActions.js:42-51` | `finally` plus error message |
| G12 | Docker files refer to a missing script and file | Maintainability | Low | `server/Dockerfile:14` | Matching Dockerfile and compose |
| G13 | Logo upload hard-wired to one Cloudinary account | Maintainability | Low | `Uploader.js:33` | Resized in the browser, stored with the profile |
| G14 | No server tests | Quality | Medium | no `*.test.js` | 15 API tests |

Not re-verified in the original (see OBSERVATIONS): Google sign-in user id (reported), account enumeration messages (reported).

## Our two improvements

### 1. Real authentication and per-user ownership on every route
**Fixes:** G1, G2, G3, G7, G9 (and the enumeration issue).

Acceptance:
- Every non-public route returns 401 with no token, a malformed token, or a tampered token.
- User B gets 404 on user A's invoices, clients, PDFs and payments for read, update and delete, and sees none of A's clients in lists.
- Sign-in and sign-up responses contain no password hash. Unknown email and wrong password are indistinguishable.

Tests: `E1`, `E2/E3`, `E7`, `E9`, `E13`.

### 2. Server-assigned unique invoice numbers, with server-computed totals and status
**Fixes:** G4, G5 (and G8).

Acceptance:
- 20 parallel creates give 20 distinct numbers, and a number is never reused after a delete.
- `UNIQUE(user_id, number)` exists in the schema.
- A client-sent number, total or status is ignored. Overpayment and non-positive payments are rejected. Simultaneous payments never exceed the balance.

Tests: `E4`, `E5` (two tests).
