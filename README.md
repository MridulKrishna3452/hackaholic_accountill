# Folio

Invoicing for freelancers: add clients, write invoices, email them as PDFs, and record payments.

Folio is a ground-up rebuild of [panshak/accountill](https://github.com/panshak/accountill). It fixes all 15 defects found in the reverse-engineering report. See the table below.

**Stack:** Node 22+, Express, SQLite (built-in `node:sqlite`, no native build), React 18 + Vite. No database server to install.

## Run it

```bash
npm install
npm run build
npm start          # http://localhost:4000
```

Development with hot reload (API on :4000, app on :5173):

```bash
npm run dev
```

Tests (API, in-memory database):

```bash
npm test
```

Docker: copy `.env.example` to `.env`, set `JWT_SECRET`, then `docker compose up --build`.

## Configuration

See [.env.example](.env.example). Everything is optional in development. Email falls back to the server console, and Google sign-in only appears when `GOOGLE_CLIENT_ID` is set.

## What was wrong, and how Folio fixes it

| # | Accountill defect | Folio |
|---|---|---|
| E1 | No route checked the caller | One middleware verifies the JWT (HS256, signature and expiry) on every route except sign-in, sign-up, forgot and reset; failures return 401 |
| E2 | Owner id supplied by the caller | The owner is only ever the verified token's user id. Reads, updates and deletes query by `id AND user_id`, and another user's record returns 404 |
| E3 | `GET /clients` returned everyone's clients | Always filtered by the verified user, with the same filter on the page count |
| E4 | Invoice numbers were `count + 1` in the browser | Atomic per-user counter inside a transaction, plus `UNIQUE(user_id, number)`. Numbers never repeat, even after deletes or 20 parallel requests |
| E5 | Server trusted browser totals, status and payments | Totals and status are derived on the server from line items and payments, and are never stored. Money is integer cents. A payment endpoint rejects amounts of 0 or less and amounts above the balance, and runs atomically |
| E6 | Shared `invoice.pdf` file, broken error handling | PDFs render in memory per request and nothing touches disk. Errors return real HTTP statuses |
| E7 | `/send-pdf` was an open mail relay | Needs login and ownership. The recipient is the client's stored email, and sending is rate-limited to 10 per hour per user |
| E8 | `createdAt` frozen at server start | Database-side `strftime('now')` default, evaluated per row |
| E9 | Password hash returned to the browser | A `publicUser()` allow-list is the only user shape ever sent |
| E10 | Reset and sign-in could hang. Reset token stored in plain text | All handlers go through one async wrapper, so every path responds. Only the SHA-256 of the reset token is stored, it is single-use, and it expires after one hour |
| E11 | Google sign-in keyed users by the wrong id | The server verifies the Google ID token and links on the stable `sub` claim to one Folio user id |
| E12 | A failed save left the spinner stuck | Every submit resets loading in `finally` and shows the server's message |
| E13 | Account enumeration | Identical "Invalid email or password" for unknown email and wrong password (with a dummy hash compare to equalise timing). Forgot-password always gives the same reply |
| E14 | Docker files referred to missing scripts and files | Dockerfile and compose match the real scripts, on `node:22-alpine` |
| E15 | No tests, and the logo upload was tied to the original author's Cloudinary account | 15 API tests, each named for the defect it proves. The logo is resized in the browser and stored with your profile, so there's no third-party account |

Each row has a matching test in [server/test/api.test.js](server/test/api.test.js).

## Layout

```
server/src   app.js (routes) · db.js (schema) · money.js · pdf.js · auth.js · mail.js · schemas.js
server/test  api.test.js
client/src   pages/ · ui.jsx · api.js · styles.css · tokens.css
```
