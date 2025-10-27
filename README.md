# Jot MCP

> Lightweight MCP server for maintaining coding context across sessions

Never lose your mental state when switching branches, taking breaks, or context-switching between features. Jot lets you naturally log what you're doing and retrieve it later through conversation with Claude Code.

## ✨ Features

- 💬 **Zero-friction logging** - Natural conversation, no commands to memorize
- 🔍 **Smart context detection** - Auto-detects from git repo/branch
- 🔎 **Full-text search** - Find jots by keyword, tag, date, or context
- ⏰ **Auto-expiration** - Jots expire after 2 weeks by default (configurable)
- 💾 **SQLite storage** - Fast, local, reliable

## 🚀 Quick Start

### 1. Install

**From npm:**

```bash
npm install -g jot-mcp
```

**From source:**

```bash
git clone https://github.com/veelenga/jot-mcp.git
cd jot-mcp
npm install && npm run build && npm install -g .
```

### 2. Configure Claude Code

**Global setup** (recommended - works in all projects):

```bash
claude mcp add --scope user jot jot-mcp
```

**Project-specific setup:**

```bash
claude mcp add jot jot-mcp
```

**Manual configuration:**

Add to your MCP config file (`.claude.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "jot": {
      "command": "jot-mcp"
    }
  }
}
```

### 3. Verify Installation

```bash
claude mcp list
```

You should see `jot: jot-mcp - ✓ Connected`

## 💡 Usage

Talk naturally with Claude Code - use declarative, conversational language:

```
You: "jot: JWT implementation complete, rate limiting next"
Claude: ✓ Jotted to context "auth-service/jwt-refactor"

You: "Add this explanation to jots, this is important"
Claude: ✓ Jotted (permanent) ...

You: "What was I working on?"
Claude: [Shows your recent jots and summarizes]

You: "Show jots about authentication"
Claude: [Searches and displays matching jots]
```

### Natural Language Examples

**Creating jots (all these work):**
```
"jot: Implemented Redis caching"
"Remember this: database migration requires manual step"
"Save this link: https://github.com/user/repo"
"Add this to jots: found race condition in cache"
"This is important: API keys in 1Password vault"
"Track progress on payment integration"
"Jot this down: need to refactor auth middleware"
```

**Retrieving context:**
```
"Show jots"                              # Shows current context jots
"List jots"                              # Shows current context jots
"Show all jots"                          # Shows jots from all contexts
"Show jots for payment-gateway"          # Shows specific context
"What was I working on yesterday?"
"Show me jots about authentication"
"List my contexts"
"Resume work on payment-gateway"
"Summarize my progress this week"
```

### Advanced Usage

**Important/permanent jots** (keywords: important, permanently, don't forget, always remember):
```
"This is important: production DB requires manual migration"
"Jot permanently: API keys stored in 1Password vault"
"Don't forget: Redis cache needs warming after deploy"
```

**Context-specific jots:**
```
"Create jots tracking progress of this project"
"Start tracking work on payment-gateway"
"Jot to backend-refactor: completed API migration"
```

**Saving links and references:**
```
"Jot: save this link https://github.com/user/repo"
"Remember this article: https://example.com/best-practices"
"Add reference to docs: https://api.example.com/v2"
```

**Context-aware listing:**
```
# In jot-mcp repo, main branch
You: "Show jots"
Claude: 📍 Current Context: jot-mcp

        1. Enhanced tool descriptions for natural language
           - Created: 10/27/2025 14:30

        2. Improved context detection
           - Tags: enhancement, ux | Created: 10/27/2025 15:45

        3. Added context-aware jot listing
           - Created: 10/27/2025 16:20 | Permanent

        3 jots in jot-mcp

# See all contexts
You: "Show all jots"
Claude: 📚 All Contexts

        1. Enhanced tool descriptions
           - jot-mcp | Created: 10/27/2025 14:30

        2. Stripe integration complete
           - payment-gateway | Created: 10/25/2025 10:15

        5 jots in all contexts

# Specific context
You: "Show jots for payment-gateway"
Claude: 📁 Context: payment-gateway
        [Shows jots for that context]
```

**Context switching:**
```
You: "jot: Payment gateway 80% done, webhooks next"
[Switch to hotfix branch]
You: "Remember this: security bug in auth middleware"
[Switch back to main branch]
You: "Show jots"  # Shows only current context jots
Claude: [Shows payment-gateway jots]
```

## 🔧 Tools and Prompts

### MCP Tools

| Tool | Description |
|------|-------------|
| `jot` | Create a jot (auto-detects context from git) |
| `list_contexts` | Show all your contexts |
| `list_jots` | List jots (defaults to current context, specify "all" for everything) |
| `search_jots` | Search by keyword, tag, date |
| `delete_context` | Remove a context and its jots |
| `cleanup_expired` | Remove expired jots |

### MCP Prompts

- **"What was I doing?"** - Quick recap of recent work
- **"Resume work on [context]"** - Load context to continue
- **"Summarize my progress"** - Overview of recent accomplishments

### MCP Resources

- `jot://context/{name}` - Read all jots for a specific context

## 💾 Storage

Jots are stored locally in SQLite:
- **macOS/Linux:** `~/.config/jot-mcp/jots.sqlite`
- **Windows:** `%APPDATA%\jot-mcp\jots.sqlite`

**Backup:** Simply copy this file to backup your jots.

## 📝 Troubleshooting

**Server not connecting:**

```bash
# Check if server is installed
jot-mcp --version

# Reinstall if needed
npm install -g jot-mcp

# Verify MCP configuration
claude mcp list
```

**Context auto-detection not working:**

Make sure you're in a git repository:
```bash
git status  # Should show repo info, not "not a git repository"
```

If not in git repo, manually specify context:
```
jot to my-context: "Some message"
```

**Permission denied error:**

```bash
# Make sure the binary is executable
chmod +x $(which jot-mcp)
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode for development
npm run watch

# Start the MCP server directly
npm run dev
```


## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT - see [LICENSE](LICENSE) file for details

## 🔗 Links

- [GitHub Repository](https://github.com/veelenga/jot-mcp)
- [npm Package](https://www.npmjs.com/package/jot-mcp)
- [Claude Code Documentation](https://docs.claude.com/claude-code)
