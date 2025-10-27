# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive test suite with 63 tests covering all layers
- GitHub Actions CI workflow testing on Node 18, 20, 22 across Linux, macOS, Windows
- GitHub Actions release workflow for automated npm publishing
- Test coverage for database, repository, service, and formatters

### Fixed
- Fixed SQL queries referencing old `feature_id` column instead of `context_id` in full-text search
- Fixed SQL queries in getExpiringSoon method using incorrect column name
- Reduced MCP tool descriptions for lower token consumption

## [0.1.0] - 2025-10-27

### Added
- Initial release of Jot MCP
- Natural language jot creation with declarative commands
- Auto-detection of context from git repository and branch
- Fallback to directory name when not in git repo
- Context-aware jot listing (defaults to current context)
- Full-text search with SQLite FTS5
- Tag support for organizing jots
- Custom metadata for jots
- TTL-based expiration (default: 14 days)
- Permanent jots (TTL=0) with keyword detection ("important", "don't forget")
- 7 MCP tools: jot, list_contexts, list_jots, search_jots, delete_context, delete_jot, cleanup_expired
- MCP resources: `jot://context/{name}` for reading contexts
- 3 MCP prompts: resume_work, summarize_progress, what_was_i_doing
- Enhanced output formatting with emojis and visual separators
- XDG-compliant storage paths (~/.config/jot-mcp/)
- Clean 3-layer architecture (MCP → Service → Repository)

### Features
- **Natural Language**: Supports "remember this", "save this", "jot:", "this is important"
- **Context Detection**: Auto-detects from git (repo/branch) or directory name
- **Smart Listing**: "show jots" shows current context, "show all jots" shows everything
- **Intelligent Expiration**: Keywords like "important" automatically make jots permanent
- **Rich Formatting**: Clear, readable output with timestamps, tags, and context info
