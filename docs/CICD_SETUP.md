# CI/CD Setup

## GitHub Actions Workflow

### CLI Build & Test

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx tsc --noEmit
```

### Desktop App Build (Experimental)

> **Note:** The desktop app is experimental. The tray menu does not work on macOS due to a Tauri 2 issue. This CI job validates that the desktop code compiles but the app is not production-ready.

```yaml
  desktop:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: dtolnay/rust-toolchain@stable
      - run: cd apps/desktop && npm ci
      - run: cd apps/desktop && npm run build
      - run: cd apps/desktop && cargo check --manifest-path src-tauri/Cargo.toml
```

### Release

```yaml
  release:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [test, desktop]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm publish authentication |

## Local Pre-commit Checks

```bash
# Required
npm run build && npm test

# Optional (experimental desktop app)
cd apps/desktop && npm run build
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```
