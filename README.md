# Jot MCP

> Lightweight MCP server for maintaining coding context across sessions

Never lose your mental state when switching branches, taking breaks, or context-switching between features. Jot lets you naturally log what you're doing and retrieve it later through conversation with Claude Code.

## Features

- **Zero-friction logging** - Natural conversation, no commands to memorize
- **Smart context detection** - Auto-detects from git repo/branch
- **Full-text search** - Find jots by keyword, tag, date, or context
- **Auto-expiration** - Jots expire after 2 weeks by default (configurable)
- **SQLite storage** - Fast, local, reliable

## Quick Start

### Option 1: Plugin Install (Recommended)

In Claude Code, add the marketplace and install the plugin:

```bash
/plugin marketplace add veelenga/jot-mcp
/plugin install jot-mcp@jot-mcp
```

Then restart Claude Code to activate the plugin.

### Option 2: NPM Install

```bash
npm install -g jot-mcp
```

Then configure Claude Code:

```bash
claude mcp add --scope user jot jot-mcp
```

## Usage

### Natural Conversation

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

Jot MCP provides just 3 tools for maximum token efficiency:

| Tool | Operations | Description |
|------|-----------|-------------|
| `jot` | create, update, delete | Create, update, or delete jots (auto-detects context from git) |
| `list_jots` | - | List or search jots with optional filters (query, tags, dates) |
| `context` | list, delete | List all contexts or delete a specific context |

**Note:** Expired jots are automatically cleaned up in the background during list/search operations.

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
npm test          # Run tests (76 tests covering all layers)
npm run watch     # Watch mode for development
```

## Links

- [GitHub Repository](https://github.com/veelenga/jot-mcp)
- [npm Package](https://www.npmjs.com/veelenga/jot-mcp)
