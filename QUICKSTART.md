# WardNMesh.AI - Quick Start Guide

Get started with WardNMesh in under 10 minutes.

If you are new, start here: [docs/START_HERE.md](docs/START_HERE.md)

## 📋 Prerequisites

- **Node.js**: v18 or higher
- **npm** or **yarn**: Latest version

## ✅ Core Use Cases (Pick One)

- **CI/CD Secrets Prevention**: scan repositories and block unsafe configs.
- **Runtime Tool Guardrails**: intercept and validate tool calls in production.
- **Team Audit & Compliance**: centralized rules and incident visibility.

## 🎯 Choose Your Path

### Path 1: CLI Wrapper (Fastest - 2 minutes)

**Best for**: Quick testing, language-agnostic protection

```bash
# Install globally
npm install -g @wardnmesh/cli

# Wrap your agent
wardn run -- claude
# or
wardn run -- python my_agent.py
```

**What happens?**
- Intercepts all file operations (Read/Edit/Delete)
- Validates tool calls against security rules
- Blocks dangerous operations (e.g., `rm -rf /`)
- Logs violations locally

---

### Path 2: Node.js SDK (Production - 10 minutes)

**Best for**: Production Node.js agents (Express, Next.js)

#### 1. Install

```bash
# Install from GitHub (npm package coming soon)
npm install github:PCIRCLE-AI/wardnmesh-sdk-node
```

#### 2. Initialize

```javascript
import { Wardn } from "@wardnmesh/sdk-node";

// Initialize at the start of your app
Wardn.init({
  apiKey: process.env.WARDN_API_KEY, // Optional for cloud features
  rules: {
    sequence: {
      "read-before-edit": {
        enabled: true,
        severity: "warning",
        action: "warn", // or "block"
      },
    },
    pattern: {
      "secret-exposure": {
        enabled: true,
        severity: "critical",
        action: "block",
      },
    },
  },
});
```

#### 3. Protect Tool Calls

**Option A: Automatic Interception**

```javascript
import { createOpenAI } from "@ai-sdk/openai";
import { Wardn } from "@wardnmesh/sdk-node";

const openai = Wardn.wrap(createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}));
```

**Option B: Manual Validation**

```javascript
import { Wardn } from "@wardnmesh/sdk-node";

async function handleToolCall(toolName, parameters) {
  // Validate before execution
  const validation = await Wardn.validateTool(toolName, parameters);

  if (validation.blocked) {
    console.error(`Blocked: ${validation.reason}`);
    return { error: validation.reason };
  }

  // Safe to execute
  const result = await executeTool(toolName, parameters);

  // Record execution
  await Wardn.recordExecution(toolName, parameters, result);

  return result;
}
```

#### 4. View Violations

```javascript
import { Wardn } from "@wardnmesh/sdk-node";

// Get session violations
const violations = Wardn.getViolations();
console.log(violations); // Array of violation objects
```

---

### Path 3: Web Dashboard (Team - 5 minutes)

**Best for**: Teams needing centralized management and analytics

#### 1. Sign Up

Visit [wardnmesh.ai](https://wardnmesh.ai) and create an account.

#### 2. Generate API Key

```bash
# In Dashboard → Settings → API Keys
# Click "Generate New Key"
# Copy: sk_live_xxxxxxxxxxxxx
```

#### 3. Configure SDK

```bash
# Add to .env
WARDN_API_KEY=sk_live_xxxxxxxxxxxxx
```

#### 4. View Incidents

- **Dashboard**: Real-time violation feed
- **Analytics**: Trends and patterns
- **Rules**: Enable/disable global threat rules
- **Team**: Invite members and manage permissions

---

## 🔧 Configuration Options

### Local Rules (No Cloud)

```javascript
// .wardnrc.json
{
  "rules": {
    "sequence": {
      "read-before-edit": {
        "enabled": true,
        "severity": "warning",
        "action": "warn",
        "config": {
          "lookback": 10,
          "maxTimeSinceMatch": 5000
        }
      }
    },
    "pattern": {
      "secret-exposure": {
        "enabled": true,
        "severity": "critical",
        "action": "block",
        "patterns": [
          "sk-[a-zA-Z0-9]{48}",    // OpenAI API Key
          "ghp_[a-zA-Z0-9]{36}",   // GitHub PAT
          "AKIA[0-9A-Z]{16}"       // AWS Access Key
        ]
      }
    }
  }
}
```

### Cloud-Synced Rules

```javascript
Wardn.init({
  apiKey: process.env.WARDN_API_KEY,
  syncRules: true, // Fetch from cloud
  localOverrides: {
    // Override cloud rules locally
    "read-before-edit": { action: "warn" }
  }
});
```

---

## 🧪 Testing Your Setup

### 1. Test Secret Detection

```javascript
// This should be BLOCKED
const apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG";
console.log(apiKey); // ❌ Violation: Secret Exposure
```

### 2. Test Sequence Violation

```javascript
// This should trigger WARNING
await edit_file("config.json", "{}"); // ❌ Violation: Edit without Read

// This is SAFE
const content = await read_file("config.json"); // ✅ Read first
await edit_file("config.json", "{}"); // ✅ Now safe
```

### 3. View Violations

```bash
# CLI
wardn violations

# SDK
Wardn.getViolations().forEach(v => console.log(v));
```

---

## 📚 Next Steps

- [**Architecture Guide**](docs/ARCHITECTURE.md) - Understand the internals
- [**Rule Customization**](docs/RULES.md) - Write custom security rules
- [**Deployment Guide**](docs/DEPLOYMENT.md) - Self-host with Supabase
- [**API Reference**](docs/API.md) - Full SDK documentation

---

## 🆘 Troubleshooting

### "Module not found: @wardnmesh/sdk-node"

```bash
# Install from GitHub repository
npm install github:PCIRCLE-AI/wardnmesh-sdk-node --save
```

### "Invalid API Key"

1. Check `.env` file exists
2. Verify key format: `sk_live_xxxxx`
3. Regenerate key in Dashboard

### "Rules not loading"

```javascript
// Enable debug mode
Wardn.init({
  debug: true,
  apiKey: process.env.WARDN_API_KEY
});
```

### "Outdated version" warning

Update to the latest version:
```bash
npm update -g @wardnmesh/cli
npm update -g @pcircle/wardnmesh-mcp-server
```

Check your installation health:
```bash
wardn doctor
```

### Update check fails or is slow

Disable automatic update checks in CI/CD:
```bash
export WARDN_NO_UPDATE_CHECK=1
```

Force a manual check:
```bash
wardn check-update --force
```

### "Too many false positives"

```javascript
// Adjust severity threshold
Wardn.init({
  minSeverity: "high", // Only block critical/high
  rules: {
    "read-before-edit": { action: "warn" } // Downgrade to warning
  }
});
```

---

## 💬 Support

- **Discord**: [discord.gg/wardnmesh](https://discord.gg/wardnmesh)
- **GitHub Issues**: [github.com/PCIRCLE-AI/wardnmesh](https://github.com/PCIRCLE-AI/wardnmesh/issues)
- **Email**: support@wardnmesh.ai
