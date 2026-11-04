import { CampaignCharacters } from './CampaignCharacters';
import { useEffect, useRef, useState } from 'react';
import { useAccount } from './AuthPanel';
import { requestJSON, RequestError } from './http';
import { Icon } from './editor-shared';
import { campaignStatusLabels, type CampaignState } from '../packages/campaign-types';
type Role = 'dm' | 'player';
type State = CampaignState;
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
async function request<T = any>(path: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  return requestJSON<T>(path, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal,
  });
}
export function CampaignView() {
  const { user } = useAccount(),
    [access, setAccess] = useState(initialAccess),
    [state, setState] = useState<State | null>(null),
    [role, setRole] = useState<Role | null>(null),
    [linked, setLinked] = useState(false),
    [participantId, setParticipantId] = useState('');
  const [campaigns, setCampaigns] = useState<State[]>([]),
    [name, setName] = useState(''),
    [campaignName, setCampaignName] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [creating, setCreating] = useState(false),
    [loadError, setLoadError] = useState('');
  const mounted = useRef(true),
    owner = useRef(user?.id),
    working = useRef(false),
    revision = useRef(0);
  owner.current = user?.id;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const api = async <T = any,>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> => {
    const who = owner.current;
    const out = await request<T>(path, data, signal);
    if (!mounted.current || who !== owner.current)
      throw new DOMException('Sessão alterada.', 'AbortError');
    return out;
  };
  const payload = () => ({
    campaignId: access.locator,
    inviteToken: access.inviteToken,
    sessionToken: access.sessionToken,
  });
  useEffect(() => {
    setState(null);
    setRole(null);
    setCampaigns([]);
    setError('');
    setLoadError('');
    setNotice('');
    const controller = new AbortController();
    if (user)
      api<State[]>('/api/campaigns', undefined, controller.signal)
        .then(setCampaigns)
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    return () => controller.abort();
  }, [user?.id]);
  useEffect(() => {
    setLoadError('');
    if (
      !access.locator ||
      (!access.sessionToken && !user) ||
      (!access.sessionToken && access.locator === access.inviteToken)
    )
      return;
    const controller = new AbortController();
    let timer: number | undefined;
    const poll = async () => {
      const before = revision.current;
      try {
        if (working.current) return;
        const out = await api('/api/campaigns/state', payload(), controller.signal);
        if (!controller.signal.aborted && before === revision.current) {
          setState(out.state);
          setRole(out.role);
          setLinked(out.accountLinked);
          setParticipantId(out.participantId);
          setLoadError('');
        }
      } catch (e) {
        if (!controller.signal.aborted && before === revision.current) {
          setLoadError((e as Error).message);
          if (e instanceof RequestError && [401, 403, 404].includes(e.status)) {
            setState(null);
            setRole(null);
          }
        }
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
    if (working.current) return;
    working.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      if (mounted.current && (e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const enter = (out: any, invite: string) => {
    remember({ locator: out.state.id, inviteToken: invite, sessionToken: out.sessionToken });
    setState(out.state);
    setCreating(false);
    setLoadError('');
    setMessage('');
    setRole(out.role || 'dm');
    setParticipantId(out.participantId || '');
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
      const sent = message;
      setState(await api('/api/campaigns/event', { ...payload(), body: sent }));
      setMessage((draft) => (draft === sent ? '' : draft));
    });
  const link = access.inviteToken
    ? `${location.origin}/campaign/${encodeURIComponent(access.inviteToken)}`
    : '';
  const options =
    state && !campaigns.some((c) => c.id === state.id) ? [state, ...campaigns] : campaigns;
  const joining = Boolean(access.inviteToken) && !creating;
  const opening =
    !creating &&
    !state &&
    !loadError &&
    Boolean(access.locator && (access.sessionToken || (user && !joining)));
  const startCreation = () => {
    setCreating(true);
    setCampaignName('');
    setError('');
    setLoadError('');
    setNotice('');
    history.replaceState({}, '', '/campanhas');
  };
  return (
    <div className="campaign-workspace">
      <section className="card campaign-toolbar" aria-label="Gerenciar campanhas">
        <div className="campaign-picker">
          {user ? (
            <label>
              Minhas campanhas
              <select
                aria-label="Abrir campanha da conta"
                disabled={busy}
                value={
                  !creating && options.some((c) => c.id === access.locator) ? access.locator : ''
                }
                onChange={(e) => {
                  if (e.target.value) {
                    setState(null);
                    setRole(null);
                    setCreating(false);
                    setMessage('');
                    setError('');
                    setNotice('');
                    setLoadError('');
                    remember({ locator: e.target.value, sessionToken: '', inviteToken: '' });
                    history.replaceState({}, '', '/campanhas');
                  }
                }}
              >
                <option value="" disabled>
                  {options.length ? 'Escolha uma campanha' : 'Suas campanhas aparecerão aqui'}
                </option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div>
              <span className="eyebrow">SUA MESA ONLINE</span>
              <p>Esta sessão fica salva neste navegador.</p>
            </div>
          )}
        </div>
        {creating && state ? (
          <button
            type="button"
            className="quiet campaign-create"
            disabled={busy}
            onClick={() => {
              setCreating(false);
              setError('');
            }}
          >
            <Icon name="arrow" size={16} />
            Voltar à campanha
          </button>
        ) : !creating && (state || access.locator || campaigns.length > 0) ? (
          <button
            type="button"
            className="quiet campaign-create"
            disabled={busy || opening}
            onClick={startCreation}
          >
            <Icon name="plus" size={16} />
            Criar outra campanha
          </button>
        ) : null}
      </section>
      {opening ? (
        <section className="card campaign-loading" role="status">
          Abrindo campanha…
        </section>
      ) : !state || creating ? (
        <div className="campaign-grid campaign-lobby">
          <section className="card campaign-hero">
            <span className="eyebrow">CAMPANHA / MESA ONLINE</span>
            <h2>{joining ? 'Entre na mesa' : 'Junte sua mesa sem complicar.'}</h2>
            <p className="muted">
              Até 10 pessoas: 1 DM e 9 jogadores.{' '}
              {user
                ? 'A participação fica vinculada à sua conta.'
                : 'Entre na sua conta para retomar em outros dispositivos. Sem conta, preserve a sessão deste navegador.'}
            </p>
            <form
              className="campaign-form"
              onSubmit={(e) => {
                e.preventDefault();
                void (joining ? join() : createWithInvite());
              }}
            >
              <label>
                Seu nome de mesa
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                  autoComplete="nickname"
                />
              </label>
              {joining ? (
                <button type="submit" disabled={busy || !name.trim()}>
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
                      required
                    />
                  </label>
                  <button type="submit" disabled={busy || !name.trim() || !campaignName.trim()}>
                    Criar como DM
                  </button>
                </>
              )}
            </form>
          </section>
          <section className="campaign-guide card">
            <span className="eyebrow">DO CONVITE À AVENTURA</span>
            <h3>
              O próximo capítulo <br />
              começa em companhia.
            </h3>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <b>Prepare a mesa</b>
                  <p>Dê um nome à campanha e assuma o papel de DM.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <b>Reúna seu grupo</b>
                  <p>Compartilhe o convite privado com até 9 jogadores.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <b>Escrevam a história</b>
                  <p>Conversem no diário e acompanhem a sessão juntos.</p>
                </div>
              </li>
            </ol>
            <span className="guide-footnote">Uma mesa, muitas histórias.</span>
          </section>
        </div>
      ) : (
        <div className="campaign-grid room">
          <section className="card campaign-room">
            <div className="campaign-room-head">
              <div>
                <span className="eyebrow">CAMPANHA / {role === 'dm' ? 'DM' : 'JOGADOR'}</span>
                <h2>{state.name}</h2>
                <p className="muted campaign-session-meta">
                  <span className={`campaign-status is-${state.status}`}>
                    {campaignStatusLabels[state.status]}
                  </span>
                  <span>{state.participants.length}/10 participantes</span>
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
                      disabled={busy}
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
            <h3 className="participants-title">
              À mesa <span>{state.participants.length} / 10</span>
            </h3>
            <CampaignCharacters
              state={state}
              participantId={participantId}
              role={role}
              access={payload()}
              busy={busy}
              onRemove={(id) =>
                void act(async () =>
                  setState(await api('/api/campaigns/remove', { ...payload(), participantId: id })),
                )
              }
              onSaved={() =>
                void api('/api/campaigns/state', payload())
                  .then((out) => {
                    setState(out.state);
                    setParticipantId(out.participantId);
                  })
                  .catch((e) => setError(e.message))
              }
            />
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
            <div className="section-title">
              <div>
                <span className="eyebrow">CAPÍTULO EM ANDAMENTO</span>
                <h3>Diário da mesa</h3>
              </div>
              <span aria-hidden="true">✧</span>
            </div>
            <div className="feed" role="log" aria-label="Mensagens da campanha" tabIndex={0}>
              {state.events.map((e) => (
                <div className={`feed-item ${e.kind}`} key={e.id}>
                  <b>{e.author}</b>
                  <span>
                    {e.kind === 'status'
                      ? e.body.replace(
                          /Sessão: (lobby|active|paused|closed)\./g,
                          (_, value: State['status']) => `Sessão: ${campaignStatusLabels[value]}.`,
                        )
                      : e.body}
                  </span>
                  <small>
                    {new Date(e.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </div>
              ))}
            </div>
            <form
              className="message-line"
              onSubmit={(e) => {
                e.preventDefault();
                void post();
              }}
            >
              <input
                aria-label="Mensagem para a mesa"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva para a mesa…"
                maxLength={500}
              />
              <button type="submit" disabled={busy || !message.trim()}>
                Enviar
              </button>
            </form>
          </section>
        </div>
      )}
      {(error || loadError) && (
        <p className="error campaign-feedback" role="alert">
          {error || loadError}
        </p>
      )}
      {notice && (
        <p className="editor-notice campaign-feedback" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
