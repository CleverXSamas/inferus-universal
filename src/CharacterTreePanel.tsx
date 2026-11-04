import { useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  canUnlock,
  validateTreeDocument,
  type TreeDocument,
  type EditorSkill,
} from '../packages/tree-editor';
import { Icon } from './editor-shared';
type SkillNode = Node<{ skill: EditorSkill; color: string }, 'characterSkill'>;
function Skill({ data }: NodeProps<SkillNode>) {
  return (
    <div
      className={`character-map-skill ${data.skill.unlocked ? 'unlocked' : ''}`}
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <small>{data.skill.unlocked ? 'DESBLOQUEADA' : `${data.skill.cost} FR`}</small>
      <strong>{data.skill.name}</strong>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
const nodeTypes = { characterSkill: Skill };
function MapTools() {
  const map = useReactFlow();
  return (
    <div className="character-map-tools">
      <button
        type="button"
        className="icon-btn"
        aria-label="Aproximar árvore do personagem"
        onClick={() => void map.zoomIn()}
      >
        <Icon name="plus" size={15} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Afastar árvore do personagem"
        onClick={() => void map.zoomOut()}
      >
        <Icon name="minus" size={15} />
      </button>
      <button
        type="button"
        className="quiet compact"
        onClick={() => void map.fitView({ padding: 0.2 })}
      >
        Enquadrar árvore
      </button>
    </div>
  );
}
export function CharacterTreePanel({
  tree,
  onChange,
}: {
  tree: TreeDocument;
  onChange?: (tree: TreeDocument) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState('');
  const nodes = useMemo<SkillNode[]>(
    () =>
      tree.skills.map((skill) => ({
        id: skill.id,
        type: 'characterSkill',
        position: skill.position,
        data: {
          skill,
          color: tree.branches.find((b) => b.id === skill.branchId)?.color ?? '#bd9ae8',
        },
      })),
    [tree],
  );
  const edges = useMemo(
    () =>
      tree.skills
        .filter((s) => s.parentId)
        .map((s) => ({
          id: `${s.parentId}-${s.id}`,
          source: s.parentId!,
          target: s.id,
          style: { stroke: '#816095', strokeWidth: 2 },
        })),
    [tree],
  );
  const chosen = tree.skills.find((s) => s.id === selected);
  return (
    <section
      id="character-section-skill-tree"
      className="character-tree-panel"
      aria-label="Árvore de habilidades do personagem"
    >
      <div className="character-tree-heading">
        <div>
          <span className="eyebrow">PROGRESSÃO DO PERSONAGEM</span>
          <h3>Árvore de habilidades</h3>
          <p>
            {tree.skills.filter((s) => s.unlocked).length} de {tree.skills.length} skills
            desbloqueadas · nível {tree.level}
          </p>
        </div>
        {onChange && (
          <button
            className="quiet compact"
            type="button"
            onClick={() => {
              try {
                const raw = localStorage.getItem('inferus-tree-studio-v1');
                if (!raw) throw new Error('Crie ou importe uma árvore no estúdio primeiro.');
                onChange(structuredClone(validateTreeDocument(JSON.parse(raw))));
                setError('');
                setSelected(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Usar árvore do estúdio
          </button>
        )}
      </div>
      <div className="character-tree-map">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, node) => setSelected(node.id)}
            minZoom={0.2}
            maxZoom={2.5}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#5e466f" gap={24} />
            <MapTools />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      {chosen && (
        <div className="character-skill-detail">
          <div>
            <b>{chosen.name}</b>
            <p>{chosen.description}</p>
            {chosen.effect && (
              <code>
                {chosen.effect.expression ??
                  `${chosen.effect.field}: +${chosen.effect.amount ?? 0}`}
              </code>
            )}
          </div>
          {onChange && (
            <button
              className="quiet compact"
              disabled={!canUnlock(tree, chosen)}
              onClick={() =>
                onChange({
                  ...tree,
                  skills: tree.skills.map((s) =>
                    s.id === chosen.id ? { ...s, unlocked: true } : s,
                  ),
                })
              }
            >
              {chosen.unlocked ? 'Skill desbloqueada' : 'Desbloquear skill'}
            </button>
          )}
        </div>
      )}
      {onChange && (
        <p className="help-text">
          Cada ficha mantém sua própria árvore. Desbloqueios registram a progressão; custos e
          efeitos ainda são ajustados manualmente na ficha.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
