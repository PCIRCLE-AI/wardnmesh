# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Web v1.0.1] - 2026-01-24

### Fixed
- **Support Form**: Fixed "Failed to submit support ticket" error
  - Root cause: `SUPABASE_SERVICE_ROLE_KEY` was configured with wrong format (project access token `sbp_...` instead of JWT `eyJ...`)
  - Updated environment variable to use correct service_role JWT key
- **i18n Translations**: Fixed missing translation keys causing `MISSING_MESSAGE: SupportPage.resources.documentation.title` error
  - Restructured `SupportPage` translations from flat keys to nested structure
  - Updated both `en.json` and `zh-TW.json` with correct nested format
  - Added missing keys: `resources.reportBug`, `resources.documentation`, `resources.github`, `status.down`

### Technical Details
- The `createAdminClient()` function requires the JWT-format service_role key (starts with `eyJ...`)
- Supabase project access tokens (`sbp_...`) are NOT valid for service_role operations
- i18n translation structure must match the `useTranslations()` call patterns in components

## [MCP Server v0.1.2] - 2026-01-15

### Fixed
- **CRITICAL**: Fixed Claude Code hooks v2 matcher format compatibility
  - Changed UserPromptSubmit matcher from empty object `{}` to wildcard string `"*"`
  - Changed PreToolUse matcher from object `{ toolNames: [...] }` to individual string matchers
  - Now generates separate hook configurations for each tool (Bash, Write, Edit)
  - Resolves issue where hooks were not being triggered due to incorrect matcher format

### Technical Details
- Updated TypeScript interface to support both string and object matcher types
- PreToolUse hooks now correctly generate as separate entries with string matchers
- Matches the expected Claude Code settings.json format for hooks v2

## [Desktop v0.1.1] - 2026-01-15

### Fixed
- Updated desktop app icons with correct WardnMesh logo
- Fixed GitHub Actions Rust toolchain action name (dtolnay/rust-toolchain)
- Improved artifact handling with recursive find for nested directories

### Changed
- Updated landing page download links to use versioned filenames
- Enhanced CI/CD workflow for more reliable builds

## [Desktop v0.1.0] - 2026-01-15

### Added
- Complete internationalization (i18n) support for desktop app
- Multi-language support: English, Traditional Chinese, Japanese, Spanish, French
- Setup Wizard with system check, CLI installation, and SDK installation steps
- Desktop application for macOS (Intel & Apple Silicon), Windows, and Linux

### Fixed
- Completed i18n for all SetupWizard components (SystemCheckStep, CliInstallStep, SdkInstallStep)
- Added missing translation keys across all language files
- Corrected desktop app download links on landing page

### Security
- Row Level Security (RLS) policies for database access
- Search path protection for all database functions
- Comprehensive security audit and fixes

## [Web v0.1.0] - 2026-01-14

### Added
- Landing page with download links for desktop app
- OAuth integration improvements
- Session persistence enhancements

### Fixed
- OAuth user experience improvements
- Session management reliability
