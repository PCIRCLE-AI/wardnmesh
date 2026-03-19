# Quick Reference - wardnmesh.ai Deployment

## Status Check (One Command)

```bash
curl -s https://wardnmesh.ai/api/health | jq
```

**Expected Output**:
```json
{
  "status": "healthy",
  "checks": {
    "database": "up"
  },
  "timestamp": "2026-01-18T10:25:00.000Z"
}
```

---

## Deployment Commands

### Full Build & Deploy (Recommended)

```bash
cd /Users/ktseng/Developer/Projects/agent-guard/apps/web

# Build with environment variables
NEXT_PUBLIC_SITE_URL=https://wardnmesh.ai npm run build:cloudflare

# Deploy to Cloudflare Pages
npx wrangler pages deploy .open-next --project-name wardnmesh-ai --branch master
```

### Quick Deploy (After build)

```bash
cd /Users/ktseng/Developer/Projects/agent-guard/apps/web
npx wrangler pages deploy .open-next --project-name wardnmesh-ai --branch master
```

---

## Verification Tests

### Test Homepage
```bash
curl -I https://wardnmesh.ai
# Expected: HTTP/2 307 (redirect to /en)
```

### Test Localized Page
```bash
curl -I https://wardnmesh.ai/en
# Expected: HTTP/2 200
```

### Test API Health
```bash
curl https://wardnmesh.ai/api/health
# Expected: {"status":"healthy","checks":{"database":"up"}}
```

### Test CSRF Protection
```bash
curl -X POST "https://wardnmesh.ai/api/stripe/checkout" \
  -H "Origin: https://wardnmesh.ai" \
  -H "Content-Type: application/json" \
  -d '{"priceId":"test"}'
# Expected: {"error":"Unauthorized"} (401)
```

---

## Common Issues & Solutions

### Issue: Website shows 404

**Cause**: Missing `_worker.js` file

**Solution**: Build script automatically handles this now
```bash
npm run build:cloudflare
# This copies worker.js to _worker.js
```

### Issue: CSRF validation failing (403 errors)

**Cause**: Missing `NEXT_PUBLIC_SITE_URL` environment variable

**Solution**: 
1. Set in Cloudflare Dashboard: `NEXT_PUBLIC_SITE_URL=https://wardnmesh.ai`
2. Or rebuild with: `NEXT_PUBLIC_SITE_URL=https://wardnmesh.ai npm run build:cloudflare`

### Issue: Deployment not showing up

**Cause**: Git auto-deploy not configured

**Solution**: Use manual deploy command (see above)

---

## Cloudflare Dashboard Links

- **Main Dashboard**: https://dash.cloudflare.com/9f71b95bf98f32237c14667a75522c4d/pages/view/wardnmesh-ai
- **Deployments**: Go to "Deployments" tab
- **Settings**: Go to "Settings" tab
- **Environment Variables**: Settings → Environment variables

---

## Important Files

### Build Configuration
- `apps/web/package.json` - Build scripts
- `apps/web/wrangler.toml` - Cloudflare config
- `apps/web/next.config.ts` - Next.js config
- `apps/web/open-next.config.ts` - OpenNext config

### Documentation
- `DEPLOYMENT_SUCCESS_SUMMARY.md` - Overview
- `apps/web/DEPLOYMENT_FIX_2026-01-18.md` - Technical details
- `apps/web/WEBSITE_RESTORED_2026-01-18.md` - Restoration report

---

## Environment Variables

### Build-time (Next.js)
```bash
NEXT_PUBLIC_SITE_URL=https://wardnmesh.ai
```

### Runtime (Cloudflare)
Set in Cloudflare Dashboard:
- Name: `NEXT_PUBLIC_SITE_URL`
- Value: `https://wardnmesh.ai`
- Environment: Production
- Type: Plain text

---

## Monitoring Setup (TODO)

### Uptime Monitoring
1. Create account at UptimeRobot or Pingdom
2. Add monitor for: https://wardnmesh.ai
3. Configure alerts to email

### Error Tracking
1. Create Sentry account
2. Add Sentry DSN to environment variables
3. Install `@sentry/nextjs` package
4. Configure in `next.config.ts`

---

## Emergency Contacts

- **Cloudflare Support**: https://dash.cloudflare.com/?to=/:account/support
- **Project Repository**: https://github.com/PCIRCLE-AI/wardnmesh

---

**Last Updated**: 2026-01-18 10:25 GMT+8
**Current Status**: ✅ OPERATIONAL
