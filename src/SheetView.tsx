import { useEffect, useMemo, useState } from 'react';
import { evaluateSheet, validateSheet, type Sheet, type Field } from '../packages/sheet-engine';
import { RPG_PRESETS, type RpgPreset } from './presets';
import { useAccount } from './AuthPanel';
const localKey = 'inferus-sheet';
function loadLocal(): Sheet | null {
  try {
    const s = JSON.parse(localStorage.getItem(localKey) || 'null');
    return s ? validateSheet(s) : null;
  } catch {
    return null;
  }
}
function fromPreset(p: RpgPreset): Sheet {
  return {
    id: `ficha_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
    name: p.name,
    sections: [
      {
        id: 'inicio',
        label: 'Primeiros passos',
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
async function accountSheets(method = 'GET', data?: unknown) {
  const r = await fetch('/api/sheets', {
    method,
    headers: { 'content-type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || 'Não foi possível sincronizar a ficha.');
  return value;
}
export function SheetView() {
  const { user } = useAccount(),
    [sheet, setSheet] = useState<Sheet | null>(loadLocal),
    [saved, setSaved] = useState<Sheet[]>([]),
    [mode, setMode] = useState('all');
  const [label, setLabel] = useState(''),
    [fieldLabel, setFieldLabel] = useState(''),
    [fieldType, setFieldType] = useState<Field['type']>('number'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setSaved([]);
    if (user)
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
    try {
      if (sheet) localStorage.setItem(localKey, JSON.stringify(sheet));
      else localStorage.removeItem(localKey);
    } catch {
      setError('Não foi possível salvar neste navegador.');
    }
  }, [sheet]);
  const calculated = useMemo(() => {
    if (!sheet) return { values: {}, error: '' };
    try {
      return { values: evaluateSheet(sheet), error: '' };
    } catch (e) {
      return { values: {} as Record<string, number>, error: (e as Error).message };
    }
  }, [sheet]);
  const update = (section: number, index: number, patch: Partial<Field>) =>
    setSheet(
      (s) =>
        s && {
          ...s,
          sections: s.sections.map((v, si) =>
            si === section
              ? { ...v, fields: v.fields.map((f, fi) => (fi === index ? { ...f, ...patch } : f)) }
              : v,
          ),
        },
    );
  const save = async () => {
    if (!sheet) return;
    try {
      await accountSheets('POST', { sheet });
      setSaved(await accountSheets());
      setNotice('Ficha salva na sua conta.');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="card">
      {user && (
        <div className="addline">
          <label>
            Fichas da conta
            <select
              aria-label="Carregar ficha da conta"
              value=""
              onChange={(e) => {
                const s = saved.find((s) => s.id === e.target.value);
                if (s) setSheet(s);
              }}
            >
              <option value="">Escolha uma ficha</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {sheet && (
            <>
              <button onClick={save}>Salvar na conta</button>
              <button
                className="quiet"
                onClick={async () => {
                  try {
                    await accountSheets('DELETE', { id: sheet.id });
                    setSaved(await accountSheets());
                    setNotice('Ficha removida da conta; a cópia local permanece.');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
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
      {notice && <p role="status">{notice}</p>}
      {!sheet ? (
        <div className="preset-picker">
          <div className="picker-intro">
            <span className="eyebrow">COMECE SEM MANUAL</span>
            <h2>Qual linguagem combina com sua mesa?</h2>
            <p className="muted">Cada preset é um ponto de partida editável.</p>
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
            ].map(([id, name]) => (
              <button
                key={id}
                className={mode === id ? 'selected' : ''}
                onClick={() => setMode(id)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="preset-grid">
            {RPG_PRESETS.filter((p) => mode === 'all' || mode === p.mode).map((p) => (
              <button className="preset-card" key={p.id} onClick={() => setSheet(fromPreset(p))}>
                <strong>{p.name}</strong>
                <p>{p.description}</p>
                <small>usar este ponto de partida →</small>
              </button>
            ))}
          </div>
          <details className="sources">
            <summary>Créditos e fontes</summary>
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
        <>
          <div className="hero-line">
            <label>
              Nome da ficha
              <input
                value={sheet.name}
                maxLength={120}
                onChange={(e) => setSheet({ ...sheet, name: e.target.value })}
              />
            </label>
            <button className="quiet" onClick={() => setSheet(null)}>
              Nova ficha / trocar preset
            </button>
          </div>
          <p className="muted">
            Os campos são editáveis. Sua cópia fica neste navegador
            {user
              ? '; salve na conta para abrir em outro dispositivo.'
              : '. Entre para salvar na conta.'}
          </p>
          <div className="addline">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nova seção"
              aria-label="Nome da nova seção"
            />
            <button
              onClick={() => {
                if (label.trim()) {
                  setSheet({
                    ...sheet,
                    sections: [
                      ...sheet.sections,
                      {
                        id: `sec_${crypto.randomUUID().slice(0, 8)}`,
                        label: label.trim(),
                        fields: [],
                      },
                    ],
                  });
                  setLabel('');
                }
              }}
            >
              Adicionar seção
            </button>
          </div>
          <div className="addline">
            <input
              value={fieldLabel}
              onChange={(e) => setFieldLabel(e.target.value)}
              aria-label="Nome do novo campo"
              placeholder="Novo campo"
            />
            <select
              aria-label="Tipo do novo campo"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as Field['type'])}
            >
              {['number', 'text', 'boolean', 'list', 'calculated', 'action', 'resource'].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
            <span className="muted">Adicione o campo na seção desejada.</span>
          </div>
          {sheet.sections.map((s, si) => (
            <div className="sheet-section" key={s.id}>
              <div className="section-title">
                <h3>{s.label}</h3>
                <button
                  aria-label={`Remover seção ${s.label}`}
                  onClick={() =>
                    setSheet({ ...sheet, sections: sheet.sections.filter((_, i) => i !== si) })
                  }
                >
                  ×
                </button>
              </div>
              {s.fields.map((f, fi) => (
                <div className="field" key={f.id}>
                  <label>
                    {f.label}
                    <small>{f.id}</small>
                    {f.type === 'calculated' || f.type === 'action' ? (
                      <input
                        aria-label={f.label}
                        value={f.formula ?? f.expression ?? ''}
                        onChange={(e) =>
                          update(
                            si,
                            fi,
                            f.type === 'calculated'
                              ? { formula: e.target.value }
                              : { expression: e.target.value },
                          )
                        }
                      />
                    ) : f.type === 'boolean' ? (
                      <input
                        aria-label={f.label}
                        type="checkbox"
                        checked={Boolean(f.value)}
                        onChange={(e) => update(si, fi, { value: e.target.checked })}
                      />
                    ) : f.type === 'resource' ? (
                      <span>
                        <input
                          aria-label={`${f.label} atual`}
                          type="number"
                          value={(f.value as any).current}
                          onChange={(e) =>
                            update(si, fi, {
                              value: { ...(f.value as object), current: Number(e.target.value) },
                            })
                          }
                        />
                        <input
                          aria-label={`${f.label} máximo`}
                          type="number"
                          value={(f.value as any).max}
                          onChange={(e) =>
                            update(si, fi, {
                              value: { ...(f.value as object), max: Number(e.target.value) },
                            })
                          }
                        />
                      </span>
                    ) : (
                      <input
                        aria-label={f.label}
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={
                          f.type === 'list'
                            ? (f.value as string[]).join(', ')
                            : String(f.value ?? '')
                        }
                        onChange={(e) =>
                          update(si, fi, {
                            value:
                              f.type === 'number'
                                ? Number(e.target.value)
                                : f.type === 'list'
                                  ? e.target.value.split(',').map((v) => v.trim())
                                  : e.target.value,
                          })
                        }
                      />
                    )}
                  </label>
                  {f.type === 'calculated' && <strong>{calculated.values[f.id] ?? 'erro'}</strong>}
                  <button
                    aria-label={`Remover campo ${f.label}`}
                    onClick={() =>
                      setSheet({
                        ...sheet,
                        sections: sheet.sections.map((v, i) =>
                          i === si ? { ...v, fields: v.fields.filter((_, j) => j !== fi) } : v,
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                disabled={!fieldLabel.trim()}
                onClick={() => {
                  const f: Field = {
                    id: `campo_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
                    label: fieldLabel.trim(),
                    type: fieldType,
                  };
                  if (fieldType === 'calculated') f.formula = '0';
                  else if (fieldType === 'action') f.expression = '1d20';
                  else
                    f.value =
                      fieldType === 'number'
                        ? 0
                        : fieldType === 'boolean'
                          ? false
                          : fieldType === 'list'
                            ? []
                            : fieldType === 'resource'
                              ? { current: 0, max: 0 }
                              : '';
                  setSheet({
                    ...sheet,
                    sections: sheet.sections.map((v, i) =>
                      i === si ? { ...v, fields: [...v.fields, f] } : v,
                    ),
                  });
                  setFieldLabel('');
                }}
              >
                Adicionar campo nesta seção
              </button>
            </div>
          ))}
          {calculated.error && (
            <p className="error" role="alert">
              {calculated.error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
