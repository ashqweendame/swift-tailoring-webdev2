import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, setUnauthorizedHandler } from './api.js';

const KEY = 'swift_auth';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => ({ admin: '/admin', service: '/service', tailor: '/tailor' }[role] || '/login');

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const saved = load();
    if (saved?.token) setToken(saved.token);
    return saved;
  });

  const logout = useCallback(() => {
    setToken(null);
    setAuth(null);
    try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  const login = useCallback(async (username, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { username, password } });
    setToken(data.token);
    setAuth(data);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
    return data.user;
  }, []);

  const value = useMemo(() => ({ user: auth?.user ?? null, login, logout }), [auth, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
