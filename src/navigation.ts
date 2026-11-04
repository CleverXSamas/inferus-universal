export const tabPaths = {
  dados: '/',
  ficha: '/ficha',
  arvore: '/arvore',
  campanha: '/campanhas',
  discord: '/discord',
} as const;
export type Tab = keyof typeof tabPaths;
export function tabFromPath(path: string): Tab {
  if (path === '/campanhas' || path.startsWith('/campaign/')) return 'campanha';
  return (Object.keys(tabPaths) as Tab[]).find((tab) => tabPaths[tab] === path) ?? 'dados';
}
