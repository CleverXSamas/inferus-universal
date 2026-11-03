// The deployment build replaces this module with the inlined Vite assets.
export const assets: Record<string, { content: string; type: string }> = {
  '/index.html': {
    content: '<!doctype html><title>Inferus Universal</title>',
    type: 'text/html; charset=utf-8',
  },
};
