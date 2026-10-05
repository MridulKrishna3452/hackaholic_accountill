import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!tokenStore.get());

  const signOut = useCallback(() => { tokenStore.clear(); setUser(null); }, []);
  const accept = useCallback(({ token, user: u }) => { tokenStore.set(token); setUser(u); }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!tokenStore.get()) return;
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => tokenStore.clear()).finally(() => setBooting(false));
  }, [signOut]);

  const value = useMemo(() => ({ user, setUser, booting, accept, signOut }), [user, booting, accept, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
