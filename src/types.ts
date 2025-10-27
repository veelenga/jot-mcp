/**
 * Core domain types for Jot MCP
 */

export interface JotEntry {
  id: string;
  contextId: string;
  message: string;
  createdAt: number; // Unix timestamp
  expiresAt: number | null; // Unix timestamp, null for permanent jots
  tags: string[];
  metadata: Record<string, string>;
}

export interface Context {
  id: string;
  name: string;
  repository: string | null;
  branch: string | null;
  createdAt: number;
  lastModifiedAt: number;
  jotCount: number;
}

export interface SearchOptions {
  contextId?: string;
  query?: string;
  tags?: string[];
  fromDate?: number;
  toDate?: number;
  includeExpired?: boolean;
  limit?: number;
}

export interface CreateJotOptions {
  message: string;
  contextId?: string;
  contextName?: string;
  ttlDays?: number; // null or 0 means permanent
  tags?: string[];
  metadata?: Record<string, string>;
}
