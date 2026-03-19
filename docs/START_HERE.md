# Getting Started with WardnMesh

## What is WardnMesh?

A security scanner that wraps AI coding tools (like Claude Code) to detect and block dangerous operations in real-time.

## Install

```bash
npm install -g @pcircle/wardnmesh
```

## Use

```bash
# Wrap any AI tool
wardn run claude

# Check what's happening
wardn status

# View threat history
wardn audit --limit 10
```

## Optional: Desktop App (Experimental)

> **Note:** The desktop app is experimental and not production-ready. The system tray menu does not work on macOS due to a Tauri 2 issue. The CLI terminal prompts above are the primary and fully functional interface.

If you want to try the experimental desktop app for native confirmation popups:

```bash
cd apps/desktop
npm install
npm run tauri build
```

## What Happens When a Threat is Detected?

1. WardnMesh pauses the data stream
2. Shows a confirmation prompt in your terminal
3. You choose: Allow or Block
4. You can scope your decision: once, session, project, or always
5. Everything is logged to local audit (~/.wardnmesh/wardnmesh.db)

## Success Criteria

You'll know it's working when:
- `wardn status` shows rules loaded and database active
- Running `wardn run echo "eval(test)"` triggers a threat detection
- `wardn audit` shows the detection in the log
