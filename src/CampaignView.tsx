import { CampaignTabletop } from './CampaignTabletop';
import { CampaignJournal } from './CampaignJournal';
import { CampaignCharacters } from './CampaignCharacters';
import { useEffect, useRef, useState } from 'react';
import { useAccount } from './AuthPanel';
import { requestJSON, RequestError } from './http';
import { Icon, Modal } from './editor-shared';
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
  const requested = new URLSearchParams(location.search).get('mesa');
  if (requested && /^[a-zA-Z0-9_-]{1,80}$/.test(requested) && saved?.locator !== requested)
    return { locator: requested, sessionToken: '', inviteToken: '' };
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
  const [showTabletop, setShowTabletop] = useState(false);
  const { user, loginUrl, loading: accountLoading } = useAccount(),
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
  const [roomPanel, setRoomPanel] = useState<'party' | 'journal'>('party');
  const inviteControls = useRef<HTMLDetailsElement>(null);
  const [retry, setRetry] = useState(0),
    [entryMode, setEntryMode] = useState<'create' | 'join'>('create'),
    [inviteInput, setInviteInput] = useState('');
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const context = useRef(access.locator);
  context.current = access.locator;
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
    const who = owner.current,
      where = context.current;
    const out = await request<T>(path, data, signal);
    if (!mounted.current || who !== owner.current || where !== context.current)
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
    setConfirmation(null);
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
  }, [access.locator, access.sessionToken, user?.id, retry]);
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
    history.replaceState({}, '', `/campanhas?mesa=${encodeURIComponent(out.state.id)}`);
  };
  useEffect(() => {
    if (!user || !state?.id) return;
    const controller = new AbortController();
    void api<State[]>('/api/campaigns', undefined, controller.signal)
      .then(setCampaigns)
      .catch(() => {});
    return () => controller.abort();
  }, [user?.id, state?.id]);
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
    act(async () => {
      setState(await api('/api/campaigns/status', { ...payload(), status }));
      setNotice(`Sessão: ${campaignStatusLabels[status]}.`);
    });
  const confirm = (title: string, body: string, action: () => Promise<void>) =>
    setConfirmation({ title, body, action });
  const rotate = async () => {
    const out = await api('/api/campaigns/rotate', payload());
    remember({ ...access, inviteToken: out.inviteToken });
    setState(out.state);
    setNotice('Novo convite pronto. O link anterior deixou de funcionar.');
  };
  const useInvite = () => {
    try {
      const value = inviteInput.trim();
      const invite = /^[A-Za-z0-9_-]{32}$/.test(value)
        ? value
        : new URL(value, location.origin).pathname.match(
            /^\/campaign\/([A-Za-z0-9_-]{32})\/?$/,
          )?.[1];
      if (!invite) throw new Error('Cole o link de convite enviado pelo mestre.');
      setState(null);
      setRole(null);
      setCreating(false);
      setError('');
      setMessage('');
      remember({ locator: invite, inviteToken: invite, sessionToken: '' });
      history.replaceState({}, '', `/campaign/${invite}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
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
  const options = state ? [state, ...campaigns.filter((c) => c.id !== state.id)] : campaigns;
  const joining = Boolean(access.inviteToken) && !creating;
  const opening =
    !creating &&
    !state &&
    !loadError &&
    Boolean(access.locator && (access.sessionToken || (user && !joining)));
  const startCreation = () => {
    setCreating(true);
    setEntryMode('create');
    setConfirmation(null);
    setCampaignName('');
    setError('');
    setLoadError('');
    setNotice('');
    history.replaceState({}, '', '/campanhas');
  };
  return (
    <div className="campaign-workspace">
      {(error || loadError) && (
        <div className="error campaign-feedback" role="alert">
          <p>{error || loadError}</p>
          {loadError && (
            <button
              className="quiet"
              onClick={() => {
                setLoadError('');
                setRetry((n) => n + 1);
              }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="editor-notice campaign-feedback" role="status">
          {notice}
        </p>
      )}
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
                    setConfirmation(null);
                    history.replaceState(
                      {},
                      '',
                      `/campanhas?mesa=${encodeURIComponent(e.target.value)}`,
                    );
                  }
                }}
              >
                <option value="" disabled>
                  {options.length ? 'Escolha uma campanha' : 'Suas campanhas aparecerão aqui'}
                </option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {campaignStatusLabels[c.status]}
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
              if (state)
                history.replaceState({}, '', `/campanhas?mesa=${encodeURIComponent(state.id)}`);
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
      {accountLoading || opening ? (
        <section className="card campaign-loading" role="status">
          Abrindo campanha…
        </section>
      ) : !creating &&
        !state &&
        access.locator &&
        !access.sessionToken &&
        !access.inviteToken &&
        !user ? (
        <section className="card campaign-empty">
          <b>Entre para abrir sua campanha</b>
          <p>
            Use a conta que participa desta mesa. Para entrar como novo jogador, peça um convite ao
            mestre.
          </p>
          <a className="auth-link" href={loginUrl} target="_top">
            Entrar para abrir a campanha
          </a>
        </section>
      ) : !state || creating ? (
        <div className="campaign-grid campaign-lobby">
          <section className="card campaign-hero">
            {!joining && (
              <div
                className="campaign-segments campaign-entry-tabs"
                aria-label="Começar uma campanha"
              >
                <button
                  type="button"
                  className="quiet"
                  aria-pressed={entryMode === 'create'}
                  onClick={() => setEntryMode('create')}
                >
                  Criar mesa
                </button>
                <button
                  type="button"
                  className="quiet"
                  aria-pressed={entryMode === 'join'}
                  onClick={() => setEntryMode('join')}
                >
                  Tenho um convite
                </button>
              </div>
            )}
            <span className="eyebrow">CAMPANHA / MESA ONLINE</span>
            <h2>
              {joining || entryMode === 'join'
                ? 'Sua aventura começa aqui.'
                : 'Uma mesa. Muitas histórias.'}
            </h2>
            <p className="muted">
              Até 10 pessoas: 1 DM e 9 jogadores.{' '}
              {user
                ? 'A participação fica vinculada à sua conta.'
                : 'Entre na sua conta para retomar em outros dispositivos. Sem conta, preserve a sessão deste navegador.'}
            </p>
            {!joining && entryMode === 'join' ? (
              <form
                className="campaign-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  useInvite();
                }}
              >
                <label>
                  Convite da campanha
                  <input
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Cole o link enviado pelo mestre"
                    required
                    maxLength={600}
                  />
                </label>
                <button disabled={busy || !inviteInput.trim()}>Abrir convite</button>
              </form>
            ) : (
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
            )}
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
        <>
          <div className="campaign-scene-toggle">
            <button aria-pressed={showTabletop} onClick={() => setShowTabletop((v) => !v)}>
              {showTabletop ? 'Recolher mesa virtual' : 'Abrir mesa virtual'}
            </button>
            <span>Mapa compartilhado · tokens · fichas</span>
          </div>
          {showTabletop && (
            <CampaignTabletop
              key={state.id}
              state={state}
              participantId={participantId}
              role={role ?? 'player'}
              access={payload()}
            />
          )}
          <section className="campaign-overview card" aria-label="Resumo da campanha">
            <div>
              <span className="eyebrow">
                {role === 'dm' ? 'SUA MESA · VOCÊ É O MESTRE' : 'SUA AVENTURA · JOGADOR'}
              </span>
              <h2>{state.name}</h2>
              <span className={`campaign-status is-${state.status}`}>
                {campaignStatusLabels[state.status]}
              </span>
            </div>
            <dl className="campaign-metrics">
              <div>
                <dt>Participantes</dt>
                <dd>
                  {state.participants.length}
                  <small> / 10</small>
                </dd>
              </div>
              <div>
                <dt>Fichas vinculadas</dt>
                <dd>
                  {state.participants.filter((p) => p.character).length}
                  <small> / {state.participants.length}</small>
                </dd>
              </div>
            </dl>
            {role === 'dm' && (
              <div className="campaign-primary-actions">
                <button
                  disabled={busy}
                  onClick={() => changeStatus(state.status === 'active' ? 'paused' : 'active')}
                >
                  {state.status === 'active'
                    ? 'Pausar sessão'
                    : state.status === 'closed'
                      ? 'Reabrir sessão'
                      : state.status === 'paused'
                        ? 'Retomar sessão'
                        : 'Iniciar sessão'}
                  <Icon name="arrow" size={16} />
                </button>
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() => {
                    setRoomPanel('party');
                    requestAnimationFrame(() => {
                      if (inviteControls.current) {
                        inviteControls.current.open = true;
                        inviteControls.current.scrollIntoView({ block: 'center' });
                      }
                    });
                  }}
                >
                  Convidar jogadores
                </button>
              </div>
            )}
          </section>
          <nav className="campaign-mobile-nav campaign-segments" aria-label="Painéis da campanha">
            <button
              className="quiet"
              aria-pressed={roomPanel === 'party'}
              onClick={() => setRoomPanel('party')}
            >
              Ver personagens
            </button>
            <button
              className="quiet"
              aria-pressed={roomPanel === 'journal'}
              onClick={() => setRoomPanel('journal')}
            >
              Ver diário
            </button>
          </nav>
          <div className="campaign-grid room" data-active-panel={roomPanel}>
            <section className="card campaign-room">
              <div className="section-title">
                <div>
                  <span className="eyebrow">PERSONAGENS & HABILIDADES</span>
                  <h3>À mesa</h3>
                </div>
                <span className="campaign-count">{state.participants.length}/10</span>
              </div>
              <p className="campaign-section-hint">
                Abra sua ficha para jogar e evoluir a árvore. O mestre pode consultar os personagens
                da mesa.
              </p>
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
              <CampaignCharacters
                state={state}
                participantId={participantId}
                role={role}
                access={payload()}
                busy={busy}
                onRemove={(id) =>
                  confirm(
                    'Remover participante?',
                    `Isso remove ${state.participants.find((p) => p.id === id)?.name ?? 'o jogador'} e a cópia de seu personagem desta campanha. A ficha salva na conta permanece disponível.`,
                    async () => {
                      setState(
                        await api('/api/campaigns/remove', { ...payload(), participantId: id }),
                      );
                      setNotice('Participante removido.');
                    },
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
              <div className="campaign-discord-bridge">
                <span className="eyebrow">CONTINUE NO DISCORD</span>
                <p>Conecte sua conta e escolha esta mesa no bot:</p>
                <code>!campanha usar {state.id}</code>
                <button
                  className="quiet"
                  onClick={() =>
                    void act(async () => {
                      try {
                        await navigator.clipboard.writeText(`!campanha usar ${state.id}`);
                        setNotice(
                          'Comando copiado. Envie ao Inferus no Discord para selecionar esta mesa.',
                        );
                      } catch {
                        throw new Error('Selecione o comando acima e copie manualmente.');
                      }
                    })
                  }
                  disabled={busy}
                >
                  Copiar comando desta campanha
                </button>
                <a href="/discord">
                  Conectar conta e consultar comandos <Icon name="arrow" size={12} />
                </a>
                <small>O bot usa o personagem salvo nesta campanha.</small>
              </div>
              {role === 'dm' && (
                <details className="campaign-management" ref={inviteControls}>
                  <summary>Convites e controles do mestre</summary>
                  <p className="campaign-section-hint">
                    Compartilhe o convite apenas com quem vai jogar. A mesa comporta até 9 jogadores
                    e o mestre.
                  </p>
                  {!state.revoked && link ? (
                    <div className="invite-box">
                      <label>
                        Convite da mesa
                        <input
                          readOnly
                          value={link}
                          onFocus={(e) => e.currentTarget.select()}
                          aria-label="Link de convite"
                        />
                      </label>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            try {
                              await navigator.clipboard.writeText(link);
                              setNotice('Convite copiado.');
                            } catch {
                              throw new Error(
                                'Selecione o campo de convite e copie o link manualmente.',
                              );
                            }
                          })
                        }
                      >
                        Copiar convite
                      </button>
                    </div>
                  ) : (
                    <p className="help-text">
                      {state.revoked
                        ? 'Convite revogado. Quem já participa mantém o acesso.'
                        : 'Gere um convite para compartilhar neste dispositivo.'}
                    </p>
                  )}
                  <div className="room-actions">
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() =>
                        state.revoked || !link
                          ? void act(rotate)
                          : confirm(
                              'Substituir convite?',
                              'O convite anterior deixará de funcionar. Quem já está na mesa mantém o acesso.',
                              rotate,
                            )
                      }
                    >
                      Gerar novo convite
                    </button>
                    <button
                      className="quiet"
                      disabled={busy || state.revoked}
                      onClick={() =>
                        confirm(
                          'Revogar convite?',
                          'Novas entradas por este link serão bloqueadas. Os participantes atuais continuam com acesso.',
                          async () => {
                            setState(await api('/api/campaigns/revoke', payload()));
                            setNotice('Convite revogado.');
                          },
                        )
                      }
                    >
                      Revogar convite
                    </button>
                    <button
                      className="quiet danger"
                      disabled={busy || state.status === 'closed'}
                      onClick={() =>
                        confirm(
                          'Encerrar sessão?',
                          'O diário ficará em modo de consulta e novas entradas serão bloqueadas. Você poderá reabrir a sessão depois.',
                          async () => {
                            setState(
                              await api('/api/campaigns/status', {
                                ...payload(),
                                status: 'closed',
                              }),
                            );
                            setNotice('Sessão encerrada. Os dados da campanha foram preservados.');
                          },
                        )
                      }
                    >
                      Encerrar sessão
                    </button>
                  </div>
                </details>
              )}
            </section>
            <CampaignJournal
              key={state.id}
              state={state}
              message={message}
              setMessage={setMessage}
              busy={busy}
              post={() => void post()}
            />
          </div>
        </>
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          onClose={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <p className="campaign-confirm-copy">{confirmation.body}</p>
          <div className="campaign-confirm-actions">
            <button className="quiet" disabled={busy} onClick={() => setConfirmation(null)}>
              Cancelar
            </button>
            <button
              disabled={busy}
              onClick={() => {
                const action = confirmation.action;
                setConfirmation(null);
                void act(action);
              }}
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
