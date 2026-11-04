import { lazy, Suspense, useState } from 'react';
import { roll, PRESETS, RollRecord } from '../packages/dice-core';
import { CampaignView } from './CampaignView';
import { AuthPanel, AccountProvider, useAccount } from './AuthPanel';
import { DiscordView } from './DiscordView';
import { SheetView } from './SheetView';
import { SimpleRollResult } from './SimpleRollResult';
import { playDiceSound, useDiceSound } from './dice-feedback';

const TreeView = lazy(() => import('./TreeView').then((module) => ({ default: module.TreeView })));

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
function Dice() {
  const [expression, setExpression] = useState('2d20kh1 + 5');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<RollRecord | null>(null);
  const [error, setError] = useState('');
  const [soundOn, toggleSound] = useDiceSound();
  const [freshRoll, setFreshRoll] = useState<string | null>(null);
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
      setFreshRoll(r.roll_id);
      setHistory((h) => [r, ...h].slice(0, 50));
      playDiceSound(soundOn, r.passed !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível rolar.');
      playDiceSound(soundOn, false);
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
            onClick={toggleSound}
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
        <SimpleRollResult
          result={result}
          animate={result?.roll_id === freshRoll}
          empty={
            <div className="empty">
              <div className="result-emblem">
                <NavIcon name="dados" />
                <span>?</span>
              </div>
              <h3>Uma jogada. Mil possibilidades.</h3>
              <p>Seu resultado aparece aqui, com cada dado e modificador à vista.</p>
            </div>
          }
        />
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
          <button
            className="history-item"
            key={r.roll_id}
            onClick={() => {
              setFreshRoll(null);
              setResult(r);
            }}
          >
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
        {tab === 'arvore' && (
          <Suspense
            fallback={
              <div className="card" aria-live="polite">
                Abrindo o mapa de skills…
              </div>
            }
          >
            <TreeView />
          </Suspense>
        )}
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
