import jwt from 'jsonwebtoken';
import { HttpError } from './errors.js';

export const secret = () => {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET (16+ chars) is required in production');
  return 'folio-dev-secret-not-for-production';
};

export const signToken = (userId) => jwt.sign({ sub: userId }, secret(), { expiresIn: '7d', algorithm: 'HS256' });

/** Verifies the bearer token and exposes the verified user id as req.userId. Always responds 401 on failure. */
export function requireAuth(db) {
  return (req, _res, next) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) return next(new HttpError(401, 'Sign in to continue'));
    try {
      const { sub } = jwt.verify(m[1], secret(), { algorithms: ['HS256'] });
      const row = db.prepare('SELECT id FROM users WHERE id = ?').get(sub);
      if (!row) throw new Error('gone');
      req.userId = sub;
      next();
    } catch {
      next(new HttpError(401, 'Your session expired. Please sign in again'));
    }
  };
}
