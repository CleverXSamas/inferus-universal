import { lazy, Suspense, useEffect, useState } from 'react';
import type { CampaignState } from '../packages/campaign-types';
import { evaluateSheet, validateSheet, type Sheet } from '../packages/sheet-engine';
import { withCharacterTree } from '../packages/campaign-characters';
import { requestJSON } from './http';
import { SheetView } from './SheetView';
const CharacterTreePanel = lazy(() =>
  import('./CharacterTreePanel').then((m) => ({ default: m.CharacterTreePanel })),
);
import { Modal } from './editor-shared';
import { useAccount } from './AuthPanel';
type View = {
  participantId: string;
  participantName: string;
  canEdit: boolean;
  sheet: Sheet | null;
  revision: number;
  updatedAt: string | null;
};
type Access = { campaignId: string; sessionToken: string; inviteToken: string };
function CharacterWindow({
  participant,
  access,
  onClose,
  onSaved,
}: {
  participant: CampaignState['participants'][number];
  access: Access;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAccount();
  const [view, setView] = useState<View | null>(null),
    [draft, setDraft] = useState<Sheet | null>(null),
    [saved, setSaved] = useState<Sheet[]>([]),
    [generation, setGeneration] = useState(0),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    requestJSON<View>('/api/campaigns/character', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...access, participantId: participant.id }),
      signal: controller.signal,
    })
      .then((v) => {
        setView(v);
        setDraft(v.sheet);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [participant.id]);
  useEffect(() => {
    if (!view?.canEdit || !user) return;
    const controller = new AbortController();
    requestJSON<Sheet[]>('/api/sheets', { signal: controller.signal })
      .then(setSaved)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [view?.canEdit, user?.id]);
  const importSheet = (sheet: Sheet) => {
    setDraft(withCharacterTree(validateSheet(structuredClone(sheet))));
    setGeneration((g) => g + 1);
    setError('');
  };
  const save = async (sheet: Sheet) => {
    const result = await requestJSON<View>('/api/campaigns/character/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...access, sheet, revision: view!.revision }),
    });
    setView(result);
    onSaved();
  };
  let values: Record<string, number> = {};
  if (view?.sheet)
    try {
      values = evaluateSheet(view.sheet);
    } catch {}
  return (
    <Modal title={`Personagem de ${participant.name}`} wide onClose={onClose}>
      {!view && !error && <p role="status">Abrindo personagem…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {view?.canEdit && (
        <>
          <details className="campaign-character-import" open={!view.sheet}>
            <summary>Vincular ou trocar ficha</summary>
            <p>Vincule uma cópia da sua ficha. Sua versão privada da conta permanece preservada.</p>
            <div>
              <button
                className="quiet"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem('inferus-sheet');
                    if (!raw)
                      throw new Error('Crie uma ficha no ateliê ou escolha uma base abaixo.');
                    importSheet(JSON.parse(raw));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Usar ficha deste navegador
              </button>
              {user && (
                <label>
                  Ou uma ficha da conta
                  <select
                    aria-label="Vincular ficha da conta"
                    value=""
                    onChange={(e) => {
                      const s = saved.find((s) => s.id === e.target.value);
                      if (s) importSheet(s);
                    }}
                  >
                    <option value="" disabled>
                      Escolha uma ficha
                    </option>
                    {saved.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </details>
          <SheetView key={generation} initialSheet={draft} onCampaignSave={save} />
        </>
      )}
      {view &&
        !view.canEdit &&
        (view.sheet ? (
          <div className="campaign-character-readonly">
            <span className="eyebrow">CONSULTA DO MESTRE · SOMENTE LEITURA</span>
            <h2>{view.sheet.name}</h2>
            {view.sheet.sections.map((s) => (
              <section className="card" key={s.id}>
                <h3>{s.label}</h3>
                <dl>
                  {s.fields.map((f) => (
                    <div key={f.id}>
                      <dt>{f.label}</dt>
                      <dd>
                        {f.type === 'calculated'
                          ? String(values[f.id] ?? '—')
                          : f.type === 'resource'
                            ? `${(f.value as { current: number; max: number }).current} / ${(f.value as { current: number; max: number }).max}`
                            : f.type === 'boolean'
                              ? f.value
                                ? 'Sim'
                                : 'Não'
                              : f.type === 'action'
                                ? f.expression
                                : Array.isArray(f.value)
                                  ? f.value.join(', ')
                                  : String(f.value ?? '—')}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {view.sheet.skillTree && (
              <Suspense fallback={<p>Abrindo árvore…</p>}>
                <CharacterTreePanel tree={view.sheet.skillTree} />
              </Suspense>
            )}
          </div>
        ) : (
          <p>Este participante ainda não vinculou uma ficha à campanha.</p>
        ))}
    </Modal>
  );
}
export function CampaignCharacters({
  state,
  participantId,
  role,
  access,
  busy,
  onRemove,
  onSaved,
}: {
  state: CampaignState;
  participantId: string;
  role: string | null;
  access: Access;
  busy: boolean;
  onRemove: (id: string) => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = state.participants.find((p) => p.id === selected);
  return (
    <>
      <div className="participants">
        {state.participants.map((p) => (
          <div className={`participant ${p.id === participantId ? 'is-self' : ''}`} key={p.id}>
            <span className="participant-avatar" aria-hidden="true">
              {p.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="campaign-person-name">
              <b>
                {p.name}
                {p.id === participantId ? ' · você' : ''}
              </b>
              <small>
                {p.character
                  ? `${p.character.name} · ${p.character.unlocked}/${p.character.skills} skills`
                  : 'Personagem ainda não vinculado'}
              </small>
            </span>
            <em>{p.role === 'dm' ? 'Mestre' : 'Jogador'}</em>
            <div className="participant-actions">
              {(p.id === participantId || role === 'dm') && (
                <button
                  className="participant-sheet-button"
                  disabled={busy}
                  aria-label={`Abrir personagem de ${p.name}`}
                  onClick={() => setSelected(p.id)}
                >
                  {p.character
                    ? 'Ficha + árvore'
                    : p.id === participantId
                      ? 'Vincular ficha'
                      : 'Consultar'}
                </button>
              )}
              {role === 'dm' && p.role !== 'dm' && (
                <button
                  disabled={busy}
                  aria-label={`Remover ${p.name} da campanha`}
                  onClick={() => onRemove(p.id)}
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {chosen && (
        <CharacterWindow
          key={chosen.id}
          participant={chosen}
          access={access}
          onClose={() => setSelected(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
