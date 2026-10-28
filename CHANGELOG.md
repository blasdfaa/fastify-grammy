# Changelog

## 0.2.0 (unreleased)

### Breaking changes

- Target Fastify 5 and Node.js 22 or newer.
- Accept a configured grammY `Bot`, with an explicit polling, webhook, or manual mode.
- Access bots through a scoped, named registry instead of the former single/named decorator.

### Tooling

- Update runtime dependencies and development tools; retain TypeScript 6 for compiler API compatibility.
- Publish ESM, CommonJS, and their matching TypeScript declarations.
- Remove the consumer install hook; maintainers can opt in with `pnpm hooks:install`.
- Check Node.js 22, 24, and 26 on Linux, Windows, and macOS in CI.
- Add package metadata and the MIT license.

## v0.0.2
