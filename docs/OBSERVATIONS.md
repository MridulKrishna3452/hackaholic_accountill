# Observations on the original (Accountill)

Source: github.com/panshak/accountill at commit `399f2a3`, read from a local checkout. Nothing was run or edited. Each claim below was checked by opening the cited lines. Line numbers are approximate to the file at that commit.

Evidence tags: **[Verified]** means the cited lines were opened and prove the claim. **[Reported]** means the claim comes from the team's earlier reverse-engineering report and was not re-opened.

## What the original is
A MERN invoicing app. React client, Express + Mongoose server, MongoDB. Users sign up, add clients, create invoices, email a PDF, and record payments. [Verified: `server/index.js`, `server/models/*`, `client/src/`]

## Verified claims

| # | Claim | Evidence | Tag |
|---|---|---|---|
| 1 | No route is behind any auth check. The four route groups are mounted straight after `cors()`. | `server/index.js:30-35` | Verified |
| 2 | `middleware/auth.js` is not imported anywhere under `server/`. | grep for `middleware/auth` / `import auth` returned no hits | Verified |
| 3 | If it were used, its `catch` only logs (never responds or calls `next`), and a non-matching token is decoded with `jwt.decode` (no signature check). | `server/middleware/auth.js:20-31` | Verified |
| 4 | The owner of invoice data is a query parameter the caller supplies (`searchQuery`). | `server/controllers/invoices.js:10,13,23,27` | Verified |
| 5 | Update and delete only check the id is a valid ObjectId, with no ownership check. | `invoices.js:85,87,96,98` | Verified |
| 6 | `GET /clients` counts and returns every client in the database. | `server/controllers/clients.js:44-45` | Verified |
| 7 | Invoice number is the browser's `count + 1`, and the schema has no uniqueness rule (`invoiceNumber: String`). | `client/.../Invoice.js:93-96`, `InvoiceModel.js:13` | Verified |
| 8 | The server saves the request body as the invoice, so totals, status and payments are whatever the browser sends. | `invoices.js:53-57,87` | Verified |
| 9 | Every PDF request writes the same `invoice.pdf`, and `/fetch-pdf` serves whatever is on disk. Errors are sent as `res.send(Promise.reject())`. | `server/index.js:57,88-99` | Verified |
| 10 | `/send-pdf` takes the recipient from the request body, with no auth. | `server/index.js:54,62` | Verified |
| 11 | `createdAt` defaults to `new Date()` (evaluated once at schema load). | `InvoiceModel.js:21` | Verified |
| 12 | Sign-in returns the whole user document (including the password hash field) to the browser. | `server/controllers/user.js:37` | Verified |
| 13 | The password-reset handler's `catch` only logs, so the request never gets a response. | `user.js:153-155` | Verified |
| 14 | A failed invoice save only logs, and never stops the loading state. | `client/src/actions/invoiceActions.js:42-51` | Verified |
| 15 | Server Dockerfile runs `yarn start-prod`, but `package.json` only defines `start`. `client/yarn.lock` does not exist. Base image is `node:14-alpine`. | `server/Dockerfile:1,14`, `server/package.json:9` | Verified |
| 16 | Logo upload posts to a fixed Cloudinary account name in client code. | `client/src/components/Settings/Form/Uploader.js:33` | Verified |
| 17 | There are no server test files. | `ls server/*.test.js` found none | Verified |
| 18 | Google sign-in stores `jti` as the profile's user id. | `Login.js:56` | Reported |
| 19 | The reset token is stored unhashed. | `user.js:113` | Reported (the assignment `user.resetToken = token` was seen at `user.js:112-113`) |
| 20 | "User doesn't exist" and "User does not exist in our database" messages allow account enumeration. | `user.js:27,111` | Reported (line 111 seen) |

## What could not be confirmed
- Whether the Google-sign-in bug (claim 18) actually loses data. It needs a manual test with a real Google account.
- Whether the Docker build fails. It was not run.
