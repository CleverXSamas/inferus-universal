import { useEffect, useState } from 'react';
import { useAccount } from './AuthPanel';
type Role = 'dm' | 'player';
type State = {
  id: string;
  name: string;
  status: 'lobby' | 'active' | 'paused' | 'closed';
  participants: { id: string; name: string; role: Role; online: boolean }[];
  events: { id: string; kind: string; author: string; body: string; createdAt: string }[];
  revoked: boolean;
};
type Access = { locator: string; sessionToken: string; inviteToken: string };
const key = 'inferus-campaign-access-v2';
function initialAccess(): Access {
  let saved: Access | undefined;
  try {
    saved = JSON.parse(localStorage.getItem(key) || 'null');
  } catch {}
  let invite = '';
  try {
    invite = decodeURIComponent(location.pathname.match(/^\/campaign\/([^/]+)/)?.[1] || '');
  } catch {}
  if (
    saved &&
    typeof saved.locator === 'string' &&
    typeof saved.sessionToken === 'string' &&
    typeof saved.inviteToken === 'string' &&
    (!invite || invite === saved.inviteToken)
  )
    return saved;
  return { locator: invite, sessionToken: '', inviteToken: invite };
}
async function api(path: string, payload?: unknown, signal?: AbortSignal) {
  const r = await fetch(path, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Não foi possível concluir a ação.');
  return data;
}
export function CampaignView() {
  const { user } = useAccount(),
    [access, setAccess] = useState(initialAccess),
    [state, setState] = useState<State | null>(null),
    [role, setRole] = useState<Role | null>(null),
    [linked, setLinked] = useState(false);
  const [campaigns, setCampaigns] = useState<State[]>([]),
    [name, setName] = useState(''),
    [campaignName, setCampaignName] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const payload = () => ({
    campaignId: access.locator,
    inviteToken: access.inviteToken,
    sessionToken: access.sessionToken,
  });
  useEffect(() => {
    setState(null);
    setRole(null);
    setCampaigns([]);
    const controller = new AbortController();
    if (user)
      api('/api/campaigns', undefined, controller.signal)
        .then(setCampaigns)
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    return () => controller.abort();
  }, [user?.id]);
  useEffect(() => {
    setState(null);
    setRole(null);
    if (!access.locator || (!access.sessionToken && !user)) return;
    const controller = new AbortController();
    let timer: number | undefined;
    const poll = async () => {
      try {
        const out = await api('/api/campaigns/state', payload(), controller.signal);
        if (!controller.signal.aborted) {
          setState(out.state);
          setRole(out.role);
          setLinked(out.accountLinked);
          setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [access.locator, access.sessionToken, user?.id]);
  const remember = (next: Access) => {
    setAccess(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setNotice('O navegador não permitiu salvar a sessão. Guarde o convite.');
    }
  };
  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const enter = (out: any, invite: string) => {
    remember({ locator: out.state.id, inviteToken: invite, sessionToken: out.sessionToken });
    setState(out.state);
    setRole(out.role || 'dm');
    setLinked(Boolean(user));
    if (invite) history.replaceState({}, '', `/campaign/${encodeURIComponent(invite)}`);
    if (user)
      api('/api/campaigns')
        .then(setCampaigns)
        .catch(() => {});
  };
  // Creation returns the raw invitation once; preserve it for sharing on this device.
  const createWithInvite = () =>
    act(async () => {
      const out = await api('/api/campaigns', { name: campaignName, dmName: name });
      enter(out, out.inviteToken);
    });
  const join = () =>
    act(async () =>
      enter(
        await api('/api/campaigns/join', { inviteToken: access.inviteToken, name }),
        access.inviteToken,
      ),
    );
  const changeStatus = (status: State['status']) =>
    act(async () => setState(await api('/api/campaigns/status', { ...payload(), status })));
  const post = () =>
    act(async () => {
      if (!message.trim()) return;
      setState(await api('/api/campaigns/event', { ...payload(), body: message }));
      setMessage('');
    });
  const link = access.inviteToken
    ? `${location.origin}/campaign/${encodeURIComponent(access.inviteToken)}`
    : '';
  return (
    <>
      {user && (
        <section className="card">
          <label>
            Minhas campanhas
            <select
              aria-label="Abrir campanha da conta"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  remember({ locator: e.target.value, sessionToken: '', inviteToken: '' });
                  history.replaceState({}, '', '/');
                }
              }}
            >
              <option value="">Escolha uma campanha</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <button
        className="quiet"
        onClick={() => {
          remember({ locator: '', sessionToken: '', inviteToken: '' });
          setState(null);
          setRole(null);
          history.replaceState({}, '', '/');
        }}
      >
        Criar outra campanha
      </button>
      {!state ? (
        <div className="campaign-grid">
          <section className="card campaign-hero">
            <span className="eyebrow">CAMPANHA / MESA ONLINE</span>
            <h2>{access.inviteToken ? 'Entre na mesa' : 'Junte sua mesa sem complicar.'}</h2>
            <p className="muted">
              Até 10 pessoas: 1 DM e 9 jogadores.{' '}
              {user
                ? 'A participação fica vinculada à sua conta.'
                : 'Entre na sua conta para retomar em outros dispositivos. Sem conta, preserve a sessão deste navegador.'}
            </p>
            <div className="campaign-form">
              <label>
                Seu nome de mesa
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </label>
              {access.inviteToken ? (
                <button disabled={busy} onClick={join}>
                  Entrar na campanha
                </button>
              ) : (
                <>
                  <label>
                    Nome da campanha
                    <input
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      maxLength={100}
                    />
                  </label>
                  <button disabled={busy} onClick={createWithInvite}>
                    Criar como DM
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="campaign-grid room">
          <section className="card campaign-room">
            <div className="campaign-room-head">
              <div>
                <span className="eyebrow">CAMPANHA / {role === 'dm' ? 'DM' : 'JOGADOR'}</span>
                <h2>{state.name}</h2>
                <p className="muted">
                  {state.status} · {state.participants.length}/10 participantes
                </p>
              </div>
            </div>
            {role === 'dm' && (
              <div className="invite-box">
                {!state.revoked && link ? (
                  <>
                    <span>
                      <small>LINK PRIVADO</small>
                      {link}
                    </span>
                    <button
                      onClick={() =>
                        act(async () => {
                          await navigator.clipboard.writeText(link);
                          setNotice('Convite copiado.');
                        })
                      }
                    >
                      Copiar convite
                    </button>
                  </>
                ) : (
                  <p>
                    {state.revoked
                      ? 'Convite revogado. Os membros mantêm acesso à mesa.'
                      : 'Gere um novo convite para compartilhar neste dispositivo.'}
                  </p>
                )}
              </div>
            )}
            {user && !linked && access.sessionToken && (
              <button
                disabled={busy}
                className="quiet"
                onClick={() =>
                  act(async () => {
                    setState(await api('/api/campaigns/claim', payload()));
                    setCampaigns(await api('/api/campaigns'));
                    setLinked(true);
                    setNotice('Participação vinculada à sua conta.');
                  })
                }
              >
                Vincular participação à conta
              </button>
            )}
            <div className="participants">
              {state.participants.map((p) => (
                <div className="participant" key={p.id}>
                  <span>{p.name}</span>
                  <em>{p.role === 'dm' ? 'DM' : 'jogador'}</em>
                  {role === 'dm' && p.role !== 'dm' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(async () =>
                          setState(
                            await api('/api/campaigns/remove', {
                              ...payload(),
                              participantId: p.id,
                            }),
                          ),
                        )
                      }
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
            {role === 'dm' && (
              <div className="room-actions">
                <button
                  disabled={busy}
                  onClick={() => changeStatus(state.status === 'active' ? 'paused' : 'active')}
                >
                  {state.status === 'active' ? 'Pausar sessão' : 'Iniciar sessão'}
                </button>
                <button
                  disabled={busy || state.revoked}
                  className="quiet"
                  onClick={() =>
                    act(async () => setState(await api('/api/campaigns/revoke', payload())))
                  }
                >
                  Revogar convite
                </button>
                <button
                  disabled={busy}
                  className="quiet"
                  onClick={() =>
                    act(async () => {
                      const out = await api('/api/campaigns/rotate', payload());
                      remember({ ...access, inviteToken: out.inviteToken });
                      setState(out.state);
                      history.replaceState(
                        {},
                        '',
                        `/campaign/${encodeURIComponent(out.inviteToken)}`,
                      );
                    })
                  }
                >
                  Gerar novo convite
                </button>
              </div>
            )}
          </section>
          <section className="card campaign-feed">
            <h3>Diário da mesa</h3>
            <div className="feed">
              {state.events.map((e) => (
                <div className={`feed-item ${e.kind}`} key={e.id}>
                  <b>{e.author}</b>
                  <span>{e.body}</span>
                  <small>
                    {new Date(e.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </div>
              ))}
            </div>
            <div className="message-line">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !busy) post();
                }}
                placeholder="Escreva para a mesa…"
                maxLength={500}
              />
              <button disabled={busy} onClick={post}>
                Enviar
              </button>
            </div>
          </section>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
