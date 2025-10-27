/**
 * Core domain types for Jot MCP
 */

export interface JotEntry {
  id: number;
  contextId: number;
  message: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp (not exposed via MCP yet)
  expiresAt: number | null; // Unix timestamp, null for permanent jots
  tags: string[];
  metadata: Record<string, string>;
}

export interface Context {
  id: number;
  name: string;
  repository: string | null;
  createdAt: number;
  updatedAt: number;
  jotCount: number;
}

export interface SearchOptions {
  contextId?: number;
  query?: string;
  tags?: string[];
  fromDate?: number;
  toDate?: number;
  includeExpired?: boolean;
  limit?: number;
}

export interface CreateJotOptions {
  message: string;
  contextId?: number;
  contextName?: string;
  ttlDays?: number; // null or 0 means permanent
  tags?: string[];
  metadata?: Record<string, string>;
}
