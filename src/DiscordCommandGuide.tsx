import { useState } from 'react';
import { commandCatalog, commandGroups } from '../packages/discord-ui/commands';
export function DiscordCommandGuide() {
  const [group, setGroup] = useState<string>('Todos'),
    [query, setQuery] = useState(''),
    [copied, setCopied] = useState(''),
    [error, setError] = useState('');
  const normalize = (s: string) =>
    s
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const visible = commandCatalog.filter(
    (c) =>
      (group === 'Todos' || c.group === group) &&
      normalize(`${c.command} ${c.title} ${c.description}`).includes(normalize(query)),
  );
  return (
    <section className="card bot-command-guide" aria-label="Guia de comandos do Inferus">
      <div className="bot-section-heading">
        <div>
          <span className="eyebrow">DA PRIMEIRA JOGADA À CAMPANHA</span>
          <h3>O comando certo, na hora certa.</h3>
          <p>Mensagens com prefixo !. Todos no canal veem o comando e a resposta.</p>
        </div>
      </div>
      <div className="command-guide-tools">
        <div className="campaign-segments" aria-label="Categorias de comandos">
          {commandGroups.map((g) => (
            <button
              type="button"
              className="quiet"
              key={g}
              aria-pressed={g === group}
              onClick={() => {
                setGroup(g);
                setCopied('');
              }}
            >
              {g}
            </button>
          ))}
        </div>
        <input
          aria-label="Buscar comando"
          placeholder="Buscar ação, campanha, dados…"
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="command-guide-grid">
        {visible.map((c) => (
          <article key={c.command}>
            <div>
              <span className="eyebrow">{c.group}</span>
              <h4>{c.title}</h4>
              <p>{c.description}</p>
            </div>
            <div className="command-guide-copy">
              <code>{c.command}</code>
              <button
                className="quiet"
                aria-label={`Copiar ${c.command}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.command);
                    setCopied(c.command);
                    setError('');
                  } catch {
                    setError('Selecione o comando e copie manualmente.');
                  }
                }}
              >
                {copied === c.command ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="campaign-empty">
          <b>Nenhum comando encontrado</b>
          <p>Tente outra palavra ou categoria.</p>
          <button
            className="quiet"
            onClick={() => {
              setGroup('Todos');
              setQuery('');
            }}
          >
            Limpar busca
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {copied && (
        <p role="status" className="help-text">
          Comando copiado. Substitua nomes e exemplos antes de enviar no Discord.
        </p>
      )}
    </section>
  );
}
