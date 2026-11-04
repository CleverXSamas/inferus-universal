import { useEffect, useRef, useState } from 'react';
import { roll, type RollRecord } from '../packages/dice-core';
import { diceExamples, rollOptions } from '../packages/discord-ui';
import { useAccount } from './AuthPanel';
import { RollCard } from './RollCard';
import { Icon } from './editor-shared';
type Config = {
  applicationId: string;
  interactionsEndpoint: string;
  installUrl: string | null;
  serviceReady: boolean;
  commands: string[];
};
export function DiscordView() {
  const { user, loginUrl } = useAccount();
  const [config, setConfig] = useState<Config | null>(null),
    [configError, setConfigError] = useState(''),
    [botToken, setBotToken] = useState(''),
    [busy, setBusy] = useState(false),
    [setupError, setSetupError] = useState(''),
    [activated, setActivated] = useState(false),
    [expression, setExpression] = useState('2d20kh1+5'),
    [target, setTarget] = useState(''),
    [reason, setReason] = useState('Teste de percepção'),
    [privateRoll, setPrivateRoll] = useState(false),
    [result, setResult] = useState<RollRecord | null>(null),
    [previewError, setPreviewError] = useState(''),
    [copied, setCopied] = useState(''),
    [copyError, setCopyError] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    builder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/discord/config', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setConfig)
      .catch((e) => {
        if (e.name !== 'AbortError')
          setConfigError(
            'Não foi possível verificar a configuração. A prévia e o guia continuam disponíveis.',
          );
      });
    return () => {
      controller.abort();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);
  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setCopyError('');
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(''), 2200);
    } catch {
      setCopyError(
        'Não foi possível copiar automaticamente. Selecione o comando abaixo e copie manualmente.',
      );
    }
  };
  const command = () => {
    const input = rollOptions({
      expressao: expression,
      alvo: target === '' ? undefined : Number(target),
      motivo: reason,
      privado: privateRoll,
    });
    return `/rolar expressao:${input.expression}${target !== '' ? ` alvo:${input.target}` : ''}${input.reason ? ` motivo:${input.reason}` : ''}${input.private ? ' privado:true' : ''}`;
  };
  const preview = () => {
    try {
      const input = rollOptions({
        expressao: expression,
        alvo: target === '' ? undefined : Number(target),
        motivo: reason,
        privado: privateRoll,
      });
      setResult(roll(input.expression, { target: input.target, user: 'preview', channel: 'web' }));
      setPreviewError('');
    } catch (e) {
      setPreviewError((e as Error).message);
    }
  };
  const activate = async () => {
    if (busy) return;
    setBusy(true);
    setSetupError('');
    setActivated(false);
    const submittedToken = botToken;
    setBotToken('');
    try {
      const response = await fetch('/api/discord/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ botToken: submittedToken }),
      });
      const out = await response.json();
      if (!response.ok) throw new Error(out.error || 'Não foi possível atualizar os comandos.');
      setActivated(true);
      if (config) setConfig({ ...config, installUrl: out.installUrl });
    } catch (e) {
      setSetupError((e as Error).message);
    } finally {
      setBotToken('');
      setBusy(false);
    }
  };
  return (
    <div className="bot-studio editor-workspace">
      <section className="bot-hero">
        <div className="bot-emblem" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M10 11h44v33H35L22 54V44H10Z" />
            <path d="m32 19 11 6v12l-11 6-11-6V25Z M32 19v24 M21 25l22 12 M43 25 21 37" />
          </svg>
        </div>
        <div>
          <span className="eyebrow">INFERUS × DISCORD</span>
          <h2>
            A próxima jogada
            <br />
            já faz parte da conversa.
          </h2>
          <p>
            Role com contexto, confira cada dado e escolha quem acompanha o resultado. O mesmo motor
            da sua mesa, no Discord.
          </p>
          <div className="bot-feature-tags">
            <span>/rolar + /ajuda</span>
            <span>Resultados auditáveis</span>
            <span>Privado quando você quiser</span>
          </div>
        </div>
        <div className="bot-hero-note">
          <span aria-hidden="true">✧</span>
          <p>
            Menos comandos decorados.
            <br />
            <b>Mais história acontecendo.</b>
          </p>
        </div>
      </section>
      <div className="bot-workspace-grid">
        <section className="bot-playground" ref={builder}>
          <div className="bot-section-heading">
            <div>
              <span className="eyebrow">EXPERIMENTE ANTES DE ROLAR</span>
              <h3>Monte sua próxima jogada.</h3>
            </div>
            <span className="bot-local-tag">Prévia local</span>
          </div>
          <form
            className="bot-builder"
            onSubmit={(e) => {
              e.preventDefault();
              preview();
            }}
          >
            <label>
              Expressão de dados no Discord
              <input
                aria-label="Expressão de dados no Discord"
                value={expression}
                onChange={(e) => {
                  setExpression(e.target.value);
                  setResult(null);
                }}
                maxLength={160}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="bot-quick-presets" aria-label="Exemplos de dados">
              {diceExamples.slice(0, 6).map((p) => (
                <button
                  className="quiet"
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setExpression(p.expression);
                    setResult(null);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="form-two">
              <label>
                Nome da jogada
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={80}
                  placeholder="Ex.: Teste de percepção"
                />
              </label>
              <label>
                Dificuldade opcional
                <input
                  type="number"
                  min={-50}
                  max={1000}
                  step={1}
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setResult(null);
                  }}
                  placeholder="Sem alvo"
                />
              </label>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={privateRoll}
              className={`bot-privacy ${privateRoll ? 'is-private' : ''}`}
              onClick={() => setPrivateRoll((v) => !v)}
            >
              <span className="privacy-track">
                <i />
              </span>
              <span>
                <b>{privateRoll ? 'Só você vê o resultado' : 'A mesa acompanha no canal'}</b>
                <small>
                  {privateRoll
                    ? 'O comando incluirá privado:true.'
                    : 'Ative para fazer uma rolagem reservada.'}
                </small>
              </span>
            </button>
            <div className="bot-builder-actions">
              <button type="submit">
                <Icon name="skill" size={16} />
                Testar prévia
              </button>
              <button
                className="quiet"
                type="button"
                onClick={() => {
                  try {
                    void copy(command(), 'builder');
                    setPreviewError('');
                  } catch (e) {
                    setPreviewError((e as Error).message);
                  }
                }}
              >
                {copied === 'builder' ? (
                  <Icon name="check" size={15} />
                ) : (
                  <Icon name="arrow" size={15} />
                )}{' '}
                {copied === 'builder' ? 'Comando copiado' : 'Copiar /rolar'}
              </button>
            </div>
            {previewError && (
              <p className="error" role="alert">
                {previewError}
              </p>
            )}
          </form>
          <div className="discord-preview">
            <div className="discord-channel">
              <span>#</span> mesa-de-aventura <small>COMO A RESPOSTA SERÁ ORGANIZADA</small>
            </div>
            <div className="discord-preview-message">
              <div className="discord-bot-avatar" aria-hidden="true">
                <Icon name="skill" size={23} />
              </div>
              <div className="discord-preview-body">
                <div className="discord-bot-name">
                  Inferus <span>APP</span>
                  <small>{privateRoll ? 'visível só para você' : 'visível para o canal'}</small>
                </div>
                <RollCard result={result} reason={reason} expression={expression} />
              </div>
            </div>
            <div className="preview-caption">
              <i />
              Esta prévia roda no navegador e não envia mensagens ao Discord.
            </div>
          </div>
        </section>
        <section className="bot-install">
          <div className="bot-section-heading">
            <div>
              <span className="eyebrow">LEVE O INFERUS PARA A MESA</span>
              <h3>Da instalação à primeira jogada.</h3>
            </div>
          </div>
          <div className={`bot-service-state ${config?.serviceReady ? 'prepared' : ''}`}>
            <i />
            <div>
              <b>
                {config?.serviceReady
                  ? 'Serviço preparado'
                  : config
                    ? 'Configuração pendente'
                    : configError
                      ? 'Verificação indisponível'
                      : 'Verificando serviço…'}
              </b>
              <p>
                {config?.serviceReady
                  ? 'Confirme a instalação usando /rolar no seu servidor.'
                  : 'A configuração do serviço precisa estar disponível para instalar o bot.'}
              </p>
            </div>
          </div>
          {configError && <p className="help-text">{configError}</p>}
          <ol className="bot-install-steps">
            <li>
              <span className="install-step-number">01</span>
              <div>
                <h4>Convide para o seu servidor</h4>
                <p>
                  Você precisa ter permissão para gerenciar o servidor. O convite não solicita
                  permissões administrativas.
                </p>
                {config?.serviceReady && config.installUrl ? (
                  <a
                    className="bot-install-link"
                    href={config.installUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Adicionar ao servidor Discord <Icon name="arrow" size={15} />
                  </a>
                ) : (
                  <span className="help-text">
                    Convite disponível quando o serviço estiver preparado.
                  </span>
                )}
              </div>
            </li>
            <li>
              <span className="install-step-number">02</span>
              <div>
                <h4>Atualize os comandos do bot</h4>
                <p>
                  Quem mantém a aplicação deve registrar esta versão para habilitar /ajuda,
                  sugestões de expressões e o nome da jogada.
                </p>
                {!user ? (
                  <a className="auth-link" href={loginUrl} target="_top">
                    Entre para configurar o Discord
                  </a>
                ) : (
                  <details className="bot-admin-setup">
                    <summary>Configurar ou atualizar comandos</summary>
                    <p>
                      Abra a aba <b>Bot</b> da aplicação no Developer Portal e gere um token novo.
                    </p>
                    {config?.applicationId && (
                      <a
                        className="bot-portal-link"
                        href={`https://discord.com/developers/applications/${config.applicationId}/bot`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir Developer Portal <Icon name="arrow" size={12} />
                      </a>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void activate();
                      }}
                    >
                      <label>
                        Novo token do bot
                        <input
                          type="password"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={512}
                          value={botToken}
                          onChange={(e) => setBotToken(e.target.value)}
                          aria-describedby="token-note"
                          required
                        />
                      </label>
                      <p id="token-note">
                        Usado uma vez por HTTPS e descartado. Não é salvo na conta, no banco ou no
                        navegador. Não envie tokens no chat.
                      </p>
                      <button
                        type="submit"
                        disabled={busy || !botToken.trim() || !config?.serviceReady}
                      >
                        {busy ? 'Atualizando…' : 'Atualizar /rolar e /ajuda'}
                      </button>
                    </form>
                  </details>
                )}
              </div>
            </li>
            <li>
              <span className="install-step-number">03</span>
              <div>
                <h4>Faça a primeira jogada</h4>
                <p>
                  No Discord, digite /rolar, selecione o Inferus e preencha a expressão. Para
                  consultar exemplos, use /ajuda após atualizar os comandos.
                </p>
                <div className="bot-command-copy">
                  <code>/rolar expressao:1d20+5</code>
                  <button
                    className="icon-btn"
                    aria-label="Copiar primeira rolagem"
                    onClick={() => void copy('/rolar expressao:1d20+5', 'first')}
                  >
                    <Icon name={copied === 'first' ? 'check' : 'arrow'} size={14} />
                  </button>
                </div>
              </div>
            </li>
          </ol>
          {setupError && (
            <p role="alert" className="error">
              {setupError}
            </p>
          )}
          {activated && (
            <p role="status" className="editor-notice">
              Comandos ativados nesta sessão. /rolar e /ajuda foram registrados. Teste no Discord
              para confirmar o uso no servidor.
            </p>
          )}
          <details className="bot-connection-details">
            <summary>Dados públicos de conexão</summary>
            <label>
              Aplicação
              <input readOnly value={config?.applicationId ?? 'Verificando…'} />
            </label>
            <label>
              Endpoint de interações
              <input readOnly value={config?.interactionsEndpoint ?? 'Verificando…'} />
            </label>
            <button
              className="quiet compact"
              disabled={!config?.interactionsEndpoint}
              onClick={() => void copy(config!.interactionsEndpoint, 'endpoint')}
            >
              {copied === 'endpoint' ? 'Endpoint copiado' : 'Copiar endpoint'}
            </button>
          </details>
        </section>
      </div>
      {copyError && (
        <p role="alert" className="error">
          {copyError}
        </p>
      )}
      {copied && (
        <span className="sr-only" role="status">
          Copiado para a área de transferência.
        </span>
      )}
      <section className="bot-command-guide">
        <div className="bot-section-heading">
          <div>
            <span className="eyebrow">UM GUIA PARA TER SEMPRE À MÃO</span>
            <h3>Mais possibilidades. Menos tentativa e erro.</h3>
          </div>
          <span className="bot-guide-label">/ajuda topico:expressoes</span>
        </div>
        <div className="bot-example-grid">
          {diceExamples.map((p) => (
            <article key={p.id}>
              <span className="example-die" aria-hidden="true">
                <Icon name="skill" size={22} />
              </span>
              <h4>{p.name}</h4>
              <code>{p.expression}</code>
              <p>{p.description}</p>
              <div>
                <button
                  className="quiet"
                  onClick={() => {
                    setExpression(p.expression);
                    setResult(null);
                    builder.current?.scrollIntoView({
                      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        ? 'instant'
                        : 'smooth',
                      block: 'start',
                    });
                  }}
                >
                  Usar na prévia
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Copiar exemplo ${p.name}`}
                  onClick={() => void copy(`/rolar expressao:${p.expression}`, p.id)}
                >
                  <Icon name={copied === p.id ? 'check' : 'arrow'} size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="bot-guide-options">
          <article>
            <b>alvo</b>
            <p>
              Compara o total com uma dificuldade. Não muda as faces dos dados nem o limiar de um
              pool.
            </p>
            <code>alvo:15</code>
          </article>
          <article>
            <b>motivo</b>
            <p>
              Dá contexto à resposta: percepção, iniciativa, ataque ou o que sua história pedir.
            </p>
            <code>motivo:Teste de percepção</code>
          </article>
          <article>
            <b>privado</b>
            <p>Escolhe quem acompanha. Sem esta opção, a rolagem é compartilhada no canal.</p>
            <code>privado:true</code>
          </article>
        </div>
      </section>
      <section className="bot-faq">
        <div>
          <span className="eyebrow">SE ALGO NÃO SAIR COMO ESPERADO</span>
          <h3>Volte para a história sem se perder.</h3>
        </div>
        <div>
          <details>
            <summary>Os comandos não aparecem no Discord.</summary>
            <p>
              Confirme que convidou a mesma aplicação mostrada nos dados de conexão e atualize os
              comandos na etapa 2. Reabra o menu de comandos do Discord e confira as permissões do
              canal e da aplicação.
            </p>
          </details>
          <details>
            <summary>“Serviço preparado” significa que o bot já está instalado?</summary>
            <p>
              Esse estado confirma a configuração do Inferus. A instalação e as permissões do seu
              servidor são confirmadas ao executar /rolar dentro do Discord.
            </p>
          </details>
          <details>
            <summary>Posso acessar minhas fichas pelo bot?</summary>
            <p>
              Nesta versão, fichas e árvores são editadas no site. O bot não vincula automaticamente
              a identidade Discord à conta do Inferus e não acessa suas fichas privadas.
            </p>
          </details>
          <details>
            <summary>A expressão foi recusada. O que posso conferir?</summary>
            <p>
              Use de 1 a 40 dados por grupo, com 2 a 1000 lados. A expressão aceita até 160
              caracteres e bônus entre -50 e +50. No modo de sucessos, todos os grupos precisam usar
              o mesmo limiar, como 6d10&gt;=8.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
