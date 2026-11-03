import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { D1Database, D1Statement, D1Result } from '../../edge/types.js';
export function sqliteD1(path = ':memory:'): D1Database & { close: () => void } {
  const db = new DatabaseSync(path);
  db.exec(readFileSync(resolve('drizzle/0000_edge.sql'), 'utf8'));
  function prepare(sql: string): D1Statement {
    let values: unknown[] = [];
    return {
      bind(...args: unknown[]) {
        values = args;
        return this;
      },
      async first<T>() {
        return (db.prepare(sql).get(...(values as any[])) as T) ?? null;
      },
      async all<T>() {
        return {
          results: db.prepare(sql).all(...(values as any[])) as T[],
          meta: { changes: 0 },
          success: true,
        };
      },
      async run() {
        const result = db.prepare(sql).run(...(values as any[]));
        return { results: [], meta: { changes: Number(result.changes) }, success: true };
      },
    };
  }
  return {
    prepare,
    async batch(statements: D1Statement[]) {
      db.exec('BEGIN');
      try {
        const results: D1Result[] = [];
        for (const s of statements) results.push(await s.run());
        db.exec('COMMIT');
        return results;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}
