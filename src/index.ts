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
        description:
          'Save notes to persistent context. Auto-detects context from git. Use ttlDays=0 for permanent jots.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Note content',
            },
            contextName: {
              type: 'string',
              description: 'Context name (optional)',
            },
            ttlDays: {
              type: 'number',
              description: 'Days until expiration (default: 14, 0 = permanent)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags',
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'list_contexts',
        description: 'List all contexts with metadata and jot counts.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_jots',
        description: 'List jots. Defaults to current context. Use "*" for all contexts.',
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'string',
              description: 'Context name or "*" for all (default: current)',
            },
            limit: {
              type: 'number',
              description: 'Max results',
            },
          },
        },
      },
      {
        name: 'search_jots',
        description: 'Search jots with filters.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            context: {
              type: 'string',
              description: 'Filter by context',
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
        name: 'delete_context',
        description: 'Delete a context and all its jots.',
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'string',
              description: 'Context name',
            },
          },
          required: ['context'],
        },
      },
      {
        name: 'delete_jot',
        description: 'Delete a jot by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Jot ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'cleanup_expired',
        description: 'Remove expired jots.',
        inputSchema: {
          type: 'object',
          properties: {},
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
      case 'list_contexts':
        responseText = handlers.handleListContexts();
        break;
      case 'list_jots':
        responseText = handlers.handleListJots(args);
        break;
      case 'search_jots':
        responseText = handlers.handleSearchJots(args);
        break;
      case 'delete_context':
        responseText = handlers.handleDeleteContext(args);
        break;
      case 'delete_jot':
        responseText = handlers.handleDeleteJot(args);
        break;
      case 'cleanup_expired':
        responseText = handlers.handleCleanupExpired();
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
    resources: contexts.map((context) => ({
      uri: `jot://context/${context.name}`,
      name: `Jots for ${context.name}`,
      description: `${context.jotCount} jots in this context`,
      mimeType: 'text/plain',
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (!uri.startsWith('jot://context/')) {
    throw new Error('Invalid resource URI');
  }

  const contextName = uri.replace('jot://context/', '');
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
        description:
          'Load context from recent jots to resume work. Use when user says: "resume work", "what was I working on", "continue where I left off", "load context".',
        arguments: [
          {
            name: 'context',
            description: 'Context name (optional, uses auto-detected if not provided)',
            required: false,
          },
        ],
      },
      {
        name: 'summarize_progress',
        description:
          'Summarize progress across all contexts or a specific one. Use when user says: "summarize progress", "what did I do", "show my progress", "recap my work".',
        arguments: [
          {
            name: 'context',
            description: 'Context name (optional, summarizes all if not provided)',
            required: false,
          },
          {
            name: 'days',
            description: 'Number of days to look back (default: 7)',
            required: false,
          },
        ],
      },
      {
        name: 'what_was_i_doing',
        description:
          'Quick recap of recent work and next steps. Use when user asks: "what was I doing", "remind me what I was working on", "where did I leave off".',
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
      const jots = contextName
        ? service.getContextJots(contextName, 20)
        : service.searchJots({ limit: 20 });

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

      const jots = service.searchJots({
        contextId: contextName,
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Jot MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
