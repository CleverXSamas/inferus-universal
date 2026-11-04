import { useEffect, useRef, useState } from 'react';
import { useAccount } from './AuthPanel';
import { requestJSON } from './http';
type Status = {
  link: { discordId: string; displayName: string; active: string } | null;
  pending: {
    id: string;
    discordId: string | null;
    displayName: string | null;
    expiresAt: number;
  } | null;
  choices: { key: string; label: string }[];
};
export function DiscordAccountLink() {
  const { user, loginUrl } = useAccount();
  const [status, setStatus] = useState<Status | null>(null),
    [code, setCode] = useState(''),
    [choice, setChoice] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const live = useRef(true),
    owner = useRef(user?.id);
  owner.current = user?.id;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const refresh = async (signal?: AbortSignal) => {
    const identity = owner.current;
    const next = await requestJSON<Status>('/api/discord/account', { signal });
    if (!live.current || identity !== owner.current)
      throw new DOMException('Sessão alterada.', 'AbortError');
    setStatus(next);
    setChoice(next.link?.active ?? '');
  };
  useEffect(() => {
    setStatus(null);
    setCode('');
    setError('');
    setNotice('');
    if (!user) return;
    const controller = new AbortController();
    void refresh(controller.signal).catch((e) => {
      if (e.name !== 'AbortError') setError(e.message);
    });
    return () => controller.abort();
  }, [user?.id]);
  useEffect(() => {
    if (!user || !status?.pending) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await refresh(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
      }
    };
    timer = setTimeout(poll, 2000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [status?.pending?.id, user?.id]);
  const act = async (body: Record<string, unknown>) => {
    if (busy) return;
    const identity = owner.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const out = await requestJSON<{ code?: string }>('/api/discord/account', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!live.current || identity !== owner.current) return;
      if (out.code) setCode(out.code);
      else setCode('');
      await refresh();
      setNotice(
        body.action === 'select'
          ? 'Personagem ativo atualizado. Use !ficha, !skills ou !acao no Discord.'
          : body.action === 'confirm'
            ? 'Discord confirmado. Escolha abaixo o personagem que o bot poderá consultar.'
            : body.action === 'disconnect'
              ? 'Discord desconectado. Novas consultas foram bloqueadas.'
              : 'Código criado. Envie o comando ao Inferus e confirme a identidade aqui.',
      );
    } catch (e) {
      if (live.current && identity === owner.current && (e as Error).name !== 'AbortError')
        setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card discord-account-link" aria-label="Vincular conta ao bot">
      <div>
        <span className="eyebrow">SEU PERSONAGEM TAMBÉM NO DISCORD</span>
        <h3>Conecte sua conta ao Inferus.</h3>
        <p>
          Consulte fichas, skills e campanhas e role ações do personagem. As respostas dos comandos
          aparecem no canal; senhas e tokens não são pedidos no chat.
        </p>
      </div>
      {!user ? (
        <a className="auth-link" href={loginUrl} target="_top">
          Entrar na conta para vincular Discord
        </a>
      ) : (
        <>
          {status?.link ? (
            <div className="discord-linked-profile">
              <p>
                Vinculado a <b>{status.link.displayName}</b>
                <small>ID {status.link.discordId}</small>
              </p>
              <button
                className="quiet"
                disabled={busy}
                onClick={() => void act({ action: 'disconnect' })}
              >
                Desconectar Discord
              </button>
            </div>
          ) : (
            <div className="discord-link-steps">
              <p>
                <b>1.</b> Gere um código e envie o comando abaixo ao Inferus no Discord.
              </p>
              <button disabled={busy} onClick={() => void act({ action: 'create-pair' })}>
                {status?.pending ? 'Gerar outro código' : 'Gerar código de vínculo'}
              </button>
              {code && (
                <div className="bot-command-copy">
                  <code>!vincular {code}</code>
                  <button
                    className="quiet compact"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(`!vincular ${code}`)
                        .then(() => setNotice('Comando copiado.'))
                        .catch(() => setError('Selecione e copie o comando manualmente.'))
                    }
                  >
                    Copiar comando
                  </button>
                </div>
              )}
              {status?.pending && (
                <p className="help-text">
                  Válido até{' '}
                  {new Date(status.pending.expiresAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  . O vínculo só é liberado após confirmar a identidade aqui.
                </p>
              )}
            </div>
          )}
          {status?.pending?.discordId && (
            <div className="discord-pair-confirm">
              <p>
                <b>2.</b> O pedido veio de <b>{status.pending.displayName}</b> · ID{' '}
                {status.pending.discordId}. Confirme somente se esta é sua conta.
              </p>
              <p>
                Ao confirmar, você permite consultar suas campanhas e seu personagem, registrar
                mensagens no diário e, nas mesas em que é mestre, controlar a sessão pelo bot.
                Comandos, resumos, registros consultados e rolagens ficam públicos no canal.
              </p>
              <button
                disabled={busy}
                onClick={() => void act({ action: 'confirm', pairId: status.pending!.id })}
              >
                Confirmar vínculo com este Discord
              </button>
            </div>
          )}
          {status?.link && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act({ action: 'select', character: choice });
              }}
              className="discord-character-select"
            >
              <label>
                Personagem ativo no bot
                <select
                  aria-label="Personagem ativo no bot"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  <option value="" disabled>
                    Escolha uma ficha ou campanha
                  </option>
                  {status.choices.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={busy || !choice}>
                Usar este personagem no bot
              </button>
              {!status.choices.length && (
                <p className="help-text">
                  Salve uma ficha na conta ou participe de uma campanha para aparecer aqui.
                </p>
              )}
              <p className="help-text">
                !ficha · !skills · !acoes · !campanha · !mesa · !diario. A seleção é pessoal: vale
                em todos os canais em que você usa o bot. Selecionar uma ficha avulsa sai do
                contexto de campanha; use !campanha usar Nome para voltar à mesa. O bot usa a versão
                salva no site.
              </p>
            </form>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="editor-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
