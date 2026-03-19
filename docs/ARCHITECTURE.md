# WardnMesh Architecture

## Overview

WardnMesh is a standalone, local-first AI agent security scanner. It wraps AI tools as subprocesses, scanning their I/O in real-time against 243 threat detection rules.

## System Architecture

```
+-- CLI Process (Node.js) ------------------------------------------+
|                                                                    |
|  cli.ts (entry point)                                              |
|    +-- RunCommand -> ScanPipeline -> SecurityTransform             |
|    +-- StatusCommand, RulesCommand, AuditCommand                   |
|    +-- DecisionsCommand                                            |
|                                                                    |
|  ScanPipeline (Transform stream chain)                             |
|    +-- PatternScanner (243 bundled rules)                          |
|    +-- ContentAnalysisScanner (6 static rules)                     |
|                                                                    |
|  ConfirmationFlow (state machine)                                  |
|    +-- TerminalTransport (readline prompt - primary)               |
|    +-- DesktopTransport (Unix Socket -> Desktop App) [EXPERIMENTAL]|
|                                                                    |
|  Storage Layer (SQLite via better-sqlite3)                         |
|    +-- DatabaseManager (WAL mode, migrations)                      |
|    +-- AuditRepository                                             |
|    +-- DecisionRepository                                          |
|    +-- RuleRepository                                              |
+--------------------------------------------------------------------+
                    | IPC (Unix Domain Socket)
+-------------------v------------------------------------------------+
|  Desktop App (Tauri v2) [EXPERIMENTAL - not production-ready]      |
|  Rust Backend                                                      |
|    +-- IPCServer (session management)                              |
|    +-- DatabaseReader (rusqlite, read-only)                        |
|    +-- ConfirmationManager (window lifecycle)                      |
|                                                                    |
|  React Frontend                                                    |
|    +-- TrayPanel (system tray status)                              |
|    +-- ConfirmationWindow (per-threat popup)                       |
|    +-- Dashboard (rules, audit, decisions, stats)                  |
+--------------------------------------------------------------------+
```

## Key Design Decisions

### Fail-Closed
All timeouts result in BLOCK. No severity level auto-allows. If the confirmation system fails, data is dropped.

### Local-Only Storage
SQLite with WAL mode at `~/.wardnmesh/wardnmesh.db`. Both CLI and Desktop access the same database concurrently. No cloud sync.

### IPC Protocol
Newline-delimited JSON over Unix Domain Socket (`~/.wardnmesh/wardn.sock`). Protocol version 1. Max message size 64KB.

### Transform Stream Architecture
`SecurityTransform` extends Node.js `Transform`. Scanning happens synchronously per chunk. On violation, the callback is held (automatic backpressure) until user responds.

## Data Flow

```
1. User runs: wardn run claude
2. CLI spawns 'claude' subprocess with piped stdio
3. stdout piped through SecurityTransform
4. Each chunk scanned by ScanPipeline (< 5ms for 243 rules)
5. No violation -> chunk passed through
6. Violation -> ConfirmationRequester.handle()
   a. Check DecisionManager cache (session -> project -> always)
   b. Cache hit -> apply cached decision
   c. Cache miss -> send to transport (Terminal prompt, or Desktop if running)
   d. Wait for response (with severity-based timeout)
   e. Timeout -> BLOCK (fail-closed)
7. Decision recorded in DecisionManager + AuditRepository
8. Allow -> pass chunk | Block -> drop chunk
```

## Configuration Hierarchy

Priority (high to low):
1. CLI flags (`--allow-severity=minor`)
2. Environment variables (`WARDN_TIMEOUT_CRITICAL=90`)
3. Project config (`.wardnmesh.json` in project root)
4. User config (`~/.wardnmesh/config.json`)
5. Built-in defaults

## Directory Structure

```
src/
  cli.ts                    # CLI entry point
  active-defense.ts         # Process wrapping + stdio interception
  errors.ts                 # Error domain model
  interfaces/               # Core type contracts
  config/                   # Configuration loader + defaults
  logging/                  # Structured JSON logger
  storage/                  # SQLite: database, migrations, repositories
  decisions/                # Decision cache manager
  rules/                    # Rule registry + threat rule adapter
  scan/                     # Pipeline, PatternScanner, SecurityTransform
  ipc/                      # Socket client, protocol, transports
  confirmation/             # Confirmation state machine
  commands/                 # CLI commands (run, status, rules, audit, decisions)

apps/desktop/               # [EXPERIMENTAL] Desktop app - not production-ready
  src/                      # React frontend (TrayPanel, Dashboard, ConfirmationWindow)
  src-tauri/src/            # Rust backend (IPC server, database reader, commands)

data/
  default-threat-rules.json # 243 bundled threat rules

tests/
  storage/                  # SQLite + repository tests
  decisions/                # Decision manager tests
  rules/                    # Threat rule adapter tests
  scan/                     # Pipeline + transform tests
  ipc/                      # Socket client tests
  confirmation/             # Confirmation flow tests
  integration/              # End-to-end flow tests
```

## Performance Budget

| Operation | Budget | Actual |
|-----------|--------|--------|
| Pattern scan (243 rules) | < 5ms p95 | < 1ms |
| Decision cache lookup | < 1ms | < 0.1ms |
| IPC round-trip | < 100ms | depends on user |
| SQLite audit write | < 2ms | < 1ms |

## Privacy Model

All data stays local. No network access except optional GitHub Releases API for update checks (disable via config).
