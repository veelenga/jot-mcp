/**
 * Repository layer for database operations
 * Provides clean abstraction over SQLite queries
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { Context, JotEntry, SearchOptions } from './types.js';

export class JotRepository {
  constructor(private db: Database.Database) {}

  /**
   * Create or get a context by name
   */
  upsertContext(name: string, repository?: string, branch?: string): Context {
    const existing = this.getContextByName(name);
    if (existing) {
      return existing;
    }

    const id = randomUUID();
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO contexts (id, name, repository, branch, created_at, last_modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, name, repository || null, branch || null, now, now);

    return this.getContext(id)!;
  }

  /**
   * Get context by ID
   */
  getContext(id: string): Context | null {
    const row = this.db
      .prepare(
        `SELECT c.*, COUNT(j.id) as jot_count
         FROM contexts c
         LEFT JOIN jots j ON j.context_id = c.id
         WHERE c.id = ?
         GROUP BY c.id`
      )
      .get(id) as any;

    return row ? this.mapContext(row) : null;
  }

  /**
   * Get context by name
   */
  getContextByName(name: string): Context | null {
    const row = this.db
      .prepare(
        `SELECT c.*, COUNT(j.id) as jot_count
         FROM contexts c
         LEFT JOIN jots j ON j.context_id = c.id
         WHERE c.name = ?
         GROUP BY c.id`
      )
      .get(name) as any;

    return row ? this.mapContext(row) : null;
  }

  /**
   * List all contexts
   */
  listContexts(): Context[] {
    const rows = this.db
      .prepare(
        `SELECT c.*, COUNT(j.id) as jot_count
         FROM contexts c
         LEFT JOIN jots j ON j.context_id = c.id
         GROUP BY c.id
         ORDER BY c.last_modified_at DESC`
      )
      .all() as any[];

    return rows.map((row) => this.mapContext(row));
  }

  /**
   * Delete a context and all its jots
   */
  deleteContext(id: string): boolean {
    const result = this.db.prepare('DELETE FROM contexts WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Create a jot entry
   */
  createJot(
    contextId: string,
    message: string,
    expiresAt: number | null,
    tags: string[],
    metadata: Record<string, string>
  ): JotEntry {
    const id = randomUUID();
    const now = Date.now();

    // Insert jot
    this.db
      .prepare(
        `INSERT INTO jots (id, context_id, message, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, contextId, message, now, expiresAt);

    // Insert tags
    const insertTag = this.db.prepare('INSERT INTO tags (jot_id, tag) VALUES (?, ?)');
    for (const tag of tags) {
      insertTag.run(id, tag);
    }

    // Insert metadata
    const insertMeta = this.db.prepare('INSERT INTO metadata (jot_id, key, value) VALUES (?, ?, ?)');
    for (const [key, value] of Object.entries(metadata)) {
      insertMeta.run(id, key, value);
    }

    // Update context's last modified time
    this.db
      .prepare('UPDATE contexts SET last_modified_at = ? WHERE id = ?')
      .run(now, contextId);

    return this.getJot(id)!;
  }

  /**
   * Get a jot by ID
   */
  getJot(id: string): JotEntry | null {
    const row = this.db
      .prepare(
        `SELECT id, context_id, message, created_at, expires_at
         FROM jots
         WHERE id = ?`
      )
      .get(id) as any;

    if (!row) return null;

    return this.mapJot(row);
  }

  /**
   * Search jots with various filters
   */
  searchJots(options: SearchOptions = {}): JotEntry[] {
    let query = `SELECT DISTINCT j.id, j.context_id, j.message, j.created_at, j.expires_at FROM jots j`;
    const conditions: string[] = [];
    const params: any[] = [];

    // Context filter
    if (options.contextId) {
      conditions.push('j.context_id = ?');
      params.push(options.contextId);
    }

    // Full-text search
    if (options.query) {
      query = `SELECT DISTINCT j.id, j.context_id, j.message, j.created_at, j.expires_at
               FROM jots j
               JOIN jots_fts fts ON j.id = fts.jot_id`;
      conditions.push('jots_fts MATCH ?');
      params.push(options.query);
    }

    // Tags filter
    if (options.tags && options.tags.length > 0) {
      query += ` JOIN tags t ON j.id = t.jot_id`;
      conditions.push(`t.tag IN (${options.tags.map(() => '?').join(', ')})`);
      params.push(...options.tags);
    }

    // Date range
    if (options.fromDate) {
      conditions.push('j.created_at >= ?');
      params.push(options.fromDate);
    }
    if (options.toDate) {
      conditions.push('j.created_at <= ?');
      params.push(options.toDate);
    }

    // Expiration filter
    if (!options.includeExpired) {
      conditions.push('(j.expires_at IS NULL OR j.expires_at > ?)');
      params.push(Date.now());
    }

    // Build WHERE clause
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Order and limit
    query += ' ORDER BY j.created_at DESC';
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((row) => this.mapJot(row));
  }

  /**
   * Delete a jot
   */
  deleteJot(id: string): boolean {
    const result = this.db.prepare('DELETE FROM jots WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Delete expired jots
   */
  deleteExpiredJots(): number {
    const now = Date.now();
    const result = this.db
      .prepare('DELETE FROM jots WHERE expires_at IS NOT NULL AND expires_at <= ?')
      .run(now);
    return result.changes;
  }

  /**
   * Get jots that will expire soon (within days)
   */
  getExpiringSoon(days: number): JotEntry[] {
    const now = Date.now();
    const threshold = now + days * 24 * 60 * 60 * 1000;

    const rows = this.db
      .prepare(
        `SELECT id, context_id, message, created_at, expires_at
         FROM jots
         WHERE expires_at IS NOT NULL
           AND expires_at > ?
           AND expires_at <= ?
         ORDER BY expires_at ASC`
      )
      .all(now, threshold) as any[];

    return rows.map((row) => this.mapJot(row));
  }

  // Helper methods

  private mapContext(row: any): Context {
    return {
      id: row.id,
      name: row.name,
      repository: row.repository,
      branch: row.branch,
      createdAt: row.created_at,
      lastModifiedAt: row.last_modified_at,
      jotCount: row.jot_count || 0,
    };
  }

  private mapJot(row: any): JotEntry {
    // Get tags
    const tags = this.db
      .prepare('SELECT tag FROM tags WHERE jot_id = ?')
      .all(row.id)
      .map((t: any) => t.tag);

    // Get metadata
    const metaRows = this.db
      .prepare('SELECT key, value FROM metadata WHERE jot_id = ?')
      .all(row.id) as any[];
    const metadata: Record<string, string> = {};
    for (const meta of metaRows) {
      metadata[meta.key] = meta.value;
    }

    return {
      id: row.id,
      contextId: row.context_id,
      message: row.message,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      tags,
      metadata,
    };
  }
}
