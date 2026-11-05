export const tabPaths = { ficha: '/ficha', arvore: '/arvore', discord: '/discord' } as const;
export type Tab = keyof typeof tabPaths;
export function tabFromPath(path: string): Tab {
  return (Object.keys(tabPaths) as Tab[]).find((tab) => tabPaths[tab] === path) ?? 'ficha';
}
