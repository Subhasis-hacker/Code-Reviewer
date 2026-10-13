import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  const logout = useCallback(() => { localStorage.removeItem('token'); setUser(null); }, []);

  const loadUser = useCallback(async () => {
    try { const { data } = await authApi.me(); setUser(data?.user || data); }
    catch { logout(); }
    finally { setLoading(false); }
  }, [logout]);

  useEffect(() => { if (localStorage.getItem('token')) loadUser(); }, [loadUser]);
  useEffect(() => { window.addEventListener('auth:expired', logout); return () => window.removeEventListener('auth:expired', logout); }, [logout]);

  const saveToken = async (data) => {
    const token = data?.access_token || data?.token;
    if (!token) throw new Error('No token returned by server');
    localStorage.setItem('token', token);
    setLoading(true);
    await loadUser();
  };

  return <Ctx.Provider value={{ user, loading, saveToken, logout }}>{children}</Ctx.Provider>;
}
