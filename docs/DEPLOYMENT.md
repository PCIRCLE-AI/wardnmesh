# Installation & Deployment

## CLI Installation

### npm (recommended)
```bash
npm install -g @pcircle/wardnmesh
```

### From source
```bash
git clone <repo>
cd agent-guard
npm install
npm run build
npm link  # creates 'wardn' global command
```

### Verify installation
```bash
wardn --version
wardn doctor --verbose
```

## Desktop App (Experimental)

> **Warning:** The desktop app is experimental and not yet production-ready. Known issue: the system tray menu does not work on macOS due to a Tauri 2 platform limitation. The CLI is the recommended and fully functional interface.

### Build from source
```bash
cd apps/desktop
npm install
npm run tauri build
```

The built app will be in `apps/desktop/src-tauri/target/release/bundle/`.

### macOS
- `.dmg` installer in `bundle/dmg/`
- Drag to Applications folder
- **Known issue:** System tray menu does not function on macOS (Tauri 2 issue)

### Linux
- `.AppImage` in `bundle/appimage/`
- Make executable: `chmod +x WardnMesh.AppImage`

## Data Locations

| Path | Purpose |
|------|---------|
| `~/.wardnmesh/config.json` | User configuration |
| `~/.wardnmesh/wardnmesh.db` | SQLite database (audit log, decisions, rule overrides) |
| `~/.wardnmesh/wardn.sock` | IPC socket (Desktop ↔ CLI communication) |
| `~/.wardnmesh/logs/wardn.log` | Structured JSON logs (max 10MB, 5 rotated files) |
| `.wardnmesh.json` | Project-level rule overrides (in project root) |

## Configuration

### User config (~/.wardnmesh/config.json)
```json
{
  "version": 1,
  "scan": {
    "enabledCategories": ["safety", "network_boundary"],
    "minSeverity": "minor",
    "confirmationRequired": "major"
  },
  "confirmation": {
    "timeouts": {
      "critical": 60000,
      "major": 45000,
      "minor": 30000
    },
    "defaultAction": "block",
    "preferDesktop": true
  },
  "audit": {
    "retentionDays": 90,
    "maxDbSizeMb": 100
  }
}
```

### Project config (.wardnmesh.json)
```json
{
  "rules": {
    "wm-code-001": { "enabled": false }
  },
  "allowPatterns": [
    "eval\\(JSON\\.parse"
  ]
}
```

### Environment variables
```bash
WARDN_TIMEOUT_CRITICAL=90000    # Override critical timeout
WARDN_DEFAULT_ACTION=block      # Default action on timeout
WARDN_RETENTION_DAYS=30         # Audit log retention
```

## Uninstall

```bash
# Remove CLI
npm uninstall -g @pcircle/wardnmesh

# Remove data (optional)
rm -rf ~/.wardnmesh

# Remove Desktop app
# macOS: drag from Applications to Trash
# Linux: delete .AppImage file
```

## Security Notes

- SQLite database contains audit entries with truncated content previews (max 200 chars)
- IPC socket file permissions are set to 0600 (owner-only)
- No secrets or credentials are stored
- All operations are local — no network access required
