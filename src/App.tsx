import { useEffect, useState } from 'react';
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
import { AuthPanel, AccountProvider, useAccount } from './AuthPanel';
import { DiscordView } from './DiscordView';
import { SheetView } from './SheetView';

function ArrowUpRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 18 18 6 M6 6h12v12" />
    </svg>
  );
}
function CompassRose() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="32" cy="32" r="22" strokeWidth=".7" />
      <path d="m32 2 4 26 26 4-26 4-4 26-4-26-26-4 26-4Z" strokeWidth=".7" />
      <path d="m10 10 22 18 22-18-18 22 18 22-22-18-22 18 18-22Z" strokeWidth=".5" />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  );
}
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dados: (
      <>
        <path d="m12 2 9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5 M12 12v10 M12 2v10" />
        <path d="m3 17 9-5 9 5" />
      </>
    ),
    ficha: (
      <>
        <path d="M6 3h9l4 4v14H5V3Z M14 3v5h5 M9 12h6 M9 16h6" />
      </>
    ),
    arvore: (
      <>
        <path d="M12 10V5 M12 14v5 M10 12H5 M14 12h5" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="3" r="2" />
        <circle cx="12" cy="21" r="2" />
        <circle cx="3" cy="12" r="2" />
        <circle cx="21" cy="12" r="2" />
      </>
    ),
    campanha: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3 M16 5a3 3 0 0 1 0 6 M18 15a5 5 0 0 1 3 5" />
      </>
    ),
    discord: (
      <>
        <path d="M8 5 5 6l-3 12 5 2 1-2 M16 5l3 1 3 12-5 2-1-2 M7 17c3 2 7 2 10 0 M8 6h8" />
        <circle cx="8" cy="12" r="1" />
        <circle cx="16" cy="12" r="1" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

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
      <Card className="roller-card">
        <div className="eyebrow">
          <span className="tiny-star">✦</span> SUA PRÓXIMA JOGADA
        </div>
        <div className="hero-line">
          <div>
            <h2>Deixe os dados contarem.</h2>
            <p className="muted">
              Da primeira iniciativa ao último teste de sorte. Role do seu jeito, veja cada dado.
            </p>
          </div>
          <button
            aria-pressed={soundOn}
            className={`sound-toggle ${soundOn ? 'on' : ''}`}
            onClick={() => setSoundOn((v) => !v)}
          >
            {soundOn ? 'Som ligado' : 'Som desligado'} <span>◖</span>
          </button>
        </div>
        <label className="input-caption" htmlFor="dice-expression">
          Expressão de dados
        </label>
        <form
          className="rollline"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <input
            id="dice-expression"
            value={expression}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setExpression(e.target.value)}
            aria-label="Expressão de dados"
          />
          <button type="submit">
            Rolar <ArrowUpRight />
          </button>
        </form>
        <div className="quick-dice" aria-label="Dados rápidos">
          <span>Escolher dado</span>
          {[4, 6, 8, 10, 12, 20].map((faces) => (
            <button
              key={faces}
              title={`Usar 1d${faces}`}
              onClick={() => setExpression(`1d${faces}`)}
            >
              <span aria-hidden="true">◇</span>d{faces}
            </button>
          ))}
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
        <div className="preset-label">
          ROLAGENS PRONTAS <span>um clique para rolar</span>
        </div>
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
        <div className="result-caption">
          <span className="eyebrow">A SORTE ESTÁ LANÇADA</span>
          <span aria-hidden="true">✧</span>
        </div>
        <div aria-live="polite" aria-atomic="true">
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
              <div className="result-emblem">
                <NavIcon name="dados" />
                <span>?</span>
              </div>
              <h3>Uma jogada. Mil possibilidades.</h3>
              <p>Seu resultado aparece aqui, com cada dado e modificador à vista.</p>
            </div>
          )}
        </div>
      </Card>
      <Card className="history">
        <div className="section-title">
          <div>
            <span className="eyebrow">O RASTRO DA AVENTURA</span>
            <h3>Últimas rolagens</h3>
          </div>
          <span className="history-count">
            {history.length} / 50 <span>neste navegador</span>
          </span>
        </div>
        {history.length === 0 && (
          <div className="history-empty">
            <NavIcon name="dados" />
            <p>
              Cada jogada tem uma história.<span>Faça sua primeira rolagem para começar.</span>
            </p>
            <span className="history-empty-line" />
          </div>
        )}
        {history.slice(0, 6).map((r) => (
          <button className="history-item" key={r.roll_id} onClick={() => setResult(r)}>
            <span className="history-die" aria-hidden="true">
              ◇
            </span>
            <span>{r.expression}</span>
            <time dateTime={r.created_at}>
              {new Date(r.created_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
            <b>{r.total}</b>
            <span className="history-arrow">
              <ArrowUpRight />
            </span>
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
  const angle =
    (index / Math.max(roots.length, 1)) * Math.PI * 2 - Math.PI / 2 + (d > 1 ? Math.PI / 3 : 0);
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
          <div className="tree-world">
            <svg
              className="tree-edges"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {tree.edges.map((e) => {
                const a = radialPosition(tree, e.from),
                  b = radialPosition(tree, e.to);
                const bought = tree.bought.includes(e.from) && tree.bought.includes(e.to);
                return (
                  <line
                    className={bought ? 'lit' : ''}
                    key={`${e.from}-${e.to}`}
                    x1={a.left}
                    y1={a.top}
                    x2={b.left}
                    y2={b.top}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
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
          </div>
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
  const [tab, setTab] = useState(
    location.pathname.startsWith('/campaign/')
      ? 'campanha'
      : location.pathname === '/discord'
        ? 'discord'
        : 'dados',
  );
  const account = useAccount();
  const descriptions: Record<string, string> = {
    dados: 'Toda grande história começa com uma possibilidade.',
    ficha: 'Personagens únicos. Um espaço para cada detalhe.',
    arvore: 'Escolhas que transformam o seu personagem.',
    campanha: 'Reúna os jogadores. O próximo capítulo é de vocês.',
    discord: 'Sua mesa, conectada onde a conversa acontece.',
  };
  const items = [
    ['dados', 'Dado Aberto', '◈'],
    ['ficha', 'Criar ficha', '▣'],
    ['arvore', 'Criar árvore', '⌘'],
    ['campanha', 'Campanha', '✦'],
    ...(account.provider === 'chatgpt' ? [['discord', 'Discord', '◉']] : []),
  ];
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span className="brand-mark">
            <NavIcon name="dados" />
          </span>
          <div>
            <b>INFERUS</b>
            <small>U N I V E R S A L</small>
          </div>
        </div>
        <div className="workspace-label">SEU ESPAÇO DE AVENTURA</div>
        <nav aria-label="Ferramentas da mesa">
          {items.map(([id, label]) => (
            <button
              aria-current={tab === id ? 'page' : undefined}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
              key={id}
            >
              <NavIcon name={id} />
              {label}
              <span className="nav-dot" aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-note">
            <span aria-hidden="true">✧</span>
            <p>
              Infinitos mundos.
              <br />
              <b>A sua história.</b>
            </p>
          </div>
          <div className="online">
            <i /> FEITO PARA A SUA MESA
          </div>
        </div>
      </aside>
      <main>
        <header className="app-header">
          <div className="breadcrumb">
            Seu espaço <span>/</span> <b>{items.find((i) => i[0] === tab)?.[1]}</b>
          </div>
          <div className="header-actions">
            <AuthPanel />
          </div>
        </header>
        <div className="page-heading">
          <div>
            <span className="eyebrow">SUA MESA. SUAS REGRAS.</span>
            <h1>{items.find((i) => i[0] === tab)?.[1]}</h1>
            <p>{descriptions[tab]}</p>
          </div>
          <span className="page-ornament">
            <CompassRose />
          </span>
        </div>
        {tab === 'dados' && <Dice />}
        {tab === 'ficha' && <SheetView />}
        {tab === 'arvore' && <TreeView />}
        {tab === 'campanha' && <CampaignView />}
        {tab === 'discord' && <DiscordView />}
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
