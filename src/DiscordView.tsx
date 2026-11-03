import { useState } from 'react';
import { useAccount } from './AuthPanel';
export function DiscordView() {
  const { user, loginUrl } = useAccount(),
    [botToken, setBotToken] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [installUrl, setInstallUrl] = useState('');
  const activate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/discord/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ botToken }),
      });
      const out = await response.json();
      if (!response.ok) throw new Error(out.error || 'Não foi possível ativar o Discord.');
      setInstallUrl(out.installUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBotToken('');
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <div className="eyebrow">DISCORD / ATIVAÇÃO</div>
      <h2>Leve o rolador para a sua mesa.</h2>
      <p className="muted">
        O comando /rolar funciona sob demanda, sem servidor de bot ligado o tempo todo.
      </p>
      <p>
        Aplicação: <code>1528465674731782347</code>
      </p>
      {!user ? (
        <a className="auth-link" href={loginUrl} target="_top">
          Entre para configurar o Discord
        </a>
      ) : (
        <>
          <p>
            No Discord Developer Portal, abra a aplicação, entre em Bot e gere um token novo. Use o
            campo abaixo para registrar /rolar e conectar este endereço.
          </p>
          <label>
            Novo token do bot
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              aria-describedby="token-note"
            />
          </label>
          <p id="token-note" className="muted">
            O token é usado uma vez por HTTPS e descartado. Não é salvo na conta, no banco ou no
            navegador.
          </p>
          <button disabled={busy || !botToken.trim()} onClick={activate}>
            {busy ? 'Ativando…' : 'Ativar /rolar'}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {installUrl && (
        <p role="status">
          Comando ativado.{' '}
          <a href={installUrl} target="_blank" rel="noreferrer">
            Adicionar ao servidor Discord
          </a>
        </p>
      )}
      <p className="muted">
        Depois da instalação, use <code>/rolar expressao:2d20kh1+5</code>. A opção privado mostra a
        resposta só para você.
      </p>
    </section>
  );
}
