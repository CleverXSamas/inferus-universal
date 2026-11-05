export type D1Result<T = Record<string, unknown>> = {
  results: T[];
  meta: { changes: number };
  success: boolean;
};
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}
export type Env = { DB: D1Database; DISCORD_PUBLIC_KEY?: string; DISCORD_CLIENT_ID?: string };
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
export const token = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
};
export const id = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
export async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
}
export const clean = (value: unknown, max: number) =>
  typeof value === 'string'
    ? value
        .trim()
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .slice(0, max)
    : '';
