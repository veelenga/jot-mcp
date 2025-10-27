/**
 * Database initialization and schema management
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export function initializeDatabase(dbPath: string): Database.Database {
  // Ensure directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create schema
  createSchema(db);

  return db;
}

function createSchema(db: Database.Database): void {
  // Contexts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contexts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      repository TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Jots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS jots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      context_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
    )
  `);

  // Tags table (many-to-many with jots)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jot_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (jot_id) REFERENCES jots(id) ON DELETE CASCADE,
      UNIQUE(jot_id, tag)
    )
  `);

  // Metadata table (key-value pairs for jots)
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jot_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      FOREIGN KEY (jot_id) REFERENCES jots(id) ON DELETE CASCADE,
      UNIQUE(jot_id, key)
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contexts_updated_at ON contexts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_jots_context_id ON jots(context_id);
    CREATE INDEX IF NOT EXISTS idx_jots_created_at ON jots(created_at);
    CREATE INDEX IF NOT EXISTS idx_jots_expires_at ON jots(expires_at);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
  `);

  // Create full-text search virtual table
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS jots_fts USING fts5(
      jot_id UNINDEXED,
      message,
      content=jots,
      content_rowid=rowid
    )
  `);

  // Triggers to keep FTS table in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS jots_ai AFTER INSERT ON jots BEGIN
      INSERT INTO jots_fts(rowid, jot_id, message)
      VALUES (new.rowid, new.id, new.message);
    END;

    CREATE TRIGGER IF NOT EXISTS jots_ad AFTER DELETE ON jots BEGIN
      INSERT INTO jots_fts(jots_fts, rowid, jot_id, message)
      VALUES('delete', old.rowid, old.id, old.message);
    END;

    CREATE TRIGGER IF NOT EXISTS jots_au AFTER UPDATE ON jots BEGIN
      INSERT INTO jots_fts(jots_fts, rowid, jot_id, message)
      VALUES('delete', old.rowid, old.id, old.message);
      INSERT INTO jots_fts(rowid, jot_id, message)
      VALUES (new.rowid, new.id, new.message);
    END;
  `);
}
