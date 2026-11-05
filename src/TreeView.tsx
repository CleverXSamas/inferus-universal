import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  useReactFlow,
  useViewport,
  type Node,
  type NodeProps,
  type Edge,
  type Viewport,
} from '@xyflow/react';
import type { SkillNode } from '../packages/tree-core';
import {
  branchColors,
  canUnlock,
  deleteBranch,
  deleteSkill,
  descendants,
  moveSkill,
  newTree,
  parentOptions,
  placeSkill,
  validateTreeDocument,
  type Branch,
  type EditorSkill,
  type TreeDocument,
} from '../packages/tree-editor';
import {
  DeleteDialog,
  HistoryButtons,
  Icon,
  Modal,
  downloadJSON,
  useHistory,
} from './editor-shared';
const storageKey = 'inferus-tree-studio-v1';
const uid = () => `skill_${crypto.randomUUID().slice(0, 18)}`;
const kinds = { passiva: 'Passiva', ativa: 'Ativa', magia: 'Magia' };
function loadTree(): TreeDocument {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? validateTreeDocument(JSON.parse(raw)) : newTree();
  } catch {
    return newTree();
  }
}
type MapNode = Node<{ skill: EditorSkill; color: string; choose: () => void }, 'skill'>;
function SkillMapNode({ data, selected }: NodeProps<MapNode>) {
  const n = data.skill;
  return (
    <div
      className={`map-skill ${selected ? 'selected' : ''} ${n.unlocked ? 'unlocked' : ''}`}
      style={{ '--branch-color': data.color } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`Selecionar skill ${n.name}`}
      aria-pressed={selected}
      onClick={data.choose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          data.choose();
        }
      }}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="map-skill-top">
        <span>{kinds[n.type]}</span>
        <span>{n.unlocked ? <Icon name="check" size={13} /> : `${n.cost} FR`}</span>
      </div>
      <div className="map-skill-title">
        <Icon name="skill" size={23} />
        <strong>{n.name}</strong>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
const nodeTypes = { skill: SkillMapNode };
function MapControls() {
  const flow = useReactFlow(),
    viewport = useViewport();
  return (
    <div className="map-controls nodrag nopan">
      <button
        aria-label="Diminuir zoom"
        title="Diminuir zoom"
        onClick={() => flow.zoomOut({ duration: 150 })}
      >
        <Icon name="minus" />
      </button>
      <span>{Math.round(viewport.zoom * 100)}%</span>
      <button
        aria-label="Aumentar zoom"
        title="Aumentar zoom"
        onClick={() => flow.zoomIn({ duration: 150 })}
      >
        <Icon name="plus" />
      </button>
      <i />
      <button
        aria-label="Enquadrar árvore"
        title="Enquadrar árvore"
        onClick={() => flow.fitView({ padding: 0.3, duration: 250, maxZoom: 1 })}
      >
        <Icon name="fit" />
      </button>
      <button
        aria-label="Mover mapa para a esquerda"
        title="Mover para a esquerda"
        onClick={() => flow.setViewport({ ...viewport, x: viewport.x + 100 })}
      >
        <span className="reverse-arrow">
          <Icon name="arrow" size={14} />
        </span>
      </button>
      <button
        aria-label="Mover mapa para a direita"
        title="Mover para a direita"
        onClick={() => flow.setViewport({ ...viewport, x: viewport.x - 100 })}
      >
        <Icon name="arrow" size={14} />
      </button>
    </div>
  );
}
function Destination({
  doc,
  branchId,
  setBranch,
  parentId,
  setParent,
  exclude,
}: {
  doc: TreeDocument;
  branchId: string | null;
  setBranch: (id: string | null) => void;
  parentId: string | null;
  setParent: (id: string | null) => void;
  exclude?: string;
}) {
  return (
    <div className="destination-fields">
      <label>
        Ramo de destino
        <select
          value={branchId ?? ''}
          onChange={(e) => {
            setBranch(e.target.value || null);
            setParent(null);
          }}
        >
          <option value="">Origem · sem ramo</option>
          {doc.branches.map((b) => (
            <option value={b.id} key={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Conectar após
        <select value={parentId ?? ''} onChange={(e) => setParent(e.target.value || null)}>
          <option value="">Sem pré-requisito</option>
          {parentOptions(doc, branchId, exclude).map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
function SkillCreator({
  doc,
  initialBranch,
  onSave,
  onClose,
}: {
  doc: TreeDocument;
  initialBranch: string | null;
  onSave: (skill: SkillNode, place: boolean, branch: string | null, parent: string | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [type, setType] = useState<SkillNode['type']>('passiva'),
    [cost, setCost] = useState(1),
    [branch, setBranch] = useState<string | null>(initialBranch),
    [parent, setParent] = useState<string | null>(null),
    [effect, setEffect] = useState('none'),
    [field, setField] = useState(''),
    [amount, setAmount] = useState(1),
    [expression, setExpression] = useState('1d20'),
    [error, setError] = useState('');
  const submit = (place: boolean) => {
    try {
      const skill: SkillNode = {
        id: uid(),
        name: name.trim(),
        description: description.trim(),
        type,
        cost,
        weight: 1,
        minLevel: 1,
        ...(effect === 'attribute'
          ? { effect: { field: field.trim(), amount } }
          : effect === 'roll'
            ? { effect: { expression } }
            : {}),
      };
      validateTreeDocument({ ...doc, library: [...doc.library, skill] });
      onSave(skill, place, branch, parent);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal title="Dê forma a uma nova skill" onClose={onClose} wide>
      <p className="dialog-description">Crie uma vez. Reutilize em quantos caminhos quiser.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(true);
        }}
        className="editor-form"
      >
        <label>
          Nome da skill
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Passo entre sombras"
            autoFocus
          />
        </label>
        <fieldset className="kind-picker">
          <legend>Natureza da habilidade</legend>
          {(Object.keys(kinds) as SkillNode['type'][]).map((t) => (
            <label className={type === t ? 'chosen' : ''} key={t}>
              <input
                type="radio"
                name="skill-kind"
                checked={type === t}
                onChange={() => setType(t)}
              />
              <Icon name="skill" />
              <b>{kinds[t]}</b>
              <small>
                {t === 'passiva'
                  ? 'Sempre com você'
                  : t === 'ativa'
                    ? 'Uma decisão em ação'
                    : 'Altere o impossível'}
              </small>
            </label>
          ))}
        </fieldset>
        <div className="form-two">
          <label>
            Custo em fragmentos
            <input
              type="number"
              min={0}
              max={1000000}
              required
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
            />
          </label>
          <label>
            Efeito registrado
            <select value={effect} onChange={(e) => setEffect(e.target.value)}>
              <option value="none">Descrição livre</option>
              <option value="attribute">Bônus de atributo</option>
              <option value="roll">Expressão de dados</option>
            </select>
          </label>
        </div>
        {effect === 'attribute' && (
          <div className="form-two">
            <label>
              Referência do atributo
              <input
                value={field}
                onChange={(e) => setField(e.target.value)}
                required
                pattern="[a-z][a-z0-9_]{0,39}"
                placeholder="forca"
              />
            </label>
            <label>
              Bônus
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
            </label>
          </div>
        )}
        {effect === 'roll' && (
          <label>
            Expressão do efeito
            <input
              maxLength={200}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              required
            />
          </label>
        )}
        <label>
          Descrição e regras
          <textarea
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que muda quando esta skill entra em jogo?"
            rows={3}
          />
        </label>
        <div className="form-divider">
          <span>ONDE ESTE CAMINHO COMEÇA</span>
        </div>
        <Destination
          doc={doc}
          branchId={branch}
          setBranch={setBranch}
          parentId={parent}
          setParent={setParent}
        />
        <p className="help-text">
          Os efeitos ficam registrados na skill. Alterações na ficha são feitas no editor de
          personagem.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="quiet"
            disabled={!name.trim()}
            onClick={() => submit(false)}
          >
            Só salvar na biblioteca
          </button>
          <button disabled={!name.trim()} type="submit">
            <Icon name="plus" />
            Criar e adicionar
          </button>
        </div>
      </form>
    </Modal>
  );
}
function PlaceDialog({
  doc,
  skill,
  initialBranch,
  onPlace,
  onClose,
}: {
  doc: TreeDocument;
  skill: SkillNode;
  initialBranch: string | null;
  onPlace: (b: string | null, p: string | null) => void;
  onClose: () => void;
}) {
  const [branch, setBranch] = useState<string | null>(initialBranch),
    [parent, setParent] = useState<string | null>(null);
  return (
    <Modal title={`Adicionar ${skill.name}`} onClose={onClose}>
      <div className="placement-preview">
        <Icon name="skill" size={34} />
        <div>
          <b>{skill.name}</b>
          <span>
            {kinds[skill.type]} · {skill.cost} fragmentos
          </span>
        </div>
      </div>
      <p className="dialog-description">
        Uma nova cópia será colocada no caminho que você escolher.
      </p>
      <Destination
        doc={doc}
        branchId={branch}
        setBranch={setBranch}
        parentId={parent}
        setParent={setParent}
      />
      <div className="dialog-actions">
        <button className="quiet" onClick={onClose}>
          Cancelar
        </button>
        <button onClick={() => onPlace(branch, parent)}>
          <Icon name="plus" />
          Adicionar ao ramo
        </button>
      </div>
    </Modal>
  );
}
function BranchDialog({
  branch,
  onSave,
  onClose,
}: {
  branch?: Branch;
  onSave: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(branch?.name ?? ''),
    [color, setColor] = useState(branch?.color ?? branchColors[0]);
  return (
    <Modal title={branch ? 'Editar ramo' : 'Abra um novo caminho'} onClose={onClose}>
      <p className="dialog-description">
        Um ramo organiza uma linha de evolução. Você escolhe quais skills fazem parte dela.
      </p>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim(), color);
        }}
      >
        <label>
          Nome do ramo
          <input
            maxLength={80}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Ex.: Caminho das sombras"
          />
        </label>
        <fieldset className="color-picker">
          <legend>Cor no mapa</legend>
          {branchColors.map((c) => (
            <label style={{ '--swatch': c } as CSSProperties} key={c}>
              <input
                type="radio"
                name="branch-color"
                aria-label={`Cor ${c}`}
                checked={color === c}
                onChange={() => setColor(c)}
              />
              <span>{color === c && <Icon name="check" />}</span>
            </label>
          ))}
        </fieldset>
        <div className="dialog-actions">
          <button type="button" className="quiet" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit">{branch ? 'Salvar ramo' : 'Criar ramo'}</button>
        </div>
      </form>
    </Modal>
  );
}
function SkillInspector({
  doc,
  node,
  onApply,
  onDelete,
  onUnlock,
}: {
  doc: TreeDocument;
  node: EditorSkill;
  onApply: (n: EditorSkill, b: string | null, p: string | null) => void;
  onDelete: (subtree: boolean) => void;
  onUnlock: () => void;
}) {
  const [draft, setDraft] = useState(node),
    [branch, setBranch] = useState(node.branchId),
    [parent, setParent] = useState(node.parentId);
  const count = descendants(doc, node.id).size;
  useEffect(() => {
    setDraft(node);
    setBranch(node.branchId);
    setParent(node.parentId);
  }, [node]);
  return (
    <div className="inspector-content">
      <div className="inspector-heading">
        <span className="eyebrow">SKILL SELECIONADA</span>
        <span className={`unlock-state ${node.unlocked ? 'is-unlocked' : ''}`}>
          {node.unlocked ? 'Desbloqueada' : canUnlock(doc, node) ? 'Disponível' : 'Bloqueada'}
        </span>
      </div>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft, branch, parent);
        }}
      >
        <label>
          Nome da skill selecionada
          <input
            maxLength={120}
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="form-two">
          <label>
            Tipo
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as SkillNode['type'] })}
            >
              {Object.entries(kinds).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Custo
            <input
              min={0}
              max={1000000}
              type="number"
              required
              value={draft.cost}
              onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })}
            />
          </label>
        </div>
        <label>
          Descrição da skill
          <textarea
            rows={3}
            maxLength={2000}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <div className="form-divider">
          <span>CONEXÕES E DESTINO</span>
        </div>
        <Destination
          doc={doc}
          branchId={branch}
          setBranch={setBranch}
          parentId={parent}
          setParent={setParent}
          exclude={node.id}
        />
        {count > 0 && (
          <p className="help-text">
            Ao mudar o ramo, as {count} skills seguintes acompanham esta skill.
          </p>
        )}
        <button type="submit" className="full-button">
          Aplicar alterações
        </button>
      </form>
      {node.effect && (
        <div className="effect-note">
          <span className="eyebrow">EFEITO REGISTRADO</span>
          <code>
            {node.effect.expression ??
              `${node.effect.field}: ${(node.effect.amount ?? 0) >= 0 ? '+' : ''}${node.effect.amount ?? 0}`}
          </code>
        </div>
      )}
      <button className="quiet full-button" disabled={!canUnlock(doc, node)} onClick={onUnlock}>
        {node.unlocked ? (
          <>
            <Icon name="check" />
            Skill desbloqueada
          </>
        ) : (
          'Desbloquear skill'
        )}
      </button>
      <div className="inspector-delete">
        <button onClick={() => onDelete(false)}>
          <Icon name="trash" size={14} />
          Excluir só esta skill
        </button>
        <button onClick={() => onDelete(true)}>
          <Icon name="branch" size={14} />
          Excluir skill e sequência{count > 0 ? ` (${count + 1})` : ''}
        </button>
      </div>
    </div>
  );
}
function TreeStudio() {
  const history = useHistory(loadTree),
    doc = history.value;
  const flow = useReactFlow<MapNode>();
  const initialFit = useRef(
    (() => {
      try {
        return !localStorage.getItem(storageKey);
      } catch {
        return true;
      }
    })(),
  );
  const [selected, setSelected] = useState<string | null>(doc.skills[0]?.id ?? null),
    [activeBranch, setActiveBranch] = useState<string | null>(null),
    [leftTab, setLeftTab] = useState('skills'),
    [query, setQuery] = useState(''),
    [modal, setModal] = useState<'skill' | 'branch' | 'templates' | null>(null),
    [editingBranch, setEditingBranch] = useState<Branch | undefined>(),
    [placing, setPlacing] = useState<SkillNode | null>(null),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(true),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: () => void;
    } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [mapNodes, setMapNodes] = useState<MapNode[]>([]);
  useEffect(() => {
    setMapNodes(
      doc.skills.map((n) => ({
        id: n.id,
        type: 'skill',
        position: n.position,
        selected: n.id === selected,
        focusable: false,
        ariaLabel: n.name,
        data: {
          skill: n,
          color: doc.branches.find((b) => b.id === n.branchId)?.color ?? '#c3b7d6',
          choose: () => {
            setSelected(n.id);
            if (window.matchMedia('(max-width:680px)').matches)
              requestAnimationFrame(() =>
                document.getElementById('skill-inspector')?.scrollIntoView({
                  block: 'start',
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'instant'
                    : 'smooth',
                }),
              );
          },
        },
      })),
    );
  }, [doc.skills, doc.branches, selected]);
  useEffect(() => {
    try {
      validateTreeDocument(doc);
      localStorage.setItem(storageKey, JSON.stringify(doc));
      setSaved(true);
    } catch (e) {
      setSaved(false);
      setError(
        'Não foi possível salvar a árvore neste navegador. Exporte uma cópia para preservar seu trabalho.',
      );
    }
  }, [doc]);
  useEffect(() => {
    if (selected && !doc.skills.some((n) => n.id === selected)) setSelected(null);
    if (activeBranch && !doc.branches.some((b) => b.id === activeBranch)) setActiveBranch(null);
  }, [doc, selected, activeBranch]);
  const commit = (next: TreeDocument, message = '') => {
    try {
      history.commit(validateTreeDocument(next));
      setError('');
      if (message) setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const branchForPlacement = doc.branches.some((b) => b.id === activeBranch) ? activeBranch : null;
  const addCopy = (skill: SkillNode, b: string | null, p: string | null) => {
    try {
      const id = uid(),
        next = placeSkill(doc, skill, id, b, p);
      commit(next, 'Skill adicionada ao mapa.');
      setSelected(id);
      setPlacing(null);
      setModal(null);
      requestAnimationFrame(() => flow.fitView({ padding: 0.25, maxZoom: 1, duration: 250 }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const current = doc.skills.find((n) => n.id === selected);
  const edges: Edge[] = useMemo(
    () =>
      doc.skills
        .filter((n) => n.parentId)
        .map((n) => ({
          id: `${n.parentId}-${n.id}`,
          source: n.parentId!,
          target: n.id,
          type: 'smoothstep',
          style: {
            stroke: doc.branches.find((b) => b.id === n.branchId)?.color ?? '#a490b4',
            strokeWidth: n.unlocked ? 2.5 : 1.5,
            opacity: n.unlocked ? 1 : 0.65,
          },
          animated: false,
          selectable: false,
        })),
    [doc.skills, doc.branches],
  );
  const fitBranch = (b: Branch) => {
    setActiveBranch(b.id);
    flow.fitView({
      nodes: doc.skills.filter((n) => n.branchId === b.id).map((n) => ({ id: n.id })),
      padding: 0.5,
      maxZoom: 1,
      duration: 250,
    });
  };
  return (
    <div className="tree-studio editor-workspace">
      <div className="studio-toolbar">
        <div className="studio-title">
          <span className="studio-symbol">
            <Icon name="branch" size={25} />
          </span>
          <div>
            <span className="eyebrow">ATELIÊ DE EVOLUÇÃO</span>
            <label className="sr-only" htmlFor="tree-name">
              Nome da árvore
            </label>
            <input
              id="tree-name"
              maxLength={120}
              value={doc.name}
              onChange={(e) => commit({ ...doc, name: e.target.value })}
            />
          </div>
        </div>
        <div className="studio-actions">
          <span className="save-indicator">
            <i />
            {saved ? 'Salvo neste navegador' : 'Salvando…'}
          </span>
          <HistoryButtons history={history} />
          <button className="compact" onClick={() => setModal('skill')}>
            <Icon name="plus" size={14} />
            Nova skill
          </button>
          <button className="quiet compact" onClick={() => setModal('templates')}>
            Modelos / nova árvore
          </button>
          <button
            className="icon-btn"
            aria-label="Exportar árvore"
            title="Exportar árvore"
            onClick={() => downloadJSON(doc, 'inferus-arvore.json')}
          >
            <Icon name="download" />
          </button>
          <button className="quiet compact" onClick={() => importRef.current?.click()}>
            Importar
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Arquivo de árvore"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 1000000) {
                setError('Use um arquivo de até 1 MB.');
                return;
              }
              try {
                const next = validateTreeDocument(JSON.parse(await file.text()));
                setConfirm({
                  title: 'Abrir esta árvore?',
                  description: 'A árvore atual será substituída. Você poderá desfazer a troca.',
                  action: () => {
                    commit(next, 'Árvore importada.');
                    setSelected(null);
                    requestAnimationFrame(() => flow.fitView({ padding: 0.3, maxZoom: 1 }));
                  },
                });
              } catch {
                setError('O arquivo não contém uma árvore válida do Inferus.');
              }
            }}
          />
        </div>
      </div>
      <div className="tree-context-bar">
        <label>
          Personagem
          <input
            maxLength={120}
            value={doc.character}
            onChange={(e) => commit({ ...doc, character: e.target.value })}
          />
        </label>
        <label>
          Nível
          <input
            type="number"
            min={1}
            max={100}
            value={doc.level}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 1 && v <= 100) commit({ ...doc, level: v });
            }}
          />
        </label>
        <div className="tree-totals">
          <b>
            {doc.skills.length}
            <span>skills no mapa</span>
          </b>
          <b>
            {doc.branches.length}
            <span>ramos</span>
          </b>
          <b>
            {doc.skills.filter((n) => n.unlocked).length}
            <span>desbloqueadas</span>
          </b>
        </div>
      </div>
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
      <div className="tree-editor-grid">
        <section className="tree-library">
          <div className="studio-panel-tabs">
            <button aria-pressed={leftTab === 'skills'} onClick={() => setLeftTab('skills')}>
              Biblioteca <span>{doc.library.length}</span>
            </button>
            <button aria-pressed={leftTab === 'branches'} onClick={() => setLeftTab('branches')}>
              Ramos <span>{doc.branches.length}</span>
            </button>
          </div>
          {leftTab === 'skills' ? (
            <>
              <div className="library-intro">
                <h3>Peças da sua história</h3>
                <p>Crie uma skill e use-a em qualquer ramo.</p>
                <button className="full-button" onClick={() => setModal('skill')}>
                  <Icon name="plus" size={15} />
                  Criar skill
                </button>
                <label className="search-box">
                  <Icon name="search" size={14} />
                  <input
                    aria-label="Buscar skills"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar na biblioteca"
                  />
                </label>
              </div>
              <div className="skill-library-list">
                {doc.library
                  .filter((n) =>
                    n.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
                  )
                  .map((n) => (
                    <div className="library-skill" key={n.id}>
                      <div className="library-skill-kind">
                        <span>{kinds[n.type]}</span>
                        <span>{n.cost} FR</span>
                      </div>
                      <h4>{n.name}</h4>
                      <p>{n.description || 'Uma possibilidade esperando sua história.'}</p>
                      <div>
                        <button
                          className="library-place"
                          aria-label={`Adicionar ${n.name} a um ramo`}
                          onClick={() => setPlacing(n)}
                        >
                          <Icon name="plus" size={13} />
                          Adicionar ao mapa
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`Excluir ${n.name} da biblioteca`}
                          onClick={() =>
                            setConfirm({
                              title: 'Remover da biblioteca?',
                              description: `“${n.name}” sairá da biblioteca. As cópias já colocadas no mapa serão preservadas.`,
                              action: () =>
                                commit({
                                  ...doc,
                                  library: doc.library.filter((x) => x.id !== n.id),
                                }),
                            })
                          }
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                {doc.library.filter((n) => n.name.toLowerCase().includes(query.toLowerCase()))
                  .length === 0 && (
                  <p className="help-text">Nenhuma skill encontrada. Crie a próxima.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="library-intro">
                <h3>Um mundo de caminhos</h3>
                <p>Ramos agrupam skills e dão cor à progressão.</p>
                <button
                  className="full-button"
                  onClick={() => {
                    setEditingBranch(undefined);
                    setModal('branch');
                  }}
                >
                  <Icon name="plus" size={15} />
                  Criar ramo
                </button>
              </div>
              <div className="branch-list">
                {doc.branches.map((b) => (
                  <div
                    className={`branch-list-item ${activeBranch === b.id ? 'selected' : ''}`}
                    key={b.id}
                    style={{ '--branch-color': b.color } as CSSProperties}
                  >
                    <button className="branch-focus" onClick={() => fitBranch(b)}>
                      <i />
                      <span>
                        <b>{b.name}</b>
                        <small>{doc.skills.filter((n) => n.branchId === b.id).length} skills</small>
                      </span>
                    </button>
                    <div className="branch-item-actions">
                      <button
                        onClick={() => {
                          setEditingBranch(b);
                          setModal('branch');
                        }}
                      >
                        Editar
                      </button>
                      <button
                        aria-label={`Excluir ramo ${b.name}`}
                        onClick={() =>
                          setConfirm({
                            title: `Excluir ramo ${b.name}?`,
                            description: `O ramo e todas as ${doc.skills.filter((n) => n.branchId === b.id).length} skills dele serão removidos do mapa. A biblioteca será preservada.`,
                            action: () => commit(deleteBranch(doc, b.id), 'Ramo excluído.'),
                          })
                        }
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {doc.branches.length === 0 && (
                  <p className="help-text">
                    Ainda não há ramos. Crie um para começar a organizar o mapa.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
        <section className="skill-map-panel" aria-label="Mapa de skills">
          <div className="map-skill-jump">
            <label>
              Localizar skill no mapa
              <select
                aria-label="Localizar skill no mapa"
                value={selected ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelected(id);
                  if (id)
                    flow.fitView({
                      nodes: [{ id }],
                      padding: 1,
                      maxZoom: 1.2,
                      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        ? 0
                        : 250,
                    });
                }}
              >
                <option value="">Escolha uma skill</option>
                {[...doc.skills]
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} · {doc.branches.find((b) => b.id === n.branchId)?.name ?? 'Sem ramo'}
                      {n.unlocked ? ' · desbloqueada' : ''}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="map-panel-heading">
            <div>
              <span className="live-dot" />
              MAPA DE POSSIBILIDADES
            </div>
            <span>Arraste o fundo para explorar</span>
          </div>
          <div className="skill-map" data-testid="skill-map">
            <ReactFlow<MapNode>
              nodes={mapNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) => setMapNodes((ns) => applyNodeChanges(changes, ns))}
              onNodeDragStop={(_, node) =>
                commit({
                  ...doc,
                  skills: doc.skills.map((n) =>
                    n.id === node.id ? { ...n, position: node.position } : n,
                  ),
                })
              }
              onPaneClick={() => setSelected(null)}
              defaultViewport={doc.viewport}
              onMoveEnd={(_, v: Viewport) =>
                history.commit((old) => ({ ...old, viewport: v }), false)
              }
              minZoom={0.2}
              maxZoom={2.5}
              nodesConnectable={false}
              deleteKeyCode={null}
              fitView={initialFit.current}
              panOnDrag
              zoomOnPinch
              zoomOnScroll
              preventScrolling
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#655173" />
              <MiniMap
                nodeColor={(n) => (n.data as MapNode['data']).color}
                maskColor="#110c19bb"
                pannable
                zoomable
                ariaLabel="Visão geral da árvore"
              />
              <MapControls />
            </ReactFlow>
            {doc.skills.length === 0 && (
              <div className="empty-map">
                <Icon name="branch" size={44} />
                <h3>Toda jornada começa com uma skill.</h3>
                <p>Escolha uma da biblioteca ou crie algo que só existe na sua mesa.</p>
                <button onClick={() => setModal('skill')}>
                  <Icon name="plus" />
                  Criar primeira skill
                </button>
              </div>
            )}
          </div>
          <div className="map-legend">
            <span>
              <i className="legend-ring" />
              Skill
            </span>
            <span>
              <i className="legend-line" />
              Pré-requisito
            </span>
            <span>Arraste skills para reorganizar · zoom com scroll ou pinça</span>
          </div>
        </section>
        <section className="tree-inspector" id="skill-inspector" aria-label="Editor da skill">
          <button
            className="mobile-map-return quiet"
            onClick={() =>
              document.querySelector('.skill-map-panel')?.scrollIntoView({
                block: 'center',
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'instant'
                  : 'smooth',
              })
            }
          >
            <Icon name="arrow" size={14} />
            Voltar ao mapa
          </button>
          {current ? (
            <SkillInspector
              key={current.id}
              doc={doc}
              node={current}
              onApply={(draft, b, p) => {
                try {
                  let next =
                    b !== current.branchId || p !== current.parentId
                      ? moveSkill(doc, current.id, b, p)
                      : doc;
                  next = {
                    ...next,
                    skills: next.skills.map((n) =>
                      n.id === current.id
                        ? {
                            ...n,
                            name: draft.name.trim(),
                            description: draft.description,
                            type: draft.type,
                            cost: draft.cost,
                          }
                        : n,
                    ),
                  };
                  commit(next, 'Skill atualizada.');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              onUnlock={() => {
                if (canUnlock(doc, current))
                  commit(
                    {
                      ...doc,
                      skills: doc.skills.map((n) =>
                        n.id === current.id ? { ...n, unlocked: true } : n,
                      ),
                    },
                    'Skill desbloqueada.',
                  );
              }}
              onDelete={(subtree) =>
                setConfirm({
                  title: subtree ? 'Excluir esta sequência?' : 'Excluir esta skill?',
                  description: subtree
                    ? `“${current.name}” e suas ${descendants(doc, current.id).size} skills seguintes serão removidas. Os modelos da biblioteca continuam disponíveis.`
                    : `“${current.name}” será removida. As skills seguintes serão conectadas ao pré-requisito anterior.`,
                  action: () =>
                    commit(deleteSkill(doc, current.id, subtree), 'Exclusão concluída.'),
                })
              }
            />
          ) : (
            <div className="inspector-empty">
              <Icon name="skill" size={38} />
              <span className="eyebrow">CADA ESCOLHA IMPORTA</span>
              <h3>Explore um caminho.</h3>
              <p>
                Selecione uma skill no mapa para editar, trocar o ramo ou reorganizar suas conexões.
              </p>
              <div className="inspector-tip">
                <b>Dica de criação</b>
                <p>
                  A mesma skill da biblioteca pode aparecer em diferentes ramos, com nome e custo
                  próprios.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      {modal === 'skill' && (
        <SkillCreator
          doc={doc}
          initialBranch={branchForPlacement}
          onClose={() => setModal(null)}
          onSave={(n, place, b, p) => {
            try {
              let next = validateTreeDocument({ ...doc, library: [...doc.library, n] });
              if (place) {
                const id = uid();
                next = placeSkill(next, n, id, b, p);
                setSelected(id);
              }
              commit(
                next,
                place ? 'Skill criada e adicionada ao ramo.' : 'Skill salva na biblioteca.',
              );
              setModal(null);
              if (place)
                requestAnimationFrame(() =>
                  flow.fitView({ padding: 0.25, maxZoom: 1, duration: 200 }),
                );
            } catch (e) {
              throw e;
            }
          }}
        />
      )}
      {placing && (
        <PlaceDialog
          doc={doc}
          skill={placing}
          initialBranch={branchForPlacement}
          onClose={() => setPlacing(null)}
          onPlace={(b, p) => addCopy(placing, b, p)}
        />
      )}
      {modal === 'branch' && (
        <BranchDialog
          branch={editingBranch}
          onClose={() => setModal(null)}
          onSave={(name, color) => {
            const id = editingBranch?.id ?? `branch_${crypto.randomUUID().slice(0, 12)}`;
            const next = {
              ...doc,
              branches: editingBranch
                ? doc.branches.map((b) => (b.id === id ? { ...b, name, color } : b))
                : [...doc.branches, { id, name, color }],
            };
            try {
              validateTreeDocument(next);
              commit(next, 'Ramo salvo.');
              setActiveBranch(id);
              setModal(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {modal === 'templates' && (
        <Modal title="Escolha o começo, invente o resto." onClose={() => setModal(null)} wide>
          <p className="dialog-description">
            O modelo substitui o mapa atual. Sua biblioteca de skills é preservada e a troca pode
            ser desfeita.
          </p>
          <div className="tree-template-grid">
            {(
              [
                ['blank', 'Tela em branco', 'Sem caminhos predefinidos. Toda escolha é sua.'],
                ['universal', 'Universal', 'Um centro, duas direções e espaço para crescer.'],
                [
                  'combat',
                  'Caminhos do guerreiro',
                  'Ataque, proteção e resistência em equilíbrio.',
                ],
                ['magic', 'Círculos do arcano', 'Rituais e vínculos que ampliam o possível.'],
              ] as const
            ).map(([id, name, desc]) => (
              <button
                key={id}
                onClick={() => {
                  const next = { ...newTree(id), library: doc.library };
                  commit(next, 'Novo mapa pronto.');
                  setSelected(next.skills[0]?.id ?? null);
                  setModal(null);
                  requestAnimationFrame(() =>
                    flow.fitView({ padding: 0.3, maxZoom: 1, duration: 200 }),
                  );
                }}
              >
                <Icon name={id === 'blank' ? 'plus' : 'branch'} size={28} />
                <b>{name}</b>
                <p>{desc}</p>
                <span>
                  Usar modelo <Icon name="arrow" size={15} />
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {confirm && (
        <DeleteDialog
          title={confirm.title}
          description={confirm.description}
          onClose={() => setConfirm(null)}
          onConfirm={confirm.action}
        />
      )}
    </div>
  );
}
export function TreeView() {
  return (
    <ReactFlowProvider>
      <TreeStudio />
    </ReactFlowProvider>
  );
}
