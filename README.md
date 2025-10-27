# Jot MCP

[![CI](https://github.com/veelenga/jot-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/veelenga/jot-mcp/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/jot-mcp.svg)](https://www.npmjs.com/veelenga/jot-mcp)

> Lightweight MCP server for maintaining coding context across sessions

Never lose your mental state when switching branches, taking breaks, or context-switching between features. Jot lets you naturally log what you're doing and retrieve it later through conversation with Claude Code.

## Features

- **Zero-friction logging** - Natural conversation, no commands to memorize
- **Smart context detection** - Auto-detects from git repo/branch
- **Full-text search** - Find jots by keyword, tag, date, or context
- **Auto-expiration** - Jots expire after 2 weeks by default (configurable)
- **SQLite storage** - Fast, local, reliable

## Quick Start

### 1. Install

```bash
npm install -g jot-mcp
```

### 2. Configure Claude Code

```bash
claude mcp add --scope user jot jot-mcp
```

## Usage

Talk naturally with Claude Code:

```
"jot: Implemented Redis caching"
"Remember this: database migration requires manual step"
"This is important: API keys in 1Password vault"
```

```
"Show jots"                    # Current context
"Show all jots"                # All contexts
"What was I working on?"       # Recent work recap
"Search jots about auth"       # Full-text search
```

```
"Update jot 5 with message 'Updated implementation'"
"Delete jot 3"
"Make jot 7 permanent"
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `jot` | Create a jot (auto-detects context from git) |
| `update_jot` | Update message, tags, metadata, or TTL |
| `delete_jot` | Delete a jot by ID |
| `list_jots` | List jots (current context or all) |
| `search_jots` | Search by keyword, tag, date |
| `list_contexts` | Show all contexts |
| `delete_context` | Remove a context and its jots |
| `cleanup_expired` | Remove expired jots |

## Storage

Jots are stored locally in SQLite:
- **macOS/Linux:** `~/.config/jot-mcp/jots.sqlite`
- **Windows:** `%APPDATA%\jot-mcp\jots.sqlite`

**Backup:** Simply copy this file to backup your jots.

## Troubleshooting

**Server not connecting:**
```bash
jot-mcp --version          # Check installation
npm install -g jot-mcp     # Reinstall if needed
claude mcp list            # Verify configuration
```

**Context auto-detection not working:**
- Make sure you're in a git repository (`git status`)
- Or manually specify context: `"jot to my-context: message"`

## Development

```bash
npm install       # Install dependencies
npm run build     # Build the project
npm test          # Run tests (75 tests covering all layers)
npm run watch     # Watch mode for development
```

## Links

- [GitHub Repository](https://github.com/veelenga/jot-mcp)
- [npm Package](https://www.npmjs.com/veelenga/jot-mcp)
