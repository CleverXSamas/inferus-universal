import { Fragment, useEffect, useRef, useState } from 'react';
import { campaignStatusLabels, type CampaignState } from '../packages/campaign-types';
export function CampaignJournal({
  state,
  message,
  setMessage,
  busy,
  post,
}: {
  state: CampaignState;
  message: string;
  setMessage: (value: string) => void;
  busy: boolean;
  post: () => void;
}) {
  const [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [unread, setUnread] = useState(false);
  const log = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    last = useRef('');
  const end = state.events.at(-1)?.id ?? '';
  useEffect(() => {
    if (end !== last.current) {
      if (follow.current && log.current) log.current.scrollTop = log.current.scrollHeight;
      else setUnread(true);
      last.current = end;
    }
  }, [end]);
  const visible = state.events.filter(
    (e) =>
      (filter === 'all' || (filter === 'message' ? e.kind === 'message' : e.kind !== 'message')) &&
      `${e.author} ${e.body}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const latest = () => {
    setFilter('all');
    setSearch('');
    follow.current = true;
    setUnread(false);
    requestAnimationFrame(() => {
      if (log.current) log.current.scrollTop = log.current.scrollHeight;
    });
  };
  return (
    <section className="card campaign-feed" aria-label="Diário da mesa">
      <div className="section-title">
        <div>
          <span className="eyebrow">A HISTÓRIA DA SESSÃO</span>
          <h3>Diário da mesa</h3>
        </div>
        <span aria-hidden="true">✧</span>
      </div>
      <div className="journal-tools">
        <div className="campaign-segments" aria-label="Filtrar diário">
          {(
            [
              ['all', 'Tudo'],
              ['message', 'Mensagens'],
              ['system', 'Atividade'],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className="quiet"
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
                setUnread(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          aria-label="Buscar no diário"
          placeholder="Buscar nos registros…"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div
        className="feed"
        role="log"
        aria-label="Mensagens da campanha"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        ref={log}
        onScroll={() => {
          const el = log.current!;
          follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          if (follow.current) setUnread(false);
        }}
      >
        {!visible.length && (
          <div className="campaign-empty">
            <b>
              {search || filter !== 'all' ? 'Nenhum registro encontrado' : 'O diário está pronto'}
            </b>
            <p>
              {search || filter !== 'all'
                ? 'Mude o filtro ou tente outra busca.'
                : 'Registre a primeira descoberta da mesa.'}
            </p>
          </div>
        )}
        {visible.map((e, i) => {
          const date = new Date(e.createdAt),
            day = date.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
          const previous =
            i > 0
              ? new Date(visible[i - 1].createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '';
          return (
            <Fragment key={e.id}>
              {day !== previous && <div className="journal-day">{day}</div>}
              <div className={`feed-item ${e.kind}`}>
                <b>{e.author}</b>
                <span>
                  {e.kind === 'status'
                    ? e.body.replace(
                        /Sessão: (lobby|active|paused|closed)\./g,
                        (_, value: CampaignState['status']) =>
                          `Sessão: ${campaignStatusLabels[value]}.`,
                      )
                    : e.body}
                </span>
                <small>
                  <time dateTime={e.createdAt} title={date.toLocaleString('pt-BR')}>
                    {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </small>
              </div>
            </Fragment>
          );
        })}
      </div>
      {unread && (
        <button className="quiet journal-unread" onClick={latest}>
          Novos registros ↓
        </button>
      )}
      {state.status === 'closed' ? (
        <div className="campaign-empty compact">
          <b>Sessão encerrada</b>
          <p>O diário fica disponível para consulta. O mestre pode reabrir a sessão.</p>
        </div>
      ) : (
        <form
          className="message-line"
          onSubmit={(e) => {
            e.preventDefault();
            post();
          }}
        >
          <label className="journal-compose">
            <span className="sr-only">Mensagem para a mesa</span>
            <input
              aria-label="Mensagem para a mesa"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Registre uma fala ou descoberta…"
              maxLength={500}
            />
          </label>
          <button type="submit" disabled={busy || !message.trim()}>
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      )}
      <div className="journal-footnote">
        <span>Visível para a mesa · últimos 80 registros</span>
        <span>{message.length > 0 ? `${message.length}/500` : 'Enter para enviar'}</span>
      </div>
    </section>
  );
}
