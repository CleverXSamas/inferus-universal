import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthPanel, AccountProvider } from './AuthPanel';
import { DiscordView } from './DiscordView';
import { SheetView } from './SheetView';
import { tabPaths, tabFromPath, type Tab } from './navigation';

const TreeView = lazy(() => import('./TreeView').then((module) => ({ default: module.TreeView })));

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

function Layout() {
  const [tab, setTab] = useState<Tab>(() => tabFromPath(location.pathname));
  useEffect(() => {
    const restore = () => {
      const next = tabFromPath(location.pathname);
      if (location.pathname !== tabPaths[next]) history.replaceState({}, '', tabPaths[next]);
      setTab(next);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const navigate = (next: Tab) => {
    if (next === tab) return;
    history.pushState({}, '', tabPaths[next]);
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const descriptions: Record<string, string> = {
    ficha: 'Personagens únicos. Um espaço para cada detalhe.',
    arvore: 'Escolhas que transformam o seu personagem.',
    discord: 'Sua mesa, conectada onde a conversa acontece.',
  };
  const items = [
    ['ficha', 'Criar ficha', '▣'],
    ['arvore', 'Criar árvore', '⌘'],
    ['discord', 'Discord', '◉'],
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
              onClick={() => navigate(id as Tab)}
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
