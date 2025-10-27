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

export class ToolHandlers {
  constructor(private service: JotService) {}

  /**
   * Handle jot creation
   */
  handleJot(args: any): string {
    const jot = this.service.createJot({
      message: args.message as string,
      contextName: args.contextName as string | undefined,
      ttlDays: args.ttlDays as number | undefined,
      tags: (args.tags as string[]) || [],
      metadata: (args.metadata as Record<string, string>) || {},
    });

    const context = this.service.getContext(jot.contextId);
    const expiryInfo = jot.expiresAt
      ? `Expires: ${new Date(jot.expiresAt).toLocaleDateString()}`
      : 'Permanent';

    return `✓ Jotted to context "${context?.name}"\nID: ${jot.id}\n${expiryInfo}${jot.tags.length > 0 ? `\nTags: ${jot.tags.join(', ')}` : ''}`;
  }

  /**
   * Handle list contexts
   */
  handleListContexts(): string {
    const contexts = this.service.listContexts();
    const currentContext = this.service.detectCurrentContext();
    return formatContextList(contexts, currentContext);
  }

  /**
   * Handle list jots
   */
  handleListJots(args: any): string {
    let jots: JotEntry[];
    let headerText: string;
    let showContext = false;

    // Check if user wants all contexts
    if (args.context === '*' || args.context === 'all') {
      jots = this.service.searchJots({ limit: args.limit as number });
      headerText = '📚 All Contexts';
      showContext = true;
    } else if (args.context) {
      // Specific context requested
      jots = this.service.getContextJots(args.context as string, args.limit as number);
      headerText = `📁 Context: ${args.context}`;
    } else {
      // Default: use current context
      const currentContext = this.service.detectCurrentContext();
      try {
        jots = this.service.getContextJots(currentContext, args.limit as number);
        headerText = `📍 Current Context: ${currentContext}`;
      } catch {
        // Context doesn't exist yet, show all
        jots = this.service.searchJots({ limit: args.limit as number });
        headerText = `⚠️  No jots in current context (${currentContext})`;
        showContext = true;
      }
    }

    return formatJotList(jots, headerText, showContext, (contextId) =>
      this.service.getContext(contextId)?.name
    );
  }

  /**
   * Handle search jots
   */
  handleSearchJots(args: any): string {
    const searchOptions = {
      query: args?.query as string | undefined,
      contextId: args?.context as string | undefined,
      tags: args?.tags as string[] | undefined,
      fromDate: args?.fromDate ? new Date(args.fromDate as string).getTime() : undefined,
      toDate: args?.toDate ? new Date(args.toDate as string).getTime() : undefined,
      includeExpired: args?.includeExpired as boolean | undefined,
      limit: args?.limit as number | undefined,
    };

    const jots = this.service.searchJots(searchOptions);

    if (jots.length === 0) {
      return '🔍 No jots found matching your criteria.';
    }

    const criteriaText = formatSearchCriteria(searchOptions);
    const headerText = `🔍 Search Results${criteriaText}`;

    return formatJotList(jots, headerText, true, (contextId) =>
      this.service.getContext(contextId)?.name
    );
  }

  /**
   * Handle delete context
   */
  handleDeleteContext(args: any): string {
    const deleted = this.service.deleteContext(args.context as string);
    return deleted
      ? `✓ Deleted context "${args.context}" and all its jots`
      : `Context "${args.context}" not found`;
  }

  /**
   * Handle delete jot
   */
  handleDeleteJot(args: any): string {
    const deleted = this.service.deleteJot(args.id as string);
    return deleted ? `✓ Deleted jot ${args.id}` : `Jot ${args.id} not found`;
  }

  /**
   * Handle cleanup expired jots
   */
  handleCleanupExpired(): string {
    const count = this.service.cleanupExpired();
    return `✓ Cleaned up ${count} expired jot${count !== 1 ? 's' : ''}`;
  }
}
