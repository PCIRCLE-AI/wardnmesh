# Updating WardnMesh

## Check for Updates

```bash
wardn check-update
wardn check-update --force  # Skip cache
```

Update checks query the GitHub Releases API (no telemetry, no tracking).

## Update CLI

### npm
```bash
npm update -g @pcircle/wardnmesh
```

### From source
```bash
git pull
npm install
npm run build
```

## Update Desktop App

Download the latest release from GitHub Releases, or rebuild from source:

```bash
cd apps/desktop
git pull
npm install
npm run tauri build
```

## Version Migration

### Database
Schema migrations run automatically on CLI startup. No manual intervention needed.

### Configuration
Config format is versioned (`"version": 1`). Future versions will include automatic migration.

## Rollback

### CLI
```bash
npm install -g @pcircle/wardnmesh@<previous-version>
```

### Database
The database schema only adds tables/columns (never removes). Downgrading is safe.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `WARDN_NO_UPDATE_CHECK=1` | Disable update check on startup |

## Troubleshooting

```bash
# Verify installation
wardn --version
wardn doctor --verbose

# Check database integrity
sqlite3 ~/.wardnmesh/wardnmesh.db "PRAGMA integrity_check;"

# Reset database (if corrupted)
mv ~/.wardnmesh/wardnmesh.db ~/.wardnmesh/wardnmesh.db.backup
# CLI will create a fresh database on next run
```
