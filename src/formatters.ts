/**
 * Output formatting utilities for consistent, readable display
 */

import { Context, JotEntry } from './types.js';

// Removed SEPARATOR - Claude Code doesn't render it well

/**
 * Format a single jot entry for display
 * Optimized for Claude Code's MCP output rendering
 */
export function formatJotEntry(
  jot: JotEntry,
  index: number,
  showContext: boolean,
  contextName?: string
): string {
  const date = new Date(jot.createdAt).toLocaleDateString();
  const time = new Date(jot.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isPermanent = jot.expiresAt === null;

  // Build single-line metadata
  const metadata: string[] = [];
  if (showContext && contextName) {
    metadata.push(contextName);
  }
  if (jot.tags.length > 0) {
    metadata.push(`Tags: ${jot.tags.join(', ')}`);
  }
  metadata.push(`Created: ${date} ${time}`);
  if (isPermanent) {
    metadata.push('Permanent');
  }

  const metaLine = metadata.length > 0 ? `   - ${metadata.join(' | ')}` : '';

  return `\n${index + 1}. ${jot.message}${metaLine}`;
}

/**
 * Format a list of jots with header and footer
 * Optimized for Claude Code's rendering
 */
export function formatJotList(
  jots: JotEntry[],
  headerText: string,
  showContext: boolean,
  getContextName: (contextId: string) => string | undefined
): string {
  if (jots.length === 0) {
    return `${headerText}\n\nNo jots found.`;
  }

  const lines = jots.map((jot, index) => {
    const contextName = getContextName(jot.contextId);
    return formatJotEntry(jot, index, showContext, contextName);
  });

  const summary = `${jots.length} jot${jots.length !== 1 ? 's' : ''} in ${headerText.toLowerCase().replace(/^📍 current context: |^📁 context: |^📚 /, '')}`;

  return `${headerText}\n${lines.join('\n\n')}\n\n${summary}`;
}

/**
 * Format a single context entry for display
 * Optimized for Claude Code's rendering
 */
export function formatContextEntry(
  context: Context,
  index: number,
  isCurrent: boolean
): string {
  const lastMod = new Date(context.lastModifiedAt).toLocaleDateString();
  const lastModTime = new Date(context.lastModifiedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const jotText = context.jotCount === 1 ? 'jot' : 'jots';
  const currentMarker = isCurrent ? ' (current)' : '';

  // Build metadata line
  const metadata: string[] = [];
  if (context.repository) {
    metadata.push(context.repository);
  }
  if (context.branch) {
    metadata.push(context.branch);
  }
  metadata.push(`${context.jotCount} ${jotText}`);
  metadata.push(`Updated: ${lastMod} ${lastModTime}`);

  return `\n${index + 1}. ${context.name}${currentMarker}\n   ${metadata.join(' | ')}`;
}

/**
 * Format a list of contexts with header and footer
 * Optimized for Claude Code's rendering
 */
export function formatContextList(
  contexts: Context[],
  currentContextName: string
): string {
  if (contexts.length === 0) {
    return 'No contexts found yet.\n\nCreate your first jot to get started!';
  }

  const lines = contexts.map((context, index) => {
    const isCurrent = context.name === currentContextName;
    return formatContextEntry(context, index, isCurrent);
  });

  const totalJots = contexts.reduce((sum, c) => sum + c.jotCount, 0);
  const summary = `${contexts.length} context${contexts.length !== 1 ? 's' : ''}, ${totalJots} total jots`;

  return `Your Contexts\n${lines.join('\n')}\n\n${summary}`;
}

/**
 * Format search criteria as a readable string
 */
export function formatSearchCriteria(options: {
  query?: string;
  tags?: string[];
  fromDate?: number;
  toDate?: number;
}): string {
  const criteria: string[] = [];

  if (options.query) criteria.push(`query: "${options.query}"`);
  if (options.tags && options.tags.length > 0) criteria.push(`tags: ${options.tags.join(', ')}`);
  if (options.fromDate)
    criteria.push(`from: ${new Date(options.fromDate).toLocaleDateString()}`);
  if (options.toDate) criteria.push(`to: ${new Date(options.toDate).toLocaleDateString()}`);

  return criteria.length > 0 ? ` (${criteria.join(', ')})` : '';
}
