import { useEffect, useMemo, useState } from 'react';
import { roll, PRESETS, RollRecord } from '../packages/dice-core';
import {
  defaultPool,
  generateTree,
  GeneratedTree,
  SkillNode,
  buyNode,
  canBuy,
  effects,
} from '../packages/tree-core';
import { CampaignView } from './CampaignView';
import { AuthPanel, AccountProvider } from './AuthPanel';
import { SheetView } from './SheetView';

const localKey = 'fragmentos-rolls';
function loadRolls(): RollRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(localKey) || '[]');
    return Array.isArray(v)
      ? v
          .filter(
            (r) =>
              r &&
              typeof r.roll_id === 'string' &&
              Array.isArray(r.groups) &&
              r.groups.every((g: any) => g && Array.isArray(g.dice)),
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
function saveRoll(r: RollRecord) {
  try {
    localStorage.setItem(localKey, JSON.stringify([r, ...loadRolls()].slice(0, 50)));
  } catch {}
}
function Card({ children, className = '' }: { children: any; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
function sound(enabled: boolean, success = true) {
  if (!enabled || typeof window === 'undefined') return;
  const C = window.AudioContext || (window as any).webkitAudioContext;
  if (!C) return;
  const ctx = new C();
  const now = ctx.currentTime;
  const notes = success ? [220, 330, 440] : [180, 140];
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, now + i * 0.055);
    g.gain.exponentialRampToValueAtTime(0.08, now + i * 0.055 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.14);
    o.start(now + i * 0.055);
    o.stop(now + i * 0.055 + 0.16);
  });
  setTimeout(() => ctx.close(), 400);
}
function Dice() {
  const [expression, setExpression] = useState('2d20kh1 + 5');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<RollRecord | null>(null);
  const [error, setError] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [history, setHistory] = useState<RollRecord[]>(loadRolls);
  const run = (exp = expression) => {
    try {
      setError('');
      const r = roll(exp, {
        user: 'demo',
        channel: 'web',
        target: target === '' ? undefined : Number(target),
      });
      saveRoll(r);
      setResult(r);
      setHistory((h) => [r, ...h].slice(0, 50));
      sound(soundOn, r.passed !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível rolar.');
      sound(soundOn, false);
    }
  };
  return (
    <div className="split">
      <Card>
        <div className="eyebrow">DADO ABERTO / ROLAGEM REAL</div>
        <div className="hero-line">
          <div>
            <h2>Role e ouça o resultado.</h2>
            <p className="muted">
              O som é curto, opcional e nasce no dispositivo. Cada dado continua auditável.
            </p>
          </div>
          <button
            className={`sound-toggle ${soundOn ? 'on' : ''}`}
            onClick={() => setSoundOn((v) => !v)}
          >
            {soundOn ? 'Som ligado' : 'Som desligado'} <span>◖</span>
          </button>
        </div>
        <div className="rollline">
          <input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            aria-label="Expressão de dados"
          />
          <button onClick={() => run()}>Rolar</button>
        </div>
        <div className="target">
          <label>
            Alvo opcional{' '}
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="—"
              type="number"
            />
          </label>
          <span className="hint">Ex.: 2d20kh1 · 6d10&gt;=8 · 3d6!</span>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              className="chip"
              key={p.id}
              onClick={() => {
                setExpression(p.expression);
                run(p.expression);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Card>
      <Card className="result-card">
        {result ? (
          <>
            <div className="result-head">
              <div>
                <span className="eyebrow">RESULTADO</span>
                <div className="big-number">{result.total}</div>
              </div>
              <span
                className={`status ${result.passed === undefined ? 'neutral' : result.passed ? 'good' : 'bad'}`}
              >
                {result.passed === undefined ? 'sem alvo' : result.passed ? 'passou' : 'falhou'}
              </span>
            </div>
            <div className="formula">{result.expression}</div>
            {result.groups.map((g, i) => (
              <div className="audit" key={i}>
                <div className="audit-label">
                  Grupo {i + 1} <span>{g.subtotal}</span>
                </div>
                <div className="dice-row">
                  {g.dice.map((d) => (
                    <span
                      className={d.kept ? 'die kept' : 'die'}
                      key={d.index}
                      title={`Explosão: ${d.raw.join(' → ')}`}
                    >
                      {d.total}
                      {d.raw.length > 1 && <small>!</small>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div className="total-line">
              <span>Bônus</span>
              <b>
                {result.bonus >= 0 ? '+' : ''}
                {result.bonus}
              </b>
            </div>
            <div className="roll-id">
              ID {result.roll_id} · {new Date(result.created_at).toLocaleTimeString('pt-BR')}
            </div>
          </>
        ) : (
          <div className="empty">
            <div className="empty-mark">◈</div>
            <h3>A mesa está em silêncio</h3>
            <p>
              Digite uma expressão, escolha um preset e o resultado aparece com som e explicação.
            </p>
          </div>
        )}
      </Card>
      <Card className="history">
        <div className="section-title">
          <div>
            <span className="eyebrow">ÚLTIMAS 50</span>
            <h3>Histórico local</h3>
          </div>
          <span className="muted">{history.length}/50</span>
        </div>
        {history.slice(0, 6).map((r) => (
          <button className="history-item" key={r.roll_id} onClick={() => setResult(r)}>
            <span>{r.expression}</span>
            <b>{r.total}</b>
          </button>
        ))}
      </Card>
    </div>
  );
}
function radialPosition(tree: GeneratedTree, id: string) {
  const depth = (node: string, seen = new Set<string>()): number => {
    if (seen.has(node)) return 0;
    seen.add(node);
    const parent = tree.edges.find((e) => e.to === node);
    return parent ? 1 + depth(parent.from, seen) : 0;
  };
  const d = depth(id);
  if (id === 'centro') return { left: 50, top: 50 };
  const roots = tree.nodes
    .filter((n) => n.id !== 'centro' && depth(n.id) === d)
    .sort((a, b) => a.id.localeCompare(b.id));
  const index = Math.max(
    0,
    roots.findIndex((n) => n.id === id),
  );
  const angle = (index / Math.max(roots.length, 1)) * Math.PI * 2 - Math.PI / 2;
  const radius = d === 1 ? 25 : d === 2 ? 40 : 47;
  return { left: 50 + Math.cos(angle) * radius, top: 50 + Math.sin(angle) * radius };
}
function TreeView() {
  const [level, setLevel] = useState(2);
  const [character, setCharacter] = useState('Aventureiro');
  const [tree, setTree] = useState<GeneratedTree>(() =>
    generateTree(defaultPool(), 'Aventureiro', 2),
  );
  const [selected, setSelected] = useState<string | null>('centro');
  const [creator, setCreator] = useState(false);
  const [template, setTemplate] = useState('universal');
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<'passiva' | 'magia' | 'ativa'>('passiva');
  useEffect(() => {
    setTree(generateTree(defaultPool(), character, level));
    setSelected('centro');
  }, [character, level]);
  const selectedNode = tree.nodes.find((n) => n.id === selected);
  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const id = `custom-${Date.now()}`;
    const node: SkillNode = {
      id,
      name,
      type: customType,
      cost: 1,
      description: 'Criado pela sua mesa. Edite este efeito depois.',
      weight: 1,
      minLevel: 1,
    };
    setTree({
      ...tree,
      nodes: [...tree.nodes, node],
      edges: [...tree.edges, { from: 'centro', to: id }],
    });
    setCustomName('');
  };
  const buy = () => {
    if (!selected) return;
    try {
      setTree(buyNode(tree, selected, `${character}:${selected}`));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não foi possível comprar.');
    }
  };
  return (
    <div className="tree-layout">
      <Card className="tree-panel">
        <div className="tree-toolbar">
          <div>
            <div className="eyebrow">ÁRVORE / PASSO A PASSO</div>
            <h2>Comece no centro. Expanda sua história.</h2>
          </div>
          <div className="controls">
            <input
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
              aria-label="Personagem"
            />
            <label>
              Nível{' '}
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <p className="muted">
          O centro é sempre o primeiro nó. Cada compra ilumina caminhos novos em todas as direções.
          Seed <code>{tree.seed}</code>
        </p>
        <div className="tree-canvas radial">
          {tree.edges.map((e) => {
            const a = radialPosition(tree, e.from),
              b = radialPosition(tree, e.to);
            const bought = tree.bought.includes(e.from) && tree.bought.includes(e.to);
            return (
              <div
                className={`edge ${bought ? 'lit' : ''}`}
                key={`${e.from}-${e.to}`}
                style={{
                  left: `${a.left}%`,
                  top: `${a.top}%`,
                  width: `${Math.hypot(b.left - a.left, b.top - a.top) * 1.55}%`,
                  transform: `rotate(${(Math.atan2(b.top - a.top, b.left - a.left) * 180) / Math.PI}deg)`,
                }}
              />
            );
          })}
          {tree.nodes.map((n) => {
            const p = radialPosition(tree, n.id);
            return (
              <button
                key={n.id}
                onClick={() => setSelected(n.id)}
                className={`skill-node ${n.type} ${tree.bought.includes(n.id) ? 'bought' : ''} ${selected === n.id ? 'selected' : ''}`}
                style={{ left: `${p.left}%`, top: `${p.top}%` }}
              >
                <span className="shape">
                  {n.type === 'passiva' ? '○' : n.type === 'magia' ? '◇' : '⬡'}
                </span>
                <strong>{n.name}</strong>
                <small>{n.type}</small>
                <em>{n.cost} frag.</em>
              </button>
            );
          })}
          <div className="radial-hint">
            {tree.bought.length
              ? 'A teia cresceu a partir das suas escolhas.'
              : 'Compre Despertar para abrir os primeiros caminhos.'}
          </div>
        </div>
        <button className="creator-open" onClick={() => setCreator((v) => !v)}>
          {creator ? 'Fechar criador' : 'Criar uma árvore universal'} <span>＋</span>
        </button>
        {creator && (
          <div className="tree-creator">
            <span className="eyebrow">CRIADOR GUIADO</span>
            <h3>Qual é o coração da sua árvore?</h3>
            <div className="creator-options">
              {[
                ['universal', 'Universal', 'Nós fáceis de adaptar a qualquer mesa.'],
                ['combat', 'Combate', 'Progressão clara de dano, defesa e reação.'],
                ['story', 'História', 'Nós que desbloqueiam vínculos, aspectos e consequências.'],
              ].map(([id, name, desc]) => (
                <button
                  className={template === id ? 'chosen' : ''}
                  onClick={() => setTemplate(id)}
                  key={id}
                >
                  <b>{name}</b>
                  <span>{desc}</span>
                </button>
              ))}
            </div>
            <div className="custom-node-line">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nome da sua própria skill"
              />
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value as 'passiva' | 'magia' | 'ativa')}
              >
                <option value="passiva">Passiva</option>
                <option value="magia">Magia</option>
                <option value="ativa">Ativa</option>
              </select>
              <button onClick={addCustom}>Adicionar</button>
            </div>
            <div className="callout">
              A árvore começa com um centro e três direções. Você pode editar nomes, adicionar
              skills e efeitos próprios.
            </div>
          </div>
        )}
      </Card>
      <Card className="node-detail">
        {selectedNode ? (
          <>
            <div className="node-tag">
              {selectedNode.type} ·{' '}
              {tree.bought.includes(selectedNode.id)
                ? 'desbloqueado'
                : canBuy(tree, selectedNode.id)
                  ? 'disponível'
                  : 'bloqueado'}
            </div>
            <h2>{selectedNode.name}</h2>
            <p>{selectedNode.description}</p>
            <div className="cost">
              {selectedNode.cost} <span>Fragmentos</span>
            </div>
            <button
              className="buy"
              disabled={tree.bought.includes(selectedNode.id) || !canBuy(tree, selectedNode.id)}
              onClick={buy}
            >
              {tree.bought.includes(selectedNode.id)
                ? 'Desbloqueado'
                : canBuy(tree, selectedNode.id)
                  ? 'Comprar nó'
                  : 'Bloqueado — compre o pré-requisito'}
            </button>
            <div className="mini-note">{effects(tree).length} efeitos desbloqueados</div>
          </>
        ) : (
          <div className="empty">
            <div className="empty-mark">⌘</div>
            <h3>Selecione um nó</h3>
            <p>
              O centro é o começo. Os caminhos abrem conforme você compra e a árvore nunca exige uma
              direção única.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
function Layout() {
  const [tab, setTab] = useState(location.pathname.startsWith('/campaign/') ? 'campanha' : 'dados');
  const items = [
    ['dados', 'Dado Aberto', '◈'],
    ['ficha', 'Criar ficha', '▣'],
    ['arvore', 'Criar árvore', '⌘'],
    ['campanha', 'Campanha', '✦'],
  ];
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span className="brand-mark">✦</span>
          <div>
            <b>INFERUS UNIVERSAL</b>
            <small>mesa de campanha</small>
          </div>
        </div>
        <nav>
          {items.map(([id, label, icon]) => (
            <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="online">
            <i /> núcleo online
          </div>
          <small>v1.4 · modo campanha</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">PAINEL DE CAMPANHA</span>
            <h1>{items.find((i) => i[0] === tab)?.[1]}</h1>
          </div>
          <div className="header-actions">
            <AuthPanel />
            <div className="avatar">IU</div>
          </div>
        </header>
        {tab === 'dados' && <Dice />}
        {tab === 'ficha' && <SheetView />}
        {tab === 'arvore' && <TreeView />}
        {tab === 'campanha' && <CampaignView />}
        <footer>
          Inferus Universal é uma ferramenta própria de mesa. Presets são sínteses originais, não
          oficiais.{' '}
          <a
            href="https://www.paradoxinteractive.com/games/world-of-darkness/community/free-content"
            target="_blank"
            rel="noreferrer"
          >
            Fontes
          </a>
        </footer>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AccountProvider>
      <Layout />
    </AccountProvider>
  );
}
