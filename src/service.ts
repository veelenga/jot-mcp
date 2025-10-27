/**
 * Service layer containing business logic
 * Orchestrates between repository and MCP handlers
 */

import { JotRepository } from './repository.js';
import { Context, CreateJotOptions, JotEntry, SearchOptions } from './types.js';
import { DEFAULT_TTL_DAYS } from './config.js';
import { execSync } from 'child_process';

export class JotService {
  constructor(private repository: JotRepository) {}

  /**
   * Detect the current context name without creating it
   */
  detectCurrentContext(): string {
    return this.detectContextName();
  }

  /**
   * Create a new jot with intelligent context detection
   */
  createJot(options: CreateJotOptions): JotEntry {
    // Determine context
    let context: Context;
    if (options.contextId) {
      const existing = this.repository.getContext(options.contextId);
      if (!existing) {
        throw new Error(`Context with ID ${options.contextId} not found`);
      }
      context = existing;
    } else if (options.contextName) {
      context = this.repository.upsertContext(options.contextName);
    } else {
      // Auto-detect context from git
      const detectedName = this.detectContextName();
      context = this.repository.upsertContext(detectedName);
    }

    // Calculate expiration
    const expiresAt = this.calculateExpiration(options.ttlDays);

    // Create jot
    return this.repository.createJot(
      context.id,
      options.message,
      expiresAt,
      options.tags || [],
      options.metadata || {}
    );
  }

  /**
   * List all contexts
   */
  listContexts(): Context[] {
    return this.repository.listContexts();
  }

  /**
   * Get a specific context
   */
  getContext(idOrName: number | string): Context | null {
    // If it's a number, get by ID
    if (typeof idOrName === 'number') {
      return this.repository.getContext(idOrName);
    }

    // Otherwise get by name
    return this.repository.getContextByName(idOrName);
  }

  /**
   * Delete a context and all its jots
   */
  deleteContext(idOrName: number | string): boolean {
    const context = this.getContext(idOrName);
    if (!context) return false;
    return this.repository.deleteContext(context.id);
  }

  /**
   * Search jots
   */
  searchJots(options: SearchOptions): JotEntry[] {
    return this.repository.searchJots(options);
  }

  /**
   * Get jots for a specific context
   */
  getContextJots(contextIdOrName: string, limit?: number): JotEntry[] {
    const context = this.getContext(contextIdOrName);
    if (!context) {
      throw new Error(`Context '${contextIdOrName}' not found`);
    }

    return this.repository.searchJots({
      contextId: context.id,
      limit,
      includeExpired: false,
    });
  }

  /**
   * Update a specific jot
   */
  updateJot(
    id: number,
    updates: {
      message?: string;
      ttlDays?: number | null;
      tags?: string[];
      metadata?: Record<string, string>;
    }
  ): JotEntry | null {
    // Convert ttlDays to expiresAt if provided
    const repoUpdates: {
      message?: string;
      expiresAt?: number | null;
      tags?: string[];
      metadata?: Record<string, string>;
    } = {};

    if (updates.message !== undefined) {
      repoUpdates.message = updates.message;
    }
    if (updates.ttlDays !== undefined) {
      repoUpdates.expiresAt = this.calculateExpiration(updates.ttlDays);
    }
    if (updates.tags !== undefined) {
      repoUpdates.tags = updates.tags;
    }
    if (updates.metadata !== undefined) {
      repoUpdates.metadata = updates.metadata;
    }

    return this.repository.updateJot(id, repoUpdates);
  }

  /**
   * Delete a specific jot
   */
  deleteJot(id: number): boolean {
    return this.repository.deleteJot(id);
  }

  /**
   * Clean up expired jots
   */
  cleanupExpired(): number {
    return this.repository.deleteExpiredJots();
  }

  /**
   * Get jots expiring soon
   */
  getExpiringSoon(days: number = 3): JotEntry[] {
    return this.repository.getExpiringSoon(days);
  }

  /**
   * Detect context name from git repository or working directory
   */
  private detectContextName(): string {
    try {
      // Try to get repo name from git
      const repoUrl = execSync('git config --get remote.origin.url', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      const repoName = repoUrl
        .split('/')
        .pop()
        ?.replace('.git', '') || 'unknown';

      // Get branch name
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      // Combine for context name
      if (branch === 'main' || branch === 'master') {
        return repoName;
      }
      return `${repoName}/${branch}`;
    } catch {
      // Not in a git repo, try to use directory name
      try {
        const cwd = process.cwd();
        const dirName = cwd.split('/').pop() || cwd.split('\\').pop();
        if (dirName && dirName !== '/' && dirName !== '\\') {
          return dirName;
        }
      } catch {
        // Fallback to default
      }
      return 'general';
    }
  }

  /**
   * Calculate expiration timestamp
   */
  private calculateExpiration(ttlDays?: number | null): number | null {
    if (ttlDays === null || ttlDays === undefined) {
      // Use default TTL
      const days = DEFAULT_TTL_DAYS;
      return Date.now() + days * 24 * 60 * 60 * 1000;
    }

    if (ttlDays === 0) {
      // Permanent jot
      return null;
    }

    // Custom TTL
    return Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  }
}
