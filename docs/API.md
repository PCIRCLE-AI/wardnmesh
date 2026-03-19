# wardn CLI Reference

## Commands

### wardn run <command> [args...]

Wrap a command with real-time threat detection.

```bash
wardn run claude
wardn run cursor
wardn run -- python script.py
```

**Behavior:**
- Spawns `<command>` as subprocess (no shell, prevents injection)
- Pipes stdin/stdout through SecurityTransform
- Scans each chunk against 243 threat rules
- On violation: pauses stream, requests confirmation
- Logs all events to SQLite audit log

**Exit code:** Matches the wrapped command's exit code.

### wardn status

Show system health and configuration.

```bash
wardn status
```

**Output includes:**
- CLI version
- Rules loaded (total, enabled, disabled)
- Database path and size
- Desktop socket connection status

### wardn rules <subcommand>

Manage threat detection rules.

```bash
# List all rules
wardn rules list
wardn rules list --category=safety

# Enable/disable specific rules
wardn rules enable wm-code-001
wardn rules disable wm-code-001
```

**Rule categories:** safety, network_boundary, workflow, quality
**Severity levels:** critical, major, minor

### wardn audit [options]

View the audit log.

```bash
wardn audit
wardn audit --limit=5
wardn audit --severity=critical
```

**Output per entry:** timestamp, severity, action (allow/block), rule name, source (desktop/terminal/cache/timeout)

### wardn decisions <subcommand>

Manage cached allow/block decisions.

```bash
# List all cached decisions
wardn decisions list
wardn decisions list --scope=always

# Clear decisions by scope
wardn decisions clear --scope=session
wardn decisions clear --scope=always
```

**Scopes:**
- `once` — not cached (single use)
- `session` — cached in memory for current CLI session
- `project` — cached in SQLite, scoped to project directory
- `always` — cached in SQLite, applies globally

### wardn doctor [options]

System health check.

```bash
wardn doctor
wardn doctor --verbose
wardn doctor --fix
```

### wardn check-update [--force]

Check for CLI updates via GitHub Releases API.

## Confirmation Flow

When a threat is detected:

1. **Terminal mode** (primary): readline prompt on stderr -- works standalone, no additional setup required
2. **Desktop mode** (experimental, if Desktop app running): Native popup window with severity badge, countdown timer, scope selector. Note: the desktop app is not yet production-ready; tray menu does not work on macOS.

```
[critical] Code Injection - dangerous function detected
  Content: dangerous_func(userInput)...
  Allow? [N/y/s=session/p=project/a=always]:
```

**Timeout behavior:** ALL severities auto-BLOCK on timeout (fail-closed).

| Severity | Timeout |
|----------|---------|
| critical | 60s |
| major | 45s |
| minor | 30s |

## IPC Protocol

CLI ↔ Desktop communication uses newline-delimited JSON over Unix Domain Socket. (Desktop app is experimental.)

**Socket path:** `~/.wardnmesh/wardn.sock`
**Protocol version:** 1
**Max message size:** 64KB

### Message types

CLI → Desktop: `hello`, `confirmation_request`, `scan_event`, `goodbye`
Desktop → CLI: `welcome`, `confirmation_response`, `error`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (matches wrapped command) |
| 1 | Wrapped command failed or threat blocked |
| 2 | CLI usage error |
