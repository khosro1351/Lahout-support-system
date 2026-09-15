import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearCsrfToken, setCsrfToken } from '../api/client';

export type Role = { roleCode: string; scopeType: string; scopeId: string | null };
export type User = {
  accountId: string;
  displayName: string;
  username: string;
  roles: Role[];
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User; csrfToken: string }>('/auth/me')
      .then((data) => { setUser(data.user); setCsrfToken(data.csrfToken); })
      .catch(() => { setUser(null); clearCsrfToken(); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const expire = () => { setUser(null); clearCsrfToken(); };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (username, password) => {
      const data = await api<{ user: User; csrfToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setUser(data.user);
      setCsrfToken(data.csrfToken);
    },
    logout: async () => {
      await api('/auth/logout', { method: 'POST' });
      clearCsrfToken();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be inside AuthProvider');
  return value;
}
