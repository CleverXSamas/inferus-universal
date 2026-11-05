import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
type User = { id: string; name: string; email: string | null };
type AuthInfo = { provider: 'manus' | 'chatgpt'; loginUrl: string; logoutUrl?: string };
const defaults: AuthInfo = { provider: 'manus', loginUrl: '/api/auth/login' };
const Account = createContext<
  AuthInfo & { user: User | null; loading: boolean; logout: () => Promise<void> }
>({ ...defaults, user: null, loading: true, logout: async () => {} });
export const useAccount = () => {
  const account = useContext(Account);
  if (account.provider !== 'chatgpt') return account;
  const login = new URL(account.loginUrl, location.origin);
  login.searchParams.set('return_to', location.pathname + location.search);
  return { ...account, loginUrl: login.pathname + login.search };
};
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [info, setInfo] = useState<AuthInfo>(defaults);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setUser(data.user);
        if (data.provider === 'chatgpt')
          setInfo({ provider: 'chatgpt', loginUrl: data.loginUrl, logoutUrl: data.logoutUrl });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  const logout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Não foi possível sair.');
    setUser(null);
  };
  return <Account.Provider value={{ ...info, user, loading, logout }}>{children}</Account.Provider>;
}
export function AuthPanel() {
  const { user, loading, logout, loginUrl, logoutUrl, provider } = useAccount(),
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
              <small>
                {user.email || (provider === 'chatgpt' ? 'conta ChatGPT' : 'conta Manus')}
              </small>
            </div>
          </div>
          {provider === 'chatgpt' ? (
            <a className="auth-button quiet" href={logoutUrl} target="_top">
              Sair
            </a>
          ) : (
            <button
              className="auth-button quiet"
              onClick={() => logout().catch((e) => setError(e.message))}
            >
              Sair
            </button>
          )}
        </>
      ) : (
        <a className="auth-link" href={loginUrl} target="_top">
          Entrar / criar conta{provider === 'chatgpt' ? ' com ChatGPT' : ''}
        </a>
      )}
      {error && <small className="auth-error">{error}</small>}
    </div>
  );
}
