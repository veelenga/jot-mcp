/**
 * MCP tool request handlers
 * Business logic for handling tool requests
 */

import { JotService } from './service.js';
import { JotEntry } from './types.js';
import {
  formatJotList,
  formatContextList,
  formatSearchCriteria,
} from './formatters.js';

/**
 * Operation constants
 */
const JotOperations = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

const ContextOperations = {
  LIST: 'list',
  DELETE: 'delete',
} as const;

/**
 * Format expiry date for display
 */
function formatExpiryDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

export class ToolHandlers {
  constructor(private service: JotService) {}

  /**
   * Handle jot CRUD operations
   */
  handleJot(args: any): string {
    const operation = args.operation as string;

    switch (operation) {
      case JotOperations.CREATE:
        return this.handleJotCreate(args);
      case JotOperations.UPDATE:
        return this.handleJotUpdate(args);
      case JotOperations.DELETE:
        return this.handleJotDelete(args);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Handle jot creation
   */
  private handleJotCreate(args: any): string {
    const jot = this.service.createJot({
      message: args.message as string,
      contextName: args.contextName as string | undefined,
      ttlDays: args.ttlDays as number | undefined,
      tags: (args.tags as string[]) || [],
      metadata: (args.metadata as Record<string, string>) || {},
    });

    const context = this.service.getContext(jot.contextId);
    const expiryInfo = jot.expiresAt ? `exp:${formatExpiryDate(jot.expiresAt)}` : 'permanent';

    return `Jotted to: ${context?.name}\nID:${jot.id} | ${expiryInfo}${jot.tags.length > 0 ? ` | tags:${jot.tags.join(',')}` : ''}`;
  }

  /**
   * Handle context operations
   */
  handleContext(args: any): string {
    const operation = args.operation as string;

    switch (operation) {
      case ContextOperations.LIST:
        return this.handleContextList();
      case ContextOperations.DELETE:
        return this.handleContextDelete(args);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Handle list contexts
   */
  private handleContextList(): string {
    // Cleanup expired jots automatically (async, non-blocking)
    setImmediate(() => this.service.cleanupExpired());

    const contexts = this.service.listContexts();
    const currentContext = this.service.detectCurrentContext();
    return formatContextList(contexts, currentContext);
  }

  /**
   * Handle delete context
   */
  private handleContextDelete(args: any): string {
    const deleted = this.service.deleteContext(args.context as string);
    return deleted
      ? `Deleted context: ${args.context}`
      : `Context not found: ${args.context}`;
  }

  /**
   * Handle list/search jots (unified)
   */
  handleListJots(args: any): string {
    // Cleanup expired jots automatically (async, non-blocking)
    setImmediate(() => this.service.cleanupExpired());

    // Check if this is a search (has search filters) or simple list
    const hasSearchFilters = args?.query || args?.tags || args?.fromDate || args?.toDate;

    if (hasSearchFilters) {
      // Search mode
      return this.handleJotsSearch(args);
    } else {
      // Simple list mode
      return this.handleJotsList(args);
    }
  }

  /**
   * Handle simple jots list
   */
  private handleJotsList(args: any): string {
    let jots: JotEntry[];
    let headerText: string;
    let showContext = false;

    // Check if user wants all contexts
    if (args.context === '*' || args.context === 'all') {
      jots = this.service.searchJots({ limit: args.limit as number });
      headerText = 'All Contexts';
      showContext = true;
    } else if (args.context) {
      // Specific context requested
      jots = this.service.getContextJots(args.context as string, args.limit as number);
      headerText = `Context: ${args.context}`;
    } else {
      // Default: use current context
      const currentContext = this.service.detectCurrentContext();
      try {
        jots = this.service.getContextJots(currentContext, args.limit as number);
        headerText = `Context: ${currentContext}`;
      } catch {
        // Context doesn't exist yet, show all
        jots = this.service.searchJots({ limit: args.limit as number });
        headerText = `No jots in: ${currentContext}`;
        showContext = true;
      }
    }

    return formatJotList(jots, headerText, showContext, (contextId) =>
      this.service.getContext(contextId)?.name
    );
  }

  /**
   * Handle jots search with filters
   */
  private handleJotsSearch(args: any): string {
    // Resolve context name to ID if provided
    let contextId: number | undefined;
    if (args?.context) {
      const context = this.service.getContext(args.context as string);
      contextId = context?.id;
    }

    const searchOptions = {
      query: args?.query as string | undefined,
      contextId,
      tags: args?.tags as string[] | undefined,
      fromDate: args?.fromDate ? new Date(args.fromDate as string).getTime() : undefined,
      toDate: args?.toDate ? new Date(args.toDate as string).getTime() : undefined,
      includeExpired: args?.includeExpired as boolean | undefined,
      limit: args?.limit as number | undefined,
    };

    const jots = this.service.searchJots(searchOptions);

    if (jots.length === 0) {
      return 'No jots found.';
    }

    const criteriaText = formatSearchCriteria(searchOptions);
    const headerText = `Search${criteriaText}`;

    return formatJotList(jots, headerText, true, (contextId) =>
      this.service.getContext(contextId)?.name
    );
  }

  /**
   * Handle jot update
   */
  private handleJotUpdate(args: any): string {
    const updates: {
      message?: string;
      ttlDays?: number | null;
      tags?: string[];
      metadata?: Record<string, string>;
    } = {};

    if (args.message !== undefined) {
      updates.message = args.message as string;
    }
    if (args.ttlDays !== undefined) {
      updates.ttlDays = args.ttlDays as number;
    }
    if (args.tags !== undefined) {
      updates.tags = args.tags as string[];
    }
    if (args.metadata !== undefined) {
      updates.metadata = args.metadata as Record<string, string>;
    }

    const id = typeof args.id === 'string' ? parseInt(args.id, 10) : (args.id as number);
    const updated = this.service.updateJot(id, updates);

    if (!updated) {
      return `Jot not found: ${args.id}`;
    }

    const context = this.service.getContext(updated.contextId);
    const expiryInfo = updated.expiresAt ? `exp:${formatExpiryDate(updated.expiresAt)}` : 'permanent';

    const changesSummary: string[] = [];
    if (args.message !== undefined) changesSummary.push('msg');
    if (args.ttlDays !== undefined) changesSummary.push('ttl');
    if (args.tags !== undefined) changesSummary.push('tags');
    if (args.metadata !== undefined) changesSummary.push('meta');

    return `Updated jot (${changesSummary.join(',')})\nID:${args.id} | ctx:${context?.name} | ${expiryInfo}${updated.tags.length > 0 ? ` | tags:${updated.tags.join(',')}` : ''}`;
  }

  /**
   * Handle jot deletion
   */
  private handleJotDelete(args: any): string {
    const id = typeof args.id === 'string' ? parseInt(args.id, 10) : (args.id as number);
    const deleted = this.service.deleteJot(id);
    return deleted ? `Deleted jot: ${id}` : `Jot not found: ${id}`;
  }
}
