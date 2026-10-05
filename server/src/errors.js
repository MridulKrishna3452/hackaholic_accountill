export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const notFound = (what = 'Not found') => new HttpError(404, what);
// Wrap async handlers so a thrown error is always turned into a response (no hanging requests).
export const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
