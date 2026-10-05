# Product requirements: Folio

## Problem
Freelancers need to bill clients and know who has paid. The original app (Accountill) does this but lets anyone read or change anyone's invoices, can issue duplicate invoice numbers, and trusts totals sent by the browser. See [GAPS.md](GAPS.md). For an accounting tool, those are disqualifying.

## User
A freelancer or one-person studio who invoices a handful to a few dozen clients, wants a PDF to send, and needs an honest answer to "what am I owed?".

## Core flow
1. Sign up (email and password, or Google if configured).
2. Add business details and a logo in Settings.
3. Add a client with an email address.
4. Create an invoice: line items, tax, due date. The server assigns the number.
5. Email the PDF to the client's saved address, or download it.
6. Record payments as they arrive. Status and balance follow.
7. Watch received, outstanding and overdue totals on the dashboard.

## MoSCoW

| | Requirement |
|---|---|
| **Must** | Sign-up, sign-in, sign-out; every data route requires a verified token; per-user ownership on all reads and writes |
| **Must** | Clients: create, list (paged, searchable), edit, delete (blocked if invoices exist) |
| **Must** | Invoices: create, edit, delete, list with filter and search; server-assigned unique number; server-computed totals |
| **Must** | Payments: record and remove; reject amounts of 0 or less or above the balance; derived status |
| **Must** | PDF download and email to the client's stored address |
| **Must** | Dashboard: received, outstanding, overdue, six-month chart, recent invoices |
| **Must** | Mobile-friendly layout; every failed request shows a message and ends loading |
| **Should** | Password reset by email (single-use, expiring token) |
| **Should** | Business profile with logo printed on the PDF |
| **Should** | Rate limits on auth and send |
| **Could** | Google sign-in (needs `GOOGLE_CLIENT_ID`) |
| **Could** | Multi-currency invoices (totals are shown per default currency) |
| **Won't (now)** | Recurring invoices, quotes and receipts, multiple users per business, online card payments, tax reports |

## Acceptance criteria
Each is covered by a named test in `server/test/api.test.js` unless marked UI.

1. A request without a valid token gets 401 on every route except sign-in, sign-up, forgot, reset and `auth/config`.
2. User B gets 404 for user A's invoice, client, PDF and payments, for read, update and delete, and sees none of A's clients in lists.
3. 20 parallel invoice creates for one user produce 20 distinct numbers. Deleting an invoice never causes its number to be reused. A number sent by the client is ignored.
4. A `total`, `status` or `totalAmountReceived` sent by the client is ignored. A payment of 0, a negative payment, or more than the balance is rejected. Five simultaneous payments of 30 on a balance of 100 record exactly three.
5. Editing an invoice so its total falls below the payments already recorded is rejected, and nothing changes.
6. Two concurrent PDF requests for different invoices each return a valid PDF for their own invoice.
7. Sending an invoice emails only the client's stored address. A recipient in the request body is ignored. A client with no email gets a 400.
8. Sign-up and sign-in responses never contain a password hash. Unknown email and wrong password give identical responses. Forgot-password gives an identical response either way.
9. A reset token works once, expires after one hour, and is stored only as a SHA-256 hash.
10. (UI) No page scrolls horizontally at 320, 375, 768 and 1280 px. A failed save shows the server's message and stops the spinner.
