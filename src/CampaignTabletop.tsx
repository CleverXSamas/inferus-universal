import { useEffect, useRef, useState } from 'react';
import type { Tabletop, Token } from '../packages/tabletop';
import type { CampaignState } from '../packages/campaign-types';
import { requestJSON } from './http';
import { CharacterWindow } from './CampaignCharacters';
import './tabletop.css';
type Access = { campaignId: string; sessionToken: string; inviteToken: string };
export function CampaignTabletop({
  state,
  participantId,
  role,
  access,
}: {
  state: CampaignState;
  participantId: string;
  role: string;
  access: Access;
}) {
  const [scene, setScene] = useState<Tabletop | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, select] = useState(''),
    [character, openCharacter] = useState('');
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 24, y: 24 });
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [configuring, configure] = useState(false),
    [name, setName] = useState(''),
    [map, setMap] = useState(''),
    [columns, setColumns] = useState(24),
    [rows, setRows] = useState(18),
    [npc, setNpc] = useState('');
  const viewport = useRef<HTMLDivElement>(null),
    version = useRef(-1),
    pending = useRef(false);
  const drag = useRef<{ id?: string; x: number; y: number; px: number; py: number } | null>(null);
  const dm = role === 'dm',
    writable = state.status !== 'closed';
  const receive = (s: Tabletop) => {
    if (s.revision >= version.current) {
      version.current = s.revision;
      setScene(s);
    }
  };
  const request = (action?: unknown, signal?: AbortSignal) =>
    requestJSON<Tabletop>('/api/campaigns/tabletop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...access, ...(action === undefined ? {} : { action }) }),
      signal,
    });
  useEffect(() => {
    const controller = new AbortController();
    let reading = false;
    const refresh = () => {
      if (pending.current || reading || document.hidden) return;
      reading = true;
      void request(undefined, controller.signal)
        .then((s) => {
          if (!controller.signal.aborted) receive(s);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          reading = false;
        });
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 4000);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(timer);
    };
  }, [access.campaignId, access.inviteToken, access.sessionToken]);
  const act = async (action: Record<string, unknown>) => {
    if (!scene || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      receive(await request({ ...action, revision: scene.revision }));
    } catch (e) {
      setError((e as Error).message);
      try {
        receive(await request());
      } catch {}
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const token = scene?.tokens.find((t) => t.id === selected);
  const controls = (t: Token) => writable && (dm || t.participantId === participantId);
  const move = (t: Token, x: number, y: number) =>
    void act({
      kind: 'move',
      id: t.id,
      x: Math.max(0, Math.min(scene!.columns - 1, x)),
      y: Math.max(0, Math.min(scene!.rows - 1, y)),
    });
  return (
    <section className="tabletop card" aria-label="Mesa virtual">
      <header className="tabletop-heading">
        <div>
          <span className="eyebrow">MESA VIRTUAL · CENA COMPARTILHADA</span>
          <h2>{scene?.name ?? 'Abrindo a mesa…'}</h2>
        </div>
        <div className="tabletop-tools">
          <button
            className="quiet"
            onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))}
            aria-label="Diminuir mapa"
          >
            −
          </button>
          <output>{Math.round(zoom * 100)}%</output>
          <button
            className="quiet"
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            aria-label="Ampliar mapa"
          >
            +
          </button>
          <button
            className="quiet"
            onClick={() => {
              setZoom(1);
              setPan({ x: 24, y: 24 });
            }}
          >
            Centralizar
          </button>
          {dm && (
            <button
              disabled={!scene || !writable}
              onClick={() => {
                setName(scene!.name);
                setMap(scene!.map);
                setColumns(scene!.columns);
                setRows(scene!.rows);
                configure((v) => !v);
              }}
            >
              Configurar cena
            </button>
          )}
        </div>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {configuring && (
        <form
          className="scene-config"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ kind: 'configure', name, map, columns, rows });
          }}
        >
          <label>
            Nome da cena
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Mapa · URL HTTPS
            <input
              type="url"
              placeholder="https://…"
              value={map}
              onChange={(e) => setMap(e.target.value)}
            />
          </label>
          <label>
            Colunas
            <input
              type="number"
              min={8}
              max={60}
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
            />
          </label>
          <label>
            Linhas
            <input
              type="number"
              min={8}
              max={60}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
          </label>
          <button disabled={busy}>Salvar cena</button>
        </form>
      )}
      <div className="tabletop-layout">
        <div
          className="tabletop-viewport"
          ref={viewport}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d && !d.id) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
            else if (d?.id && scene)
              setDragPreview({
                id: d.id,
                x: Math.max(0, Math.min(scene.columns - 1, d.px + (e.clientX - d.x) / (48 * zoom))),
                y: Math.max(0, Math.min(scene.rows - 1, d.py + (e.clientY - d.y) / (48 * zoom))),
              });
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            setDragPreview(null);
            if (d?.id && scene) {
              const t = scene.tokens.find((t) => t.id === d.id);
              if (t && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 5)
                move(
                  t,
                  d.px + Math.round((e.clientX - d.x) / (48 * zoom)),
                  d.py + Math.round((e.clientY - d.y) / (48 * zoom)),
                );
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragPreview(null);
          }}
        >
          {scene && (
            <div
              className="tabletop-grid"
              style={{
                width: scene.columns * 48,
                height: scene.rows * 48,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              {scene.map && (
                <img
                  className="tabletop-map"
                  src={scene.map}
                  alt="Mapa da cena"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setError('Não foi possível carregar o mapa. Confira o endereço da imagem.')
                  }
                />
              )}
              {scene.tokens.map((t) => (
                <button
                  key={t.id}
                  className={`map-token ${selected === t.id ? 'selected' : ''} ${t.hidden ? 'concealed' : ''}`}
                  style={{
                    left: (dragPreview?.id === t.id ? dragPreview.x : t.x) * 48 + 3,
                    top: (dragPreview?.id === t.id ? dragPreview.y : t.y) * 48 + 3,
                    background: t.color,
                  }}
                  aria-label={`Token ${t.name}`}
                  title={t.name}
                  onClick={() => select(t.id)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    select(t.id);
                    if (controls(t) && !busy) {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = { id: t.id, x: e.clientX, y: e.clientY, px: t.x, py: t.y };
                    }
                  }}
                  onKeyDown={(e) => {
                    const delta = {
                      ArrowLeft: [-1, 0],
                      ArrowRight: [1, 0],
                      ArrowUp: [0, -1],
                      ArrowDown: [0, 1],
                    }[e.key];
                    if (delta && controls(t)) {
                      e.preventDefault();
                      move(t, t.x + delta[0], t.y + delta[1]);
                    }
                  }}
                >
                  {t.name.slice(0, 2).toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {!scene?.tokens.length && (
            <div className="tabletop-empty">
              O próximo capítulo começa aqui.
              <small>Adicione um personagem ou prepare a cena.</small>
            </div>
          )}
        </div>
        <aside className="tabletop-inspector">
          <span className="eyebrow">PERSONAGENS NA CENA</span>
          <div className="scene-token-list">
            {scene?.tokens.map((t) => (
              <button
                key={t.id}
                className="quiet"
                aria-pressed={selected === t.id}
                onClick={() => select(t.id)}
              >
                {t.hidden ? '◌ ' : '● '}
                {t.name}
              </button>
            ))}
          </div>
          {state.participants
            .filter(
              (p) =>
                p.character &&
                (dm || p.id === participantId) &&
                !scene?.tokens.some((t) => t.participantId === p.id),
            )
            .map((p) => (
              <button
                key={p.id}
                disabled={busy || !writable || !scene}
                onClick={() =>
                  void act({ kind: 'add', participantId: p.id, name: p.character!.name })
                }
              >
                + {p.character!.name}
              </button>
            ))}
          {dm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (npc.trim()) {
                  void act({ kind: 'add', name: npc });
                  setNpc('');
                }
              }}
            >
              <label>
                NPC ou criatura
                <input
                  placeholder="Nome do token"
                  value={npc}
                  maxLength={60}
                  onChange={(e) => setNpc(e.target.value)}
                />
              </label>
              <button disabled={!npc.trim() || busy || !writable || !scene}>Adicionar token</button>
            </form>
          )}
          {token && (
            <div className="token-inspector">
              <h3>{token.name}</h3>
              <p>
                Coluna {token.x + 1} · linha {token.y + 1}
              </p>
              {token.participantId && (dm || token.participantId === participantId) && (
                <button onClick={() => openCharacter(token.participantId!)}>
                  Abrir ficha e skills
                </button>
              )}
              {controls(token) && (
                <>
                  <div className="token-arrows">
                    {[
                      ['←', -1, 0],
                      ['↑', 0, -1],
                      ['↓', 0, 1],
                      ['→', 1, 0],
                    ].map(([label, x, y]) => (
                      <button
                        key={label}
                        disabled={busy}
                        aria-label={`Mover ${label}`}
                        onClick={() => move(token, token.x + Number(x), token.y + Number(y))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {dm && (
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() =>
                        void act({ kind: 'visibility', id: token.id, hidden: !token.hidden })
                      }
                    >
                      {token.hidden ? 'Revelar aos jogadores' : 'Ocultar dos outros jogadores'}
                    </button>
                  )}
                  <button
                    className="quiet"
                    disabled={busy}
                    onClick={() => void act({ kind: 'remove', id: token.id })}
                  >
                    Retirar da cena
                  </button>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
      <p className="tabletop-hint">
        Arraste o fundo para navegar. Arraste seu token ou use as setas para movê-lo. As posições
        são compartilhadas com a mesa.
      </p>
      {character && state.participants.some((p) => p.id === character) && (
        <CharacterWindow
          participant={state.participants.find((p) => p.id === character)!}
          access={access}
          onClose={() => openCharacter('')}
          onSaved={() => {}}
        />
      )}
    </section>
  );
}
