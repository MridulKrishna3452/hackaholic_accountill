# Agent log

Tool: Claude Code (Sonnet 5.5). This log covers the key prompts and what had to be corrected.

## Order of work (as it happened)
1. The team supplied a reverse-engineering report of the original (`ACCOUNTILL_REPORT.docx`). **The rebuild was written from that report's descriptions, without opening the original source.**
2. The code was written before these docs.
3. After the rebuild, the original at commit `399f2a3` was opened read-only in a local checkout, solely to check the report's claims for [OBSERVATIONS.md](OBSERVATIONS.md). No code was copied from it.
4. Docs and deck were written last.

## Key prompts

| # | Prompt (summarised) | Result |
|---|---|---|
| 1 | "Go through the errors in the report and fix them. Build a new project that looks completely new, beautiful, with no errors or bugs." (report attached, original repo linked) | New app in `folio/`: Express + SQLite API, React client, 15 API tests |
| 2 | Submission checklist pasted (README, SUBMISSION, deck, docs/*, `.env.example`) | `docs/*`, `deck.pdf`, `SUBMISSION.md` |

## Corrections made along the way

| What went wrong | How it was caught | Fix |
|---|---|---|
| A multi-line shell heredoc failed partway and left some server files unwritten | The script errored. A directory listing showed three files missing | Wrote those files with the file-writing tool |
| `node --test test/` tried to load the directory as a module | The test run failed with `MODULE_NOT_FOUND` | Pointed the script at `test/api.test.js` |
| The "new client" dialog was rendered inside the invoice `<form>`. Submit events bubble through React's tree, so saving a client would have submitted the invoice | Noticed on review before running | Rendered the dialog outside the form |
| The dialog re-ran its focus logic on every keystroke (its `onClose` prop changed each render) | Noticed on review | Stored the callback in a ref |
| Google button re-initialised on every keystroke in the sign-in form | Noticed on review | Callbacks held in a ref, so the effect runs once |
| Logo upload failed in the running app. The strict Content-Security-Policy blocks `blob:` images | Found by testing the upload in the browser (toast: "That image could not be read") | Read the file as a data URL instead of loosening the policy |
| PDF amount columns were narrow enough that a six-figure total could wrap | Reviewed the layout arithmetic. The PDF viewer could not be screenshotted | Widened the columns |
| Several inline text links were under 44 px tall on mobile | Measured in the browser at 320 px | Added a minimum height |

## Not verified
- The Docker image was not built (Docker Desktop's engine was not running).
- Email sending was verified only up to the point of "SMTP not configured" (the message is logged and the UI says nothing was sent). A real SMTP server was not tried.
- Google sign-in was not run (needs a client id).
- The generated PDF was checked for validity and size, not by eye.
