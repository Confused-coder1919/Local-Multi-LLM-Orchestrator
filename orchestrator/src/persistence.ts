import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { RequestState } from './store';

export interface RunSummary {
  request_id: string;
  created_at: string;
  query: string;
}

let db: Database.Database | null = null;

export function initDb(dbPath: string): void {
  const resolvedPath = path.resolve(dbPath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      request_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      query TEXT NOT NULL,
      state_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
  `);
}

function getDb(): Database.Database | null {
  return db;
}

export function saveRun(state: RequestState): void {
  const database = getDb();
  if (!database) {
    return;
  }

  const stmt = database.prepare(
    `
      INSERT INTO runs (request_id, created_at, query, state_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        created_at = excluded.created_at,
        query = excluded.query,
        state_json = excluded.state_json
    `
  );

  stmt.run(
    state.request_id,
    state.created_at,
    state.query,
    JSON.stringify(state)
  );
}

export function loadRun(request_id: string): RequestState | null {
  const database = getDb();
  if (!database) {
    return null;
  }

  const row = database
    .prepare('SELECT state_json FROM runs WHERE request_id = ?')
    .get(request_id) as { state_json?: string } | undefined;

  if (!row || !row.state_json) {
    return null;
  }

  try {
    return JSON.parse(row.state_json) as RequestState;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to parse stored run ${request_id}: ${message}`);
    return null;
  }
}

export function listRuns(limit = 20): RunSummary[] {
  const database = getDb();
  if (!database) {
    return [];
  }

  const stmt = database.prepare(
    'SELECT request_id, created_at, query FROM runs ORDER BY created_at DESC LIMIT ?'
  );

  return stmt.all(limit) as RunSummary[];
}

export function deleteRun(request_id: string): void {
  const database = getDb();
  if (!database) {
    return;
  }

  database.prepare('DELETE FROM runs WHERE request_id = ?').run(request_id);
}
