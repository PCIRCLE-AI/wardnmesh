# Contributing to WardNMesh

Thank you for your interest in contributing to WardNMesh!

## Development Setup

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for development environment setup.

## How to Contribute

### Reporting Issues

- Search existing issues before creating a new one
- Use the issue templates when available
- Include reproduction steps for bugs

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Write tests for your changes
4. Ensure all tests pass: `npm test`
5. Ensure code passes lint: `npm run lint`
6. Commit with descriptive messages
7. Push and create a Pull Request

### Commit Messages

We follow conventional commits:

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
```

Examples:
- `feat(scanner): add PII detection`
- `fix(mcp): handle empty path parameter`
- `docs(api): update security_check examples`

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Keep functions focused and testable

## Project Structure

```
wardnmesh/
├── packages/
│   ├── mcp-server/    # MCP server implementation
│   └── core/          # Shared scanning logic
├── apps/
│   └── web/           # Dashboard application
└── docs/              # Documentation
```

## Questions?

Open an issue or discussion for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.
