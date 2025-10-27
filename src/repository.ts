/**
 * Repository layer for database operations
 * Provides clean abstraction over SQLite queries
 */

import Database from 'better-sqlite3';
import { Context, JotEntry, SearchOptions } from './types.js';

export class JotRepository {
  constructor(private db: Database.Database) {}

  /**
   * Create or get a context by name
   */
  upsertContext(name: string, repository?: string): Context {
    const existing = this.getContextByName(name);
    if (existing) {
      return existing;
    }

    const now = Date.now();

    const result = this.db
      .prepare(
        `INSERT INTO contexts (name, repository, created_at, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(name, repository || null, now, now);

    return this.getContext(result.lastInsertRowid as number)!;
  }

  /**
   * Get context by ID
   */
  getContext(id: number): Context | null {
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
         ORDER BY c.updated_at DESC`
      )
      .all() as any[];

    return rows.map((row) => this.mapContext(row));
  }

  /**
   * Delete a context and all its jots
   */
  deleteContext(id: number): boolean {
    const result = this.db.prepare('DELETE FROM contexts WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Create a jot entry
   */
  createJot(
    contextId: number,
    message: string,
    expiresAt: number | null,
    tags: string[],
    metadata: Record<string, string>
  ): JotEntry {
    const now = Date.now();

    // Insert jot
    const result = this.db
      .prepare(
        `INSERT INTO jots (context_id, message, created_at, updated_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(contextId, message, now, now, expiresAt);

    const id = result.lastInsertRowid as number;

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

    // Update context's updated time
    this.db
      .prepare('UPDATE contexts SET updated_at = ? WHERE id = ?')
      .run(now, contextId);

    return this.getJot(id)!;
  }

  /**
   * Update a jot entry
   */
  updateJot(
    id: number,
    updates: {
      message?: string;
      expiresAt?: number | null;
      tags?: string[];
      metadata?: Record<string, string>;
    }
  ): JotEntry | null {
    const existing = this.getJot(id);
    if (!existing) return null;

    const now = Date.now();

    // Update message and/or expiration
    if (updates.message !== undefined || updates.expiresAt !== undefined) {
      const message = updates.message !== undefined ? updates.message : existing.message;
      const expiresAt = updates.expiresAt !== undefined ? updates.expiresAt : existing.expiresAt;

      this.db
        .prepare('UPDATE jots SET message = ?, expires_at = ?, updated_at = ? WHERE id = ?')
        .run(message, expiresAt, now, id);
    }

    // Update tags if provided
    if (updates.tags !== undefined) {
      // Delete existing tags
      this.db.prepare('DELETE FROM tags WHERE jot_id = ?').run(id);

      // Insert new tags
      const insertTag = this.db.prepare('INSERT INTO tags (jot_id, tag) VALUES (?, ?)');
      for (const tag of updates.tags) {
        insertTag.run(id, tag);
      }
    }

    // Update metadata if provided
    if (updates.metadata !== undefined) {
      // Delete existing metadata
      this.db.prepare('DELETE FROM metadata WHERE jot_id = ?').run(id);

      // Insert new metadata
      const insertMeta = this.db.prepare('INSERT INTO metadata (jot_id, key, value) VALUES (?, ?, ?)');
      for (const [key, value] of Object.entries(updates.metadata)) {
        insertMeta.run(id, key, value);
      }
    }

    // Update context's updated time
    this.db
      .prepare('UPDATE contexts SET updated_at = ? WHERE id = ?')
      .run(now, existing.contextId);

    return this.getJot(id);
  }

  /**
   * Get a jot by ID
   */
  getJot(id: number): JotEntry | null {
    const row = this.db
      .prepare(
        `SELECT id, context_id, message, created_at, updated_at, expires_at
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
    let query = `SELECT DISTINCT j.id, j.context_id, j.message, j.created_at, j.updated_at, j.expires_at FROM jots j`;
    const conditions: string[] = [];
    const params: any[] = [];

    // Context filter
    if (options.contextId) {
      conditions.push('j.context_id = ?');
      params.push(options.contextId);
    }

    // Full-text search
    if (options.query) {
      query = `SELECT DISTINCT j.id, j.context_id, j.message, j.created_at, j.updated_at, j.expires_at
               FROM jots j
               JOIN jots_fts fts ON j.rowid = fts.rowid`;
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
  deleteJot(id: number): boolean {
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
        `SELECT id, context_id, message, created_at, updated_at, expires_at
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      tags,
      metadata,
    };
  }
}
