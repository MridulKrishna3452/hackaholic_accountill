<!-- TEMPLATE NOT AVAILABLE TO THE AGENT: the prerequisites PDF was not provided. The facts below are accurate; move them into the official template's headings. -->

# Submission: Folio

**Project:** Folio, a clean-room rebuild of Accountill (github.com/panshak/accountill, commit `399f2a3`).

**What it does:** Freelancer invoicing. Clients, invoices with server-computed totals, PDF download and email, payment tracking, and a dashboard.

**Run it:** see [README.md](README.md). `npm install && npm run build && npm start`, then open http://localhost:4000. Tests: `npm test`.

## Our two improvements
1. Real authentication and per-user ownership on every route.
2. Server-assigned unique invoice numbers, with server-computed totals and status.

Details and acceptance criteria: [docs/GAPS.md](docs/GAPS.md). Every criterion maps to a named test in `server/test/api.test.js`.

## Documents
[PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [API](docs/API.md) · [Observations on the original](docs/OBSERVATIONS.md) · [Gaps](docs/GAPS.md) · [Agent log](docs/AGENT_LOG.md) · [Deck](deck.pdf)

## Clean-room statement
- The rebuild was written from the team's report, without opening the original source. The original was read afterwards, only to verify claims in OBSERVATIONS.md. No original code was copied.
- No original packages were used that are specific to it. General libraries (`express`, `react`, `jsonwebtoken`, `bcryptjs`, `nodemailer`) overlap with the original's dependency list; they are general-purpose libraries. The original's `mongoose`, `html-pdf`, Redux and Material UI are **not** used.
- No secrets are in the repository. `.env.example` lists names only.

## Not verified
Docker build, real SMTP delivery, Google sign-in with a live client id. See [docs/AGENT_LOG.md](docs/AGENT_LOG.md).
