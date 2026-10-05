const KEY = 'folio.token';

export const tokenStore = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(t) { try { localStorage.setItem(KEY, t); } catch { /* storage blocked: session-only */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields || {}; }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, path, body, { blob } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  if (res.ok) {
    if (blob) return res.blob();
    return res.status === 204 ? null : res.json();
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (res.status === 401 && token) onUnauthorized();
  throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status, data.fields);
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
  async download(path, filename) {
    const blob = await request('GET', path, undefined, { blob: true });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const money = (cents, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((cents || 0) / 100);
export const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
export const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
