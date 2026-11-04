import { withCharacterTree } from '../packages/campaign-characters';
import { requestJSON } from './http';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  evaluateSheet,
  resolveActionExpression,
  validateSheet,
  type Sheet,
  type Section,
  type Field,
  type FieldType,
} from '../packages/sheet-engine';
import { roll } from '../packages/dice-core';
import { RPG_PRESETS, type RpgPreset } from './presets';
import { useAccount } from './AuthPanel';
import { DeleteDialog, HistoryButtons, Icon, downloadJSON, useHistory } from './editor-shared';
import { playDiceSound, useDiceSound } from './dice-feedback';
import { SheetRollDock, type SheetRoll } from './SheetRollDock';
const CharacterTreePanel = lazy(() =>
  import('./CharacterTreePanel').then((m) => ({ default: m.CharacterTreePanel })),
);
const localKey = 'inferus-sheet';
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 14)}`;
function loadLocal(): Sheet | null {
  try {
    const s = JSON.parse(localStorage.getItem(localKey) || 'null');
    return s ? withCharacterTree({ ...s, name: s.name?.trim() || 'Personagem sem nome' }) : null;
  } catch {
    return null;
  }
}
function fromPreset(p: RpgPreset): Sheet {
  return {
    id: id('ficha'),
    name: p.name,
    sections: [
      {
        id: 'inicio',
        label: 'Identidade',
        fields: [{ id: 'nome', label: 'Nome', type: 'text', value: '' }],
      },
      {
        id: 'atributos',
        label: 'Atributos e escolhas',
        fields: p.fields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type === 'number' ? 'number' : f.type === 'list' ? 'list' : 'text',
          value:
            f.type === 'number'
              ? Number(f.value)
              : f.type === 'list'
                ? f.value.split(',').map((v) => v.trim())
                : f.value,
        })),
      },
    ],
  };
}
const fieldTypes: Record<FieldType, { label: string; description: string; symbol: string }> = {
  number: { label: 'Número', description: 'Atributos, perícias e valores', symbol: '01' },
  text: { label: 'Texto', description: 'Identidade, história e notas', symbol: 'Aa' },
  boolean: { label: 'Marcador', description: 'Condições e estados', symbol: '✓' },
  resource: { label: 'Recurso', description: 'Vida, mana e reservas', symbol: '◒' },
  list: { label: 'Lista', description: 'Inventário, vínculos e traços', symbol: '☷' },
  calculated: { label: 'Calculado', description: 'Fórmulas que se atualizam', symbol: 'ƒ' },
  action: { label: 'Ação', description: 'Expressões prontas para rolar', symbol: '◇' },
};
const modules = [
  {
    key: 'attributes',
    name: 'Atributos',
    description: 'Seis pilares para o personagem.',
    symbol: '01',
  },
  {
    key: 'resources',
    name: 'Vitalidade',
    description: 'Vida e energia para a jornada.',
    symbol: '◒',
  },
  {
    key: 'inventory',
    name: 'Inventário',
    description: 'O que você leva pelo caminho.',
    symbol: '☷',
  },
  { key: 'story', name: 'História', description: 'Motivações, vínculos e notas.', symbol: 'Aa' },
  { key: 'actions', name: 'Ações', description: 'Sua próxima jogada, à mão.', symbol: '◇' },
];
function fieldSlug(label: string) {
  const slug = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return /^[a-z]/.test(slug) ? slug : `campo_${slug || 'novo'}`;
}
function uniqueFields(sheet: Sheet, fields: Field[]) {
  const taken = new Set(sheet.sections.flatMap((s) => s.fields.map((f) => f.id)));
  return fields.map((f) => {
    const base = fieldSlug(f.label);
    let candidate = base,
      index = 2;
    while (taken.has(candidate)) candidate = `${base}_${index++}`;
    taken.add(candidate);
    return { ...f, id: candidate };
  });
}
function newField(type: FieldType, label: string): Field {
  const base = { id: fieldSlug(label), label, type };
  return type === 'calculated'
    ? { ...base, formula: '0' }
    : type === 'action'
      ? { ...base, expression: '1d20' }
      : {
          ...base,
          value:
            type === 'number'
              ? 0
              : type === 'boolean'
                ? false
                : type === 'resource'
                  ? { current: 10, max: 10 }
                  : type === 'list'
                    ? []
                    : '',
        };
}
function moduleSection(key: string): Section {
  const config = modules.find((m) => m.key === key)!;
  let fields: Field[] = [];
  if (key === 'attributes')
    fields = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Presença'].map(
      (label) => ({ ...newField('number', label), value: 10 }),
    );
  if (key === 'resources') fields = ['Vida', 'Energia'].map((label) => newField('resource', label));
  if (key === 'inventory')
    fields = [newField('list', 'Equipamentos'), newField('number', 'Moedas')];
  if (key === 'story')
    fields = ['Conceito', 'Motivação', 'Vínculos', 'Notas de sessão'].map((label) =>
      newField('text', label),
    );
  if (key === 'actions')
    fields = [newField('action', 'Teste de habilidade'), newField('action', 'Ataque')];
  return { id: id('sec'), label: config.name, fields };
}
async function accountSheets(method = 'GET', data?: unknown) {
  return requestJSON('/api/sheets', {
    method,
    headers: { 'content-type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
}
function FieldComposer({
  onCreate,
  onClose,
}: {
  onCreate: (type: FieldType, label: string) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<FieldType>('number'),
    [name, setName] = useState('');
  return (
    <form
      className="field-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onCreate(type, name.trim());
      }}
    >
      <div className="section-title">
        <h4>O que faz parte deste personagem?</h4>
        <button
          type="button"
          className="icon-btn"
          aria-label="Fechar criador de campo"
          onClick={onClose}
        >
          <Icon name="close" size={15} />
        </button>
      </div>
      <div className="field-type-grid">
        {Object.entries(fieldTypes).map(([key, t]) => (
          <button
            key={key}
            type="button"
            aria-pressed={type === key}
            onClick={() => setType(key as FieldType)}
          >
            <span>{t.symbol}</span>
            {t.label}
          </button>
        ))}
      </div>
      <p className="help-text">{fieldTypes[type].description}</p>
      <label>
        Nome do novo campo
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Coragem, Vida, Juramento…"
          required
          maxLength={120}
          autoFocus
        />
      </label>
      <div className="composer-actions">
        <button type="button" className="quiet" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit">
          <Icon name="plus" size={14} />
          Adicionar campo
        </button>
      </div>
    </form>
  );
}
function CharacterField({
  field: f,
  editing,
  value,
  onUpdate,
  onDelete,
  onRoll,
}: {
  field: Field;
  editing: boolean;
  value?: number;
  onUpdate: (patch: Partial<Field>) => void;
  onDelete: () => void;
  onRoll: () => void;
}) {
  const resource = f.value as { current: number; max: number };
  return (
    <div className={`character-field kind-${f.type}`}>
      <div className="character-field-heading">
        <span>{fieldTypes[f.type].label}</span>
        {editing && (
          <button className="icon-btn" aria-label={`Remover campo ${f.label}`} onClick={onDelete}>
            <Icon name="close" size={13} />
          </button>
        )}
      </div>
      <label className="character-field-label">
        <span>{f.label}</span>
        {f.type === 'number' ? (
          <input
            aria-label={f.label}
            type="number"
            min={f.min}
            max={f.max}
            step={f.integer ? 1 : 'any'}
            value={String(f.value ?? 0)}
            onChange={(e) => onUpdate({ value: Number(e.target.value) })}
          />
        ) : f.type === 'boolean' ? (
          <span className="boolean-control">
            <input
              type="checkbox"
              aria-label={f.label}
              checked={Boolean(f.value)}
              onChange={(e) => onUpdate({ value: e.target.checked })}
            />
            <span>{f.value ? 'Ativo' : 'Inativo'}</span>
          </span>
        ) : f.type === 'text' ? (
          <textarea
            aria-label={f.label}
            value={String(f.value ?? '')}
            rows={3}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Escreva sua história…"
          />
        ) : f.type === 'list' ? (
          <textarea
            aria-label={f.label}
            value={(f.value as string[]).join('\n')}
            rows={3}
            onChange={(e) => onUpdate({ value: e.target.value.split('\n') })}
            placeholder="Um item por linha"
          />
        ) : f.type === 'calculated' ? (
          <output aria-label={`Resultado de ${f.label}`}>{value ?? '—'}</output>
        ) : null}
      </label>
      {f.type === 'resource' && (
        <div className="resource-widget">
          <div className="resource-values">
            <label>
              Atual
              <input
                type="number"
                aria-label={`${f.label} atual`}
                min={0}
                max={resource.max}
                value={resource.current}
                onChange={(e) =>
                  onUpdate({
                    value: {
                      ...resource,
                      current: Math.min(resource.max, Math.max(0, Number(e.target.value))),
                    },
                  })
                }
              />
            </label>
            <span>/</span>
            <label>
              Máximo
              <input
                type="number"
                aria-label={`${f.label} máximo`}
                min={0}
                value={resource.max}
                onChange={(e) => {
                  const max = Math.max(0, Number(e.target.value));
                  onUpdate({ value: { max, current: Math.min(resource.current, max) } });
                }}
              />
            </label>
          </div>
          <div
            className="resource-meter"
            role="meter"
            aria-label={f.label}
            aria-valuemin={0}
            aria-valuemax={resource.max}
            aria-valuenow={resource.current}
          >
            <span
              style={{ width: `${resource.max ? (100 * resource.current) / resource.max : 0}%` }}
            />
          </div>
          <div className="resource-buttons">
            <button
              className="quiet"
              aria-label={`Reduzir ${f.label}`}
              disabled={resource.current <= 0}
              onClick={() =>
                onUpdate({ value: { ...resource, current: Math.max(0, resource.current - 1) } })
              }
            >
              <Icon name="minus" size={14} />
            </button>
            <button
              className="quiet"
              aria-label={`Recuperar ${f.label}`}
              disabled={resource.current >= resource.max}
              onClick={() =>
                onUpdate({
                  value: { ...resource, current: Math.min(resource.max, resource.current + 1) },
                })
              }
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>
      )}
      {f.type === 'action' && (
        <div className="action-widget">
          <code>{f.expression || '1d20'}</code>
          <button onClick={onRoll}>
            <Icon name="skill" size={15} />
            Rolar {f.label}
          </button>
        </div>
      )}
      {editing && (
        <details className="field-settings">
          <summary>Ajustar campo</summary>
          <label>
            Rótulo do campo
            <input
              value={f.label}
              aria-label={`Renomear campo ${f.label}`}
              onChange={(e) => onUpdate({ label: e.target.value })}
              maxLength={120}
            />
          </label>
          {f.type === 'calculated' && (
            <label>
              Fórmula
              <input
                aria-label={`Fórmula de ${f.label}`}
                value={f.formula ?? '0'}
                maxLength={200}
                onChange={(e) => onUpdate({ formula: e.target.value })}
                placeholder="floor((@forca - 10) / 2)"
              />
            </label>
          )}
          {f.type === 'action' && (
            <label>
              Expressão de dados
              <input
                aria-label={`Expressão de ${f.label}`}
                value={f.expression ?? '1d20'}
                maxLength={200}
                onChange={(e) => onUpdate({ expression: e.target.value })}
              />
            </label>
          )}
          <p>
            Referência para fórmulas: <code>@{f.id}</code>
          </p>
        </details>
      )}
    </div>
  );
}
export function SheetView({
  initialSheet,
  onCampaignSave,
}: { initialSheet?: Sheet | null; onCampaignSave?: (sheet: Sheet) => Promise<void> } = {}) {
  const { user } = useAccount(),
    history = useHistory<Sheet | null>(() =>
      initialSheet === undefined
        ? loadLocal()
        : initialSheet
          ? withCharacterTree(initialSheet)
          : null,
    ),
    sheet = history.value;
  const [saved, setSaved] = useState<Sheet[]>([]),
    [mode, setMode] = useState('all'),
    [query, setQuery] = useState(''),
    [choosing, setChoosing] = useState(!sheet),
    [editing, setEditing] = useState(!onCampaignSave),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [newSection, setNewSection] = useState(''),
    [composer, setComposer] = useState<string | null>(null),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: () => void;
      undoable?: boolean;
    } | null>(null),
    [savedLocally, setSavedLocally] = useState(true),
    [activeSection, setActiveSection] = useState(''),
    [mobileTools, setMobileTools] = useState(false),
    [diceRoll, setDiceRoll] = useState<SheetRoll | null>(null),
    [focusDiceInput, setFocusDiceInput] = useState(false);
  const [soundOn, toggleSound] = useDiceSound();
  const diceTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setDiceRoll(null);
  }, [sheet?.id]);
  const fieldCount = sheet?.sections.reduce((sum, s) => sum + s.fields.length, 0) ?? 0;
  useEffect(() => {
    let active = true;
    setSaved([]);
    if (user && !onCampaignSave)
      accountSheets()
        .then((s) => {
          if (active) setSaved(s);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (onCampaignSave) return;
    try {
      if (sheet) localStorage.setItem(localKey, JSON.stringify(sheet));
      setSavedLocally(true);
    } catch {
      setSavedLocally(false);
      setError('Não foi possível salvar neste navegador. Exporte uma cópia da ficha.');
    }
  }, [sheet]);
  useEffect(() => {
    if (!sheet) setChoosing(true);
  }, [sheet]);
  const calculated = useMemo(() => {
    if (!sheet) return { values: {} as Record<string, number>, error: '' };
    try {
      return { values: evaluateSheet(sheet), error: '' };
    } catch (e) {
      return { values: {} as Record<string, number>, error: (e as Error).message };
    }
  }, [sheet]);
  const change = (next: Sheet | null) => {
    try {
      if (next)
        next = {
          ...withCharacterTree({ ...next, name: next.name.trim() || 'Personagem sem nome' }),
          name: next.name,
        };
      history.commit(next);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const updateField = (section: string, field: string, patch: Partial<Field>) => {
    if (sheet)
      change({
        ...sheet,
        sections: sheet.sections.map((s) =>
          s.id === section
            ? { ...s, fields: s.fields.map((f) => (f.id === field ? { ...f, ...patch } : f)) }
            : s,
        ),
      });
  };
  const addModule = (key: string) => {
    if (!sheet) return;
    const module = moduleSection(key);
    const section = { ...module, fields: uniqueFields(sheet, module.fields) };
    change({ ...sheet, sections: [...sheet.sections, section] });
    setActiveSection(section.id);
    setNotice(`Módulo ${section.label} adicionado.`);
  };
  const focusSection = (id: string) => {
    setActiveSection(id);
    setCollapsed((old) => {
      const n = new Set(old);
      n.delete(id);
      return n;
    });
    requestAnimationFrame(() =>
      document.getElementById(`character-section-${id}`)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'start',
      }),
    );
  };
  const save = async () => {
    if (!sheet || busy) return;
    setBusy(true);
    try {
      validateSheet(sheet);
      await accountSheets('POST', { sheet });
      setSaved(await accountSheets());
      setNotice('Ficha salva na sua conta.');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const performRoll = (rawExpression: string, name: string) => {
    setFocusDiceInput(false);
    try {
      if (rawExpression.includes('@') && calculated.error) throw new Error(calculated.error);
      const expression = resolveActionExpression(rawExpression, calculated.values);
      const result = roll(expression, { user: 'local', channel: 'web' });
      playDiceSound(soundOn, result.passed !== false);
      setDiceRoll({
        result,
        name,
        expression: rawExpression,
      });
      setNotice('');
      setError('');
    } catch (e) {
      playDiceSound(soundOn, false);
      setDiceRoll({ result: null, name, expression: rawExpression, error: (e as Error).message });
    }
  };
  const playAction = (f: Field) => {
    diceTrigger.current = document.activeElement as HTMLElement;
    performRoll(f.expression || '1d20', f.label);
  };
  const start = (next: Sheet) => {
    change(next);
    setChoosing(false);
    setEditing(true);
    setCollapsed(new Set());
    setComposer(null);
    setNotice('Sua ficha está pronta para ganhar vida.');
  };
  return (
    <div className="character-studio editor-workspace">
      {onCampaignSave && (
        <div className="campaign-character-save">
          <p>
            Ficha e árvore compartilhadas somente com você e o DM. Alterações ficam em rascunho até
            salvar.
          </p>
          <button
            disabled={busy || !sheet}
            onClick={async () => {
              if (!sheet || busy) return;
              setBusy(true);
              try {
                await onCampaignSave(withCharacterTree(sheet));
                setNotice('Ficha e árvore salvas na campanha.');
                setError('');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Salvando…' : 'Salvar ficha e árvore na campanha'}
          </button>
        </div>
      )}
      <div className="studio-toolbar">
        <div className="studio-title">
          <span className="studio-symbol">
            <Icon name="skill" size={25} />
          </span>
          <div>
            <span className="eyebrow">
              {onCampaignSave ? 'PERSONAGEM DA CAMPANHA' : 'ATELIÊ DE PERSONAGENS'}
            </span>
            <h2>
              {choosing
                ? 'Uma ficha com a sua identidade.'
                : onCampaignSave
                  ? 'Sua ficha na mesa.'
                  : 'Seu personagem, por inteiro.'}
            </h2>
          </div>
        </div>
        <div className="studio-actions">
          {sheet && !choosing && (
            <button
              className="compact"
              onClick={() => {
                diceTrigger.current = document.activeElement as HTMLElement;
                setFocusDiceInput(true);
                setDiceRoll((current) =>
                  current
                    ? { ...current }
                    : { result: null, name: 'Rolagem de atributos', expression: '4d6kh3' },
                );
              }}
            >
              {' '}
              <Icon name="skill" size={15} />
              Rolar dados
            </button>
          )}

          <HistoryButtons history={history} />
          {sheet && !choosing && (
            <>
              <button className="quiet compact" onClick={() => setChoosing(true)}>
                Nova ficha / trocar preset
              </button>
              <button
                className="icon-btn"
                aria-label="Exportar ficha"
                title="Exportar ficha"
                onClick={() => downloadJSON(sheet, 'inferus-personagem.json')}
              >
                <Icon name="download" />
              </button>
            </>
          )}
          {sheet && choosing && (
            <button className="quiet compact" onClick={() => setChoosing(false)}>
              Voltar à ficha atual
            </button>
          )}
        </div>
      </div>
      {user && !onCampaignSave && (
        <div className="account-sheet-bar">
          <label>
            Fichas da conta
            <select
              aria-label="Carregar ficha da conta"
              value=""
              onChange={(e) => {
                const s = saved.find((s) => s.id === e.target.value);
                if (s) {
                  change(validateSheet(s));
                  setChoosing(false);
                  setCollapsed(new Set());
                  setComposer(null);
                }
              }}
            >
              <option value="">Escolha uma ficha</option>
              {saved.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {sheet && !choosing && (
            <>
              <button disabled={busy} onClick={save}>
                {busy ? 'Salvando…' : 'Salvar na conta'}
              </button>
              <button
                className="quiet"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    title: 'Remover esta ficha da conta?',
                    undoable: false,
                    description:
                      'A cópia deste navegador será preservada. Você poderá salvá-la na conta novamente.',
                    action: () => {
                      setBusy(true);
                      accountSheets('DELETE', { id: sheet.id })
                        .then(() => accountSheets())
                        .then((s) => {
                          setSaved(s);
                          setNotice('Ficha removida da conta; a cópia local permanece.');
                        })
                        .catch((e) => setError(e.message))
                        .finally(() => setBusy(false));
                    },
                  })
                }
              >
                Remover da conta
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <div className="editor-notice" role="status">
          {notice}
          <button className="icon-btn" aria-label="Dispensar aviso" onClick={() => setNotice('')}>
            <Icon name="close" size={13} />
          </button>
        </div>
      )}
      {choosing ? (
        <div className="character-onboarding">
          <div className="creation-steps">
            <span className="current">
              <b>01</b>Escolha uma base
            </span>
            <i />
            <span>
              <b>02</b>Dê identidade
            </span>
            <i />
            <span>
              <b>03</b>Faça do seu jeito
            </span>
          </div>
          <div className="character-start-hero">
            <div>
              <span className="eyebrow">NENHUM PERSONAGEM É IGUAL</span>
              <h2>
                Comece com uma ideia.
                <br />
                Construa o resto em jogo.
              </h2>
              <p>
                Escolha uma linguagem para a sua mesa ou comece com uma página em branco. Tudo pode
                ser adaptado.
              </p>
            </div>
            <button
              className="blank-sheet-card"
              onClick={() =>
                start({
                  id: id('ficha'),
                  name: 'Novo personagem',
                  sections: [
                    {
                      id: id('sec'),
                      label: 'Identidade',
                      fields: [newField('text', 'Nome'), newField('text', 'Conceito')],
                    },
                  ],
                })
              }
            >
              <Icon name="plus" size={27} />
              <b>Começar do zero</b>
              <span>Um personagem. Infinitas possibilidades.</span>
              <Icon name="arrow" />
            </button>
          </div>
          <div className="preset-browser-heading">
            <div>
              <h3>Escolha o ritmo da sua história</h3>
              <p>Modelos originais, prontos para personalizar.</p>
            </div>
            <label className="search-box">
              <Icon name="search" size={16} />
              <input
                aria-label="Buscar modelos de ficha"
                placeholder="Buscar por estilo ou dado"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="mode-tabs">
            {[
              ['all', 'Todos'],
              ['pool', 'Pool de dados'],
              ['attribute-dice', 'Atributos contidos'],
              ['fiction', 'Ficção primeiro'],
              ['narrative', 'Narrativa'],
              ['traits', 'Traços modulares'],
              ['d20', 'd20 direto'],
            ].map(([v, l]) => (
              <button
                key={v}
                aria-pressed={mode === v}
                className={mode === v ? 'selected' : ''}
                onClick={() => setMode(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="character-preset-grid">
            {RPG_PRESETS.filter(
              (p) =>
                (mode === 'all' || mode === p.mode) &&
                `${p.name} ${p.description} ${p.tags.join(' ')}`
                  .toLocaleLowerCase('pt-BR')
                  .includes(query.toLocaleLowerCase('pt-BR')),
            ).map((p, i) => (
              <button className="character-preset" key={p.id} onClick={() => start(fromPreset(p))}>
                <div className="preset-visual">
                  <Icon name="skill" size={36} />
                  <span>{p.expression}</span>
                  <small>{String(i + 1).padStart(2, '0')}</small>
                </div>
                <div className="preset-copy">
                  <div className="preset-tags">
                    {p.tags.slice(0, 2).map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <div className="preset-choose">
                    <span>{p.fields.length} campos iniciais</span>
                    <b>
                      Escolher <Icon name="arrow" size={14} />
                    </b>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {RPG_PRESETS.filter(
            (p) =>
              (mode === 'all' || mode === p.mode) &&
              `${p.name} ${p.description} ${p.tags.join(' ')}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          ).length === 0 && (
            <p className="no-results">
              Nenhum modelo encontrado. Experimente outra busca ou comece do zero.
            </p>
          )}
          <details className="sources">
            <summary>Créditos e referências dos modelos</summary>
            {RPG_PRESETS.map((p) => (
              <p key={p.id}>
                <a href={p.source.match(/https:\/\/\S+/)?.[0]} target="_blank" rel="noreferrer">
                  {p.name}
                </a>{' '}
                · Síntese original, não oficial.
              </p>
            ))}
          </details>
        </div>
      ) : (
        sheet && (
          <>
            <div className="character-identity">
              <div className="character-portrait" aria-hidden="true">
                <Icon name="skill" size={45} />
                <span>{sheet.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="character-name">
                <span className="eyebrow">PROTAGONISTA DA SUA HISTÓRIA</span>
                <label>
                  Nome da ficha
                  <input
                    value={sheet.name}
                    maxLength={120}
                    onBlur={() => {
                      if (!sheet.name.trim()) change({ ...sheet, name: 'Personagem sem nome' });
                    }}
                    onChange={(e) => change({ ...sheet, name: e.target.value })}
                  />
                </label>
                <p>
                  <span className="save-indicator">
                    <i />
                    {onCampaignSave
                      ? 'Rascunho da ficha da campanha'
                      : savedLocally
                        ? 'Cópia salva neste navegador'
                        : 'Não foi possível salvar'}
                  </span>
                  {!user && ' · Entre para salvar na conta.'}
                </p>
              </div>
              <div className="character-mode">
                <button aria-pressed={editing} onClick={() => setEditing(true)}>
                  Montar ficha
                </button>
                <button aria-pressed={!editing} onClick={() => setEditing(false)}>
                  Modo jogo
                </button>
              </div>
            </div>
            <div className="character-editor-grid">
              <section className={`character-toolbox ${mobileTools ? 'tools-open' : ''}`}>
                <button
                  className="mobile-toolbox-toggle"
                  aria-label={editing ? 'Ferramentas e módulos' : 'Índice do personagem'}
                  aria-expanded={mobileTools}
                  aria-controls="character-tools-body"
                  onClick={() => setMobileTools((v) => !v)}
                >
                  <Icon name="plus" size={18} />
                  <span>
                    <b>{editing ? 'Ferramentas e módulos' : 'Índice do personagem'}</b>
                    <small>
                      {sheet.sections.length} seções · {fieldCount} campos
                    </small>
                  </span>
                  <span aria-hidden="true">{mobileTools ? '−' : '+'}</span>
                </button>
                <div className="toolbox-body" id="character-tools-body">
                  <div className="toolbox-heading">
                    <span className="eyebrow">ÍNDICE DO PERSONAGEM</span>
                    <h3>Os capítulos da ficha</h3>
                  </div>
                  <nav aria-label="Seções da ficha" className="section-nav">
                    {sheet.sections.map((s, i) => (
                      <button
                        className={activeSection === s.id ? 'current' : ''}
                        key={s.id}
                        onClick={() => focusSection(s.id)}
                      >
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        <b>{s.label || 'Sem título'}</b>
                        <small>{s.fields.length}</small>
                      </button>
                    ))}
                    {sheet.skillTree && (
                      <button
                        className={activeSection === 'skill-tree' ? 'current' : ''}
                        onClick={() => focusSection('skill-tree')}
                      >
                        <span>✧</span>
                        <b>Árvore de habilidades</b>
                        <small>{sheet.skillTree.skills.length}</small>
                      </button>
                    )}
                  </nav>
                  <div className="sheet-summary">
                    <span>
                      <b>{sheet.sections.length}</b>seções
                    </span>
                    <span>
                      <b>{fieldCount}</b>campos
                    </span>
                    <span>
                      <b>
                        {
                          sheet.sections.flatMap((s) => s.fields).filter((f) => f.type === 'action')
                            .length
                        }
                      </b>
                      ações
                    </span>
                  </div>
                  {editing && (
                    <>
                      <div className="toolbox-heading">
                        <span className="eyebrow">EXPANDA SEU PERSONAGEM</span>
                        <h3>Adicione um módulo</h3>
                        <p>Blocos prontos que você pode editar.</p>
                      </div>
                      <div className="character-modules">
                        {modules.map((m) => (
                          <button
                            key={m.key}
                            aria-label={`Adicionar módulo ${m.name}`}
                            onClick={() => addModule(m.key)}
                          >
                            <span>{m.symbol}</span>
                            <div>
                              <b>{m.name}</b>
                              <small>{m.description}</small>
                            </div>
                            <Icon name="plus" size={15} />
                          </button>
                        ))}
                      </div>
                      <form
                        className="new-section-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (newSection.trim()) {
                            const s = { id: id('sec'), label: newSection.trim(), fields: [] };
                            change({ ...sheet, sections: [...sheet.sections, s] });
                            setComposer(s.id);
                            setActiveSection(s.id);
                            setNewSection('');
                          }
                        }}
                      >
                        <label>
                          Ou invente uma seção
                          <input
                            aria-label="Nome da nova seção"
                            maxLength={120}
                            placeholder="Ex.: Pactos e promessas"
                            value={newSection}
                            onChange={(e) => setNewSection(e.target.value)}
                          />
                        </label>
                        <button className="quiet full-button" disabled={!newSection.trim()}>
                          <Icon name="plus" size={14} />
                          Adicionar seção
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </section>
              <div className="character-sections">
                {calculated.error && (
                  <p role="alert" className="error">
                    {calculated.error}
                  </p>
                )}
                {sheet.sections.length === 0 && (
                  <div className="sheet-empty">
                    <Icon name="plus" size={36} />
                    <h3>Espaço para inventar.</h3>
                    <p>Adicione um módulo ou crie sua primeira seção.</p>
                    <button
                      onClick={() => {
                        setEditing(true);
                        addModule('attributes');
                      }}
                    >
                      Adicionar atributos
                    </button>
                  </div>
                )}
                {sheet.sections.map((s, si) => (
                  <section
                    id={`character-section-${s.id}`}
                    className={`character-section ${activeSection === s.id ? 'is-active' : ''}`}
                    key={s.id}
                  >
                    <div className="character-section-heading">
                      <span className="section-number">{String(si + 1).padStart(2, '0')}</span>
                      <div>
                        {editing ? (
                          <input
                            aria-label={`Nome da seção ${s.label}`}
                            maxLength={120}
                            value={s.label}
                            onChange={(e) =>
                              change({
                                ...sheet,
                                sections: sheet.sections.map((x) =>
                                  x.id === s.id ? { ...x, label: e.target.value } : x,
                                ),
                              })
                            }
                          />
                        ) : (
                          <h3>{s.label}</h3>
                        )}
                        <small>
                          {s.fields.length} campos ·{' '}
                          {editing ? 'construa do seu jeito' : 'pronto para a sessão'}
                        </small>
                      </div>
                      <div className="section-tools">
                        {editing && (
                          <>
                            <button
                              className="icon-btn"
                              disabled={si === 0}
                              aria-label={`Mover seção ${s.label} para cima`}
                              onClick={() => {
                                const sections = [...sheet.sections];
                                [sections[si - 1], sections[si]] = [sections[si], sections[si - 1]];
                                change({ ...sheet, sections });
                              }}
                            >
                              ↑
                            </button>
                            <button
                              className="icon-btn"
                              disabled={si === sheet.sections.length - 1}
                              aria-label={`Mover seção ${s.label} para baixo`}
                              onClick={() => {
                                const sections = [...sheet.sections];
                                [sections[si], sections[si + 1]] = [sections[si + 1], sections[si]];
                                change({ ...sheet, sections });
                              }}
                            >
                              ↓
                            </button>
                            <button
                              className="icon-btn"
                              aria-label={`Remover seção ${s.label}`}
                              onClick={() =>
                                setConfirm({
                                  title: `Excluir seção ${s.label}?`,
                                  description: `Esta seção e seus ${s.fields.length} campos serão removidos da ficha.`,
                                  action: () =>
                                    change({
                                      ...sheet,
                                      sections: sheet.sections.filter((x) => x.id !== s.id),
                                    }),
                                })
                              }
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </>
                        )}
                        <button
                          className="icon-btn collapse-button"
                          aria-label={`${collapsed.has(s.id) ? 'Expandir' : 'Recolher'} seção ${s.label}`}
                          aria-expanded={!collapsed.has(s.id)}
                          onClick={() =>
                            setCollapsed((old) => {
                              const n = new Set(old);
                              n.has(s.id) ? n.delete(s.id) : n.add(s.id);
                              return n;
                            })
                          }
                        >
                          {collapsed.has(s.id) ? '+' : '−'}
                        </button>
                      </div>
                    </div>
                    {!collapsed.has(s.id) && (
                      <>
                        <div className="character-field-grid">
                          {s.fields.map((f) => (
                            <CharacterField
                              key={f.id}
                              field={f}
                              editing={editing}
                              value={calculated.values[f.id]}
                              onUpdate={(patch) => updateField(s.id, f.id, patch)}
                              onDelete={() =>
                                setConfirm({
                                  title: `Excluir ${f.label}?`,
                                  description:
                                    'O campo será removido. Se alguma fórmula usa esta referência, ajuste-a depois da exclusão.',
                                  action: () =>
                                    change({
                                      ...sheet,
                                      sections: sheet.sections.map((x) =>
                                        x.id === s.id
                                          ? { ...x, fields: x.fields.filter((v) => v.id !== f.id) }
                                          : x,
                                      ),
                                    }),
                                })
                              }
                              onRoll={() => playAction(f)}
                            />
                          ))}
                        </div>
                        {editing &&
                          (composer === s.id ? (
                            <FieldComposer
                              onClose={() => setComposer(null)}
                              onCreate={(type, label) => {
                                change({
                                  ...sheet,
                                  sections: sheet.sections.map((x) =>
                                    x.id === s.id
                                      ? {
                                          ...x,
                                          fields: [
                                            ...x.fields,
                                            ...uniqueFields(sheet, [newField(type, label)]),
                                          ],
                                        }
                                      : x,
                                  ),
                                });
                                setComposer(null);
                                setNotice('Campo adicionado à ficha.');
                              }}
                            />
                          ) : (
                            <button
                              className="section-add-field"
                              aria-label={`Adicionar campo em ${s.label}`}
                              onClick={() => setComposer(s.id)}
                            >
                              <Icon name="plus" size={15} />
                              Adicionar campo <span>número, texto, recurso, fórmula e mais</span>
                            </button>
                          ))}
                      </>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </>
        )
      )}
      {sheet?.skillTree && !choosing && (
        <Suspense fallback={<div className="card">Abrindo árvore do personagem…</div>}>
          <CharacterTreePanel
            tree={sheet.skillTree}
            onChange={(skillTree) =>
              change({ ...sheet, skillTree: { ...skillTree, character: sheet.name } })
            }
          />
        </Suspense>
      )}
      {diceRoll && sheet && !choosing && (
        <SheetRollDock
          soundOn={soundOn}
          onToggleSound={toggleSound}
          roll={diceRoll}
          focusInput={focusDiceInput}
          onRoll={performRoll}
          onClose={() => {
            setDiceRoll(null);
            diceTrigger.current?.focus({ preventScroll: true });
          }}
        />
      )}
      {confirm && (
        <DeleteDialog
          title={confirm.title}
          description={confirm.description}
          onConfirm={confirm.action}
          undoable={confirm.undoable}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
