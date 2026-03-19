# WardnMesh

**AI Agent Security Scanner** -- Real-time threat detection for AI coding tools.

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

WardnMesh wraps AI tools like Claude Code, intercepting stdin/stdout to detect dangerous operations before they execute. When a threat is detected, it pauses execution and asks for confirmation via a terminal prompt.

## Features

- 243 bundled threat detection rules (code injection, command injection, data exfiltration, privilege escalation)
- Real-time stdin/stdout scanning with < 5ms latency
- Terminal confirmation prompts (primary interface)
- Experimental desktop app via Tauri (not yet production-ready)
- Local SQLite audit log -- no data leaves your machine
- Decision caching (once / session / project / always)
- Fail-closed design: timeout = block

## Quick Start

```bash
# Install CLI
npm install -g @pcircle/wardnmesh

# Wrap your AI tool
wardn run claude

# Check status
wardn status
```

## How It Works

```
You run:  wardn run claude
          |
WardnMesh spawns 'claude' as subprocess
          |
stdin/stdout piped through SecurityTransform
          |
243 threat rules scanned per chunk (< 5ms)
          |
Violation? -> Confirmation prompt (Terminal)
          |
Allow -> pass data through    Block -> drop data
          |
All events logged to local SQLite (~/.wardnmesh/wardnmesh.db)
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `wardn run <cmd>` | Run command with real-time protection |
| `wardn status` | Show rules, database, and connection status |
| `wardn rules list` | List all threat rules with severity/category |
| `wardn rules enable/disable <id>` | Toggle specific rules |
| `wardn audit` | View audit log (--limit, --severity filters) |
| `wardn decisions list` | View cached allow/block decisions |
| `wardn decisions clear` | Clear decisions by scope |
| `wardn doctor` | System health check |

## Desktop App (Experimental)

> **Note:** The desktop app is experimental and not yet production-ready. The system tray menu does not work on macOS due to a Tauri 2 platform issue. Use the CLI for full functionality.

The optional Tauri desktop app is intended to provide:
- System tray with real-time threat counter
- Native confirmation popups when threats are detected
- Management dashboard (rules, audit log, decisions)
- Connected via Unix Domain Socket (IPC)

The CLI is the primary interface and works fully standalone using terminal prompts.

## Architecture

```
+-- CLI (wardn run) ---------------------+
|  ScanPipeline -> SecurityTransform     |
|  243 pattern rules (< 5ms/scan)        |
|  SQLite: audit, decisions, rules       |
|  Terminal confirmation prompts         |
+----------------------------------------+
          | IPC (Unix Socket) [optional]
+---------v------------------------------+
|  Desktop App (Tauri v2) [EXPERIMENTAL] |
|  Tray panel + Confirmation popups      |
|  Dashboard (rules, audit, stats)       |
+-----------------------------------------+
```

## Privacy

- All data stays on your machine
- No telemetry, analytics, or crash reports
- No cloud sync, no accounts, no API keys
- Works fully air-gapped

## Configuration

```bash
# User config
~/.wardnmesh/config.json

# Project-level overrides
.wardnmesh.json

# Environment variables
WARDN_TIMEOUT_CRITICAL=60000
WARDN_DEFAULT_ACTION=block
```

## Development

```bash
git clone <repo>
npm install
npm run build
npm test        # 70 tests
```

Desktop app (experimental):
```bash
cd apps/desktop
npm install
npm run tauri dev    # known issue: tray menu does not work on macOS
```

## License

[AGPL-3.0](LICENSE)
