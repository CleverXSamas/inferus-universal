import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { validateSheet, evaluateSheet, type Sheet } from '../packages/sheet-engine/index.js';
export function createSheetStore(url = process.env.DATABASE_URL) {
  const pool = url ? mysql.createPool(url) : undefined;
  const memory = new Map<string, Map<string, Sheet>>();
  let ready: Promise<unknown> | undefined;
  const init = () =>
    (ready ??=
      pool?.query(
        `CREATE TABLE IF NOT EXISTS inferus_sheets (open_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,id VARCHAR(40) NOT NULL,document JSON NOT NULL,updated_at DATETIME(3) NOT NULL,PRIMARY KEY(open_id,id))`,
      ) ?? Promise.resolve());
  return {
    async list(openId: string): Promise<Sheet[]> {
      if (!pool) return structuredClone([...(memory.get(openId)?.values() ?? [])]);
      await init();
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT document FROM inferus_sheets WHERE open_id=? ORDER BY updated_at DESC',
        [openId],
      );
      return rows.map((r) =>
        typeof r.document === 'string' ? JSON.parse(r.document) : r.document,
      );
    },
    async save(openId: string, sheet: Sheet) {
      validateSheet(sheet);
      evaluateSheet(sheet);
      if (!pool) {
        const entries = memory.get(openId) ?? new Map<string, Sheet>();
        entries.set(sheet.id, structuredClone(sheet));
        memory.set(openId, entries);
      } else {
        await init();
        await pool.query(
          'INSERT INTO inferus_sheets (open_id,id,document,updated_at) VALUES (?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE document=VALUES(document),updated_at=NOW(3)',
          [openId, sheet.id, JSON.stringify(sheet)],
        );
      }
      return sheet;
    },
    async delete(openId: string, id: string) {
      if (!pool) memory.get(openId)?.delete(id);
      else {
        await init();
        await pool.query('DELETE FROM inferus_sheets WHERE open_id=? AND id=?', [openId, id]);
      }
    },
    async close() {
      await pool?.end();
    },
  };
}
