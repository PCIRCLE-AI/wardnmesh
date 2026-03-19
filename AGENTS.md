# WardnMesh.AI - AI Agent Context

This file provides context for OpenCode and other AI coding agents to understand the WardnMesh project structure and conventions.

## Project Overview

WardnMesh.AI (formerly AgentGuard) is a security middleware platform for AI agents ("The Immune System for AI Agents").
It uses a monorepo structure with TurboRepo (implied).

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, "Royal Indigo" Design System (Glassmorphism)
- **Database/Auth**: Supabase
- **Internationalization**: next-intl (5 languages: EN, ZH-TW, JA, ES, FR)

## Repository Structure

- `apps/web`: Main SaaS Dashboard and Landing Page.
  - `src/app/[locale]`: localized routes.
  - `src/components`: UI components.
  - `src/messages`: i18n JSON files.
- `apps/admin`: Admin dashboard (if applicable).
- `packages/sdk-node`: Node.js SDK for agents.

## Key Conventions

1. **Internationalization**: All text MUST be generic and use `useTranslations` hooks. Keys are in `src/messages/en.json`.
2. **Design**: Use `glass-panel` utility class for containers. Ensure "Royal Indigo" aesthetic.
3. **Icons**: Lucide React.
4. **State**: Server Actions for mutations, React Server Components (RSC) by default. Client components only when interaction is needed.

## Critical Workflows

- **Running Dev**: `npm run dev` in `apps/web`.
- **Testing**: `npx playwright test` (E2E).

## Recent Changes (Phase 26)

- Implemented `Dashboard.data` (Data Vault) and `rules_card` translations.
- Replaced `alert()` with `toast.error()` (Sonner).
- Added `nextjs-toploader` for navigation UX.
