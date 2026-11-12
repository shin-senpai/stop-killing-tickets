import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from '../config.js';
import * as schema from './schema.js';

mkdirSync(dirname(config.databasePath), { recursive: true, mode: 0o700 });

const sqlite = new Database(config.databasePath);
// The database holds webhook tokens. SQLite gives the -wal and -shm files the same
// mode as the main file, so this must run before WAL mode is turned on.
if (!sqlite.memory) chmodSync(config.databasePath, 0o600);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;

/** Resolves to the repo-level `drizzle/` folder from both `src/db` and `dist/db`. */
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export function runMigrations(): void {
  migrate(db, { migrationsFolder });
}

export function closeDatabase(): void {
  sqlite.close();
}
