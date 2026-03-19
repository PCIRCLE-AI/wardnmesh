# Development Guide

## Prerequisites

- Node.js >= 18
- npm >= 9
- Rust toolchain (only needed for experimental Desktop app)

## Setup

```bash
git clone <repo>
cd agent-guard
npm install
npm run build
```

## Project Structure

```
src/
  cli.ts                    # CLI entry point, command routing
  active-defense.ts         # Process wrapping, stdio interception
  errors.ts                 # WardnError, ErrorCode, recovery strategies
  interfaces/               # TypeScript interfaces (scan, confirmation, transport, repository)
  config/                   # Config loader (hierarchy: flags -> env -> project -> user -> defaults)
  logging/                  # Structured JSON logger with rotation
  storage/                  # SQLite layer (DatabaseManager, migrations, 3 repositories)
  decisions/                # DecisionManager (session + persistent cache, scope priority)
  rules/                    # RuleRegistry, threat-rule-adapter (243 bundled rules)
  scan/                     # ScanPipeline, PatternScanner, SecurityTransform
  ipc/                      # Unix socket client, protocol types, transports
  confirmation/             # ConfirmationRequester (state machine orchestrator)
  commands/                 # CLI commands (run, status, rules, audit, decisions)

apps/desktop/               # [EXPERIMENTAL] Desktop app - optional, not production-ready
  src/                      # React frontend
    components/TrayPanel/   # System tray status panel
    components/Dashboard/   # Management UI (rules, audit, decisions, stats)
    components/ConfirmationWindow/  # Native confirmation popup
  src-tauri/src/            # Rust backend
    lib.rs                  # App setup, tray, window management
    database.rs             # SQLite reader (rusqlite)
    commands.rs             # Tauri invoke commands
    ipc_server.rs           # Unix socket server
    confirmation.rs         # Window lifecycle manager

data/
  default-threat-rules.json # 243 bundled threat rules

tests/                      # Jest tests (70 total)
```

## Running Tests

```bash
# All tests
npm test

# Specific test suites
npx jest tests/storage
npx jest tests/scan
npx jest tests/integration

# With coverage
npm run test:coverage
```

## Building

```bash
# CLI
npm run build    # outputs to dist/

# Desktop app (experimental - optional, not required for CLI usage)
# Known issue: tray menu does not work on macOS (Tauri 2 issue)
cd apps/desktop
npm run build              # React frontend
npm run tauri dev          # Development mode
npm run tauri build        # Production build
```

## Adding a Threat Rule

Bundled rules are in `data/default-threat-rules.json`:

```json
{
  "id": "wm-code-999",
  "pattern": "(?i)dangerous_pattern\\(",
  "description": "Dangerous Pattern Detection",
  "severity": "critical",
  "category": "code-injection",
  "enabled": true
}
```

**Severity mapping:** critical/high -> critical, medium -> major, low -> minor
**Category mapping:** code-injection/command-injection/data-exfiltration/privilege-escalation -> safety, network -> network_boundary

The adapter normalizes PCRE-style `(?i)` flags to JavaScript RegExp flags automatically.

## Adding a CLI Command

1. Create `src/commands/my-cmd.ts`
2. Import and register in `src/cli.ts` switch statement
3. Add to `showHelp()` output

## Key Design Patterns

- **Repository Pattern**: All SQLite access via typed repositories (DecisionRepository, AuditRepository, RuleRepository)
- **Transport Abstraction**: IConfirmationTransport interface — TerminalTransport (primary) and DesktopTransport (experimental) are interchangeable
- **Fail-Closed**: Every error path defaults to BLOCK
- **Scanner Pipeline**: Composable scanners with short-circuit on first violation

## Git Conventions

Commit format: `<type>(<scope>): <subject>`
Types: feat, fix, refactor, test, docs, chore

## Debugging

```bash
# Check database
sqlite3 ~/.wardnmesh/wardnmesh.db "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 5;"

# Check logs
tail -f ~/.wardnmesh/logs/wardn.log | jq

# Check IPC socket
ls -la ~/.wardnmesh/wardn.sock

# System health
wardn doctor --verbose
```
