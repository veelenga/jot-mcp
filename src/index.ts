#!/usr/bin/env node

/**
 * Jot MCP Server
 * A lightweight MCP server for maintaining contextual memory across coding sessions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { initializeDatabase } from './database.js';
import { getDatabasePath } from './config.js';
import { JotRepository } from './repository.js';
import { JotService } from './service.js';
import { ToolHandlers } from './handlers.js';

// Initialize layers
const db = initializeDatabase(getDatabasePath());
const repository = new JotRepository(db);
const service = new JotService(repository);
const handlers = new ToolHandlers(service);

// Create MCP server
const server = new Server(
  {
    name: 'jot-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

/**
 * Tool definitions
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'jot',
        description: 'Create, update, or delete jots',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['create', 'update', 'delete'],
              description: 'create/update/delete',
            },
            id: {
              type: 'string',
              description: 'Jot ID',
            },
            message: {
              type: 'string',
              description: 'Note content',
            },
            contextName: {
              type: 'string',
              description: 'Context name',
            },
            ttlDays: {
              type: 'number',
              description: 'Days until expiration (0 = permanent)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags',
            },
            metadata: {
              type: 'object',
              description: 'Metadata',
            },
          },
          required: ['operation'],
        },
      },
      {
        name: 'list_jots',
        description: 'List/search jots with filters',
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'string',
              description: 'Context ("*" = all)',
            },
            query: {
              type: 'string',
              description: 'Search query',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags',
            },
            fromDate: {
              type: 'string',
              description: 'ISO date (from)',
            },
            toDate: {
              type: 'string',
              description: 'ISO date (to)',
            },
            includeExpired: {
              type: 'boolean',
              description: 'Include expired',
            },
            limit: {
              type: 'number',
              description: 'Max results',
            },
          },
        },
      },
      {
        name: 'context',
        description: 'List or delete contexts',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['list', 'delete'],
              description: 'list/delete',
            },
            context: {
              type: 'string',
              description: 'Context name',
            },
          },
          required: ['operation'],
        },
      },
    ],
  };
});

/**
 * Tool request handler
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let responseText: string;

    switch (name) {
      case 'jot':
        responseText = handlers.handleJot(args);
        break;
      case 'list_jots':
        responseText = handlers.handleListJots(args);
        break;
      case 'context':
        responseText = handlers.handleContext(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: responseText }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Resource handlers
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const contexts = service.listContexts();

  return {
    resources: contexts.map((context) => {
      const encodedName = encodeURIComponent(context.name);
      return {
        uri: `jot://context/${encodedName}`,
        name: `Jots for ${context.name}`,
        description: `${context.jotCount} jots in this context`,
        mimeType: 'text/plain',
      };
    }),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (!uri.startsWith('jot://context/')) {
    throw new Error('Invalid resource URI');
  }

  const encodedName = uri.slice('jot://context/'.length);
  let contextName: string;
  try {
    contextName = decodeURIComponent(encodedName);
  } catch {
    throw new Error('Invalid resource URI');
  }
  const jots = service.getContextJots(contextName);

  const content = jots
    .map((j) => {
      const date = new Date(j.createdAt).toISOString();
      const tags = j.tags.length > 0 ? ` [${j.tags.join(', ')}]` : '';
      const expires = j.expiresAt
        ? ` (expires: ${new Date(j.expiresAt).toLocaleDateString()})`
        : ' (permanent)';
      return `[${date}]${tags}${expires}\n${j.message}`;
    })
    .join('\n\n---\n\n');

  return {
    contents: [
      {
        uri,
        mimeType: 'text/plain',
        text: content || 'No jots in this context',
      },
    ],
  };
});

/**
 * Prompt handlers
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'resume_work',
        description: 'Load recent jots to resume work (last 5)',
        arguments: [],
      },
      {
        name: 'summarize_progress',
        description: 'Summarize progress across all contexts (last 7 days)',
        arguments: [],
      },
      {
        name: 'what_was_i_doing',
        description: 'Quick recap of recent work and suggested next steps',
        arguments: [],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'resume_work': {
      const contextName = args?.context as string | undefined;
      const limit = typeof args?.limit === 'number' ? args.limit : 5;
      const jots = contextName
        ? service.getContextJots(contextName, limit)
        : service.searchJots({ limit });

      const jotList = jots
        .map((j) => {
          const context = service.getContext(j.contextId);
          const date = new Date(j.createdAt).toLocaleDateString();
          return `[${context?.name}] ${date}: ${j.message}`;
        })
        .join('\n');

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Here are my recent jots to help resume work:\n\n${jotList}\n\nBased on these jots, help me understand where I left off and what I should work on next.`,
            },
          },
        ],
      };
    }

    case 'summarize_progress': {
      const contextName = args?.context as string | undefined;
      const days = typeof args?.days === 'number' ? args.days : 7;
      const fromDate = Date.now() - days * 24 * 60 * 60 * 1000;

      // Resolve context name to ID if provided
      let contextId: number | undefined;
      if (contextName) {
        const context = service.getContext(contextName);
        contextId = context?.id;
      }

      const jots = service.searchJots({
        contextId,
        fromDate,
      });

      const grouped: Record<string, string[]> = {};
      for (const jot of jots) {
        const context = service.getContext(jot.contextId);
        const contextKey = context?.name || 'unknown';
        if (!grouped[contextKey]) {
          grouped[contextKey] = [];
        }
        grouped[contextKey].push(jot.message);
      }

      const summary = Object.entries(grouped)
        .map(([ctx, msgs]) => `**${ctx}**:\n${msgs.map((m) => `  - ${m}`).join('\n')}`)
        .join('\n\n');

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Here's my progress over the last ${days} days:\n\n${summary}\n\nPlease provide a concise summary of what I've accomplished and any patterns or next steps you notice.`,
            },
          },
        ],
      };
    }

    case 'what_was_i_doing': {
      const recentJots = service.searchJots({ limit: 10 });

      if (recentJots.length === 0) {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: "I don't have any recent jots. What was I working on?",
              },
            },
          ],
        };
      }

      const jotList = recentJots
        .map((j) => {
          const context = service.getContext(j.contextId);
          const date = new Date(j.createdAt).toLocaleDateString();
          return `[${context?.name}] ${date}: ${j.message}`;
        })
        .join('\n');

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Here are my most recent jots:\n\n${jotList}\n\nWhat was I working on? What should I focus on next?`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

/**
 * Start the server
 */
async function main() {
  // Handle CLI arguments
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    console.log('0.1.0');
    process.exit(0);
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
jot-mcp v0.1.0
Lightweight MCP server for maintaining coding context across sessions

Usage:
  jot-mcp              Start the MCP server
  jot-mcp --version    Show version number
  jot-mcp --help       Show this help message
`);
    process.exit(0);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Jot MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
