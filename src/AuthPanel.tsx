import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
type User = { id: string; name: string; email: string | null };
const Account = createContext<{ user: User | null; loading: boolean; logout: () => Promise<void> }>(
  { user: null, loading: true, logout: async () => {} },
);
export const useAccount = () => useContext(Account);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  const logout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Não foi possível sair.');
    setUser(null);
  };
  return <Account.Provider value={{ user, loading, logout }}>{children}</Account.Provider>;
}
export function AuthPanel() {
  const { user, loading, logout } = useAccount(),
    [error, setError] = useState('');
  if (loading) return <div className="auth-panel muted">verificando sessão…</div>;
  return (
    <div className="auth-panel">
      {user ? (
        <>
          <div className="user-chip">
            <span>{user.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email || 'conta Manus'}</small>
            </div>
          </div>
          <button
            className="auth-button quiet"
            onClick={() => logout().catch((e) => setError(e.message))}
          >
            Sair
          </button>
        </>
      ) : (
        <a className="auth-link" href="/api/auth/login">
          Entrar / criar conta
        </a>
      )}
      {error && <small className="auth-error">{error}</small>}
    </div>
  );
}
