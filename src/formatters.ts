/**
 * Output formatting utilities for consistent, readable display
 */

import { Context, JotEntry } from './types.js';

// Removed SEPARATOR - Claude Code doesn't render it well

/**
 * Format a single jot entry for display
 * Minimal format - Claude will reformat for the user
 * Using [ID] format to avoid auto-numbering confusion
 */
export function formatJotEntry(
  jot: JotEntry,
  _index: number,
  showContext: boolean,
  contextName?: string
): string {
  const date = new Date(jot.createdAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

  // Build compact metadata line
  const metadata: string[] = [];
  if (showContext && contextName) {
    metadata.push(`ctx:${contextName}`);
  }
  if (jot.tags.length > 0) {
    metadata.push(`tags:${jot.tags.join(',')}`);
  }
  metadata.push(`created:${date}`);
  if (jot.expiresAt === null) {
    metadata.push('permanent');
  }

  return `[${jot.id}] ${jot.message}\n    ${metadata.join(' | ')}`;
}

/**
 * Format a list of jots with header and footer
 * Minimal format - Claude will reformat for the user
 */
export function formatJotList(
  jots: JotEntry[],
  headerText: string,
  showContext: boolean,
  getContextName: (contextId: string) => string | undefined
): string {
  if (jots.length === 0) {
    return `${headerText}\nNo jots.`;
  }

  const lines = jots.map((jot, index) => {
    const contextName = getContextName(jot.contextId);
    return formatJotEntry(jot, index, showContext, contextName);
  });

  return `${headerText}\n\n${lines.join('\n')}\n\n${jots.length} jot${jots.length !== 1 ? 's' : ''}`;
}

/**
 * Format a single context entry for display
 * Minimal format - Claude will reformat for the user
 */
export function formatContextEntry(
  context: Context,
  _index: number,
  isCurrent: boolean
): string {
  const lastMod = new Date(context.lastModifiedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const currentMarker = isCurrent ? ' *' : '';

  // Build compact metadata
  const metadata: string[] = [];
  if (context.repository) {
    metadata.push(`repo:${context.repository}`);
  }
  if (context.branch) {
    metadata.push(`branch:${context.branch}`);
  }
  metadata.push(`${context.jotCount}j`);
  metadata.push(`updated:${lastMod}`);

  return `${context.name}${currentMarker}\n   ${metadata.join(' | ')}`;
}

/**
 * Format a list of contexts with header and footer
 * Minimal format - Claude will reformat for the user
 */
export function formatContextList(
  contexts: Context[],
  currentContextName: string
): string {
  if (contexts.length === 0) {
    return 'No contexts. Create a jot to start.';
  }

  const lines = contexts.map((context, index) => {
    const isCurrent = context.name === currentContextName;
    return formatContextEntry(context, index, isCurrent);
  });

  const totalJots = contexts.reduce((sum, c) => sum + c.jotCount, 0);

  return `Contexts (* = current)\n\n${lines.join('\n')}\n\n${contexts.length} context${contexts.length !== 1 ? 's' : ''}, ${totalJots} jots`;
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
