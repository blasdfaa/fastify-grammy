# Changelog

## 0.2.0 (unreleased)

### Breaking changes

- Require Fastify 5 and Node.js 22+; validate public declarations with TypeScript 6.0.3.
- Accept one prepared grammY `Bot` per registration. Replace plugin `token`, `config`, and `middlewares` options with `new Bot(...)` and pre-registration grammY configuration.
- Require an explicit `mode`: `polling`, `webhook`, or `manual`.
- Replace the changing single/named decorator with a scoped registry: `app.grammy.get(name)` and `app.grammy.status(name)`. An omitted name means `default`.
- Replace `FastifyGrammyBot` and custom `FastifyInstance.grammy` augmentation with the exported `FastifyGrammyBots` application map.
- Enforce Bot instance ownership, one managed token owner per Fastify application, scoped name isolation, and no shadowing of visible names.

### Lifecycle and delivery

- Wait for managed Bot initialization and real polling startup, preserving asynchronous polling `onStart` and rejecting readiness on failure.
- Add a configurable 30-second startup budget with cancellation and cleanup, while observing Fastify's independent boot deadline.
- Add a local webhook POST endpoint with required path and secret, standard route prefixes, and external ownership of Telegram webhook provisioning.
- Track complete webhook update tasks after early replies or HTTP timeouts, preserve configured webhook replies, and report errors after a response.
- Add manual mode for application-owned execution without plugin initialization, start, stop, or drain.
- Expose lifecycle status and managed runtime error notifications without automatic restart, server close, or process exit.
- Preserve polling `bot.catch` and Fastify webhook error handling.
- Await full managed shutdown: polling stop and lifetime, and all accepted webhook update tasks, without an internal forced deadline.
- Remove the production `TEST=true` transport override and internal Bot factory.

### Packaging, tooling, and documentation

- Update runtime dependencies and development tools; retain TypeScript 6 for compiler API compatibility.
- Publish ESM and CommonJS with matching declarations and one shared application type map.
- Include the required fetch declarations for strict consumers of grammY's published types.
- Remove the consumer install hook; maintainers can opt in with `pnpm hooks:install`.
- Apply the Node.js 22, 24, and 26 CI matrix on Linux, Windows, and macOS, and build before package validation.
- Add package metadata and the MIT license.
- Rewrite usage and custom-context examples, add the [0.1.0 migration guide](./docs/migration-0.2.0.md), and run the playground directly with Node.

## v0.0.2
