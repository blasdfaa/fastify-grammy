# fastify-grammy

[![CI](https://github.com/blasdfaa/fastify-grammy/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/blasdfaa/fastify-grammy/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/fastify-grammy.svg?style=flat)](https://www.npmjs.com/package/fastify-grammy)

Connect a configured [grammY Bot](https://grammy.dev/guide/getting-started) to Fastify with scoped lookup, managed startup, and graceful shutdown.

Version 0.2.0 supports **Fastify 5 and Node.js 22+**, with consumer types tested on **TypeScript 6.0.3**. ESM and CommonJS are included. Upgrading from 0.1.0 requires changes: see the [migration guide](./docs/migration-0.2.0.md) and [changelog](./CHANGELOG.md).

## Install

```sh
npm install fastify fastify-grammy grammy
```

## Quick start: polling

Create the Bot and install its middleware before registering the plugin. Each registration takes one Bot and an explicit `mode`. The default name is `default`.

```js
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

// Fastify has its own boot deadline; allow more than the bot's 30s budget.
const app = Fastify({ logger: true, pluginTimeout: 35_000 })
const bot = new Bot(process.env.BOT_TOKEN)

bot.command('start', ctx => ctx.reply('Hello!'))
bot.catch(error => app.log.error({ updateId: error.ctx.update.update_id }, 'Bot update failed'))

await app.register(fastifyGrammy, {
  bot,
  mode: 'polling',
})

await app.listen({ port: 3000 })
app.grammy.get('default') // The original Bot instance.
```

Choosing `polling` allows grammY to call Telegram's `deleteWebhook` before polling. This can switch delivery away from a webhook used by another deployment. Configure `pollingOptions`, including `allowed_updates`, `drop_pending_updates`, and an asynchronous `onStart`, using the normal [grammY polling options](https://grammy.dev/ref/core/pollingoptions).

Configure session, commands, API transformers, context, and `bot.catch` directly on the Bot before registration. Awaiting `register`, `ready`, or `listen` can start Fastify boot; do not postpone middleware setup until after them.

## TypeScript: declare the application map

Extend `FastifyGrammyBots` from this package with the exact Bot type for each name. The plugin already declares `FastifyInstance.grammy`; do not redeclare that property. There is no implicit untyped map, even for `default`.

```ts
import type { Context } from 'grammy'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

declare module 'fastify-grammy' {
  interface FastifyGrammyBots {
    default: Bot<Context>
  }
}

async function main() {
  const token = process.env.BOT_TOKEN
  if (!token)
    throw new Error('BOT_TOKEN is required')

  const app = Fastify({ pluginTimeout: 35_000 })
  const bot = new Bot(token)
  bot.command('start', ctx => ctx.reply('Hello!'))

  await app.register(fastifyGrammy, { bot, mode: 'polling' })
  await app.ready()
  const registered: Bot<Context> = app.grammy.get('default')
  console.log(registered === bot)
  await app.close()
}

void main()
```

The map checks name/type pairs at registration and preserves the full Bot type during lookup. Use Node-aware TypeScript module resolution such as `NodeNext`. The supported consumer compiler is TypeScript 6.0.3. Checks cover NodeNext and Node16 resolution, including a mixed ESM/CommonJS application sharing one map.

### Session and custom context

Build the context with grammY, then put that Bot type in the map. This standalone example registers a named `counter` bot.

```ts
import type { Context, SessionFlavor } from 'grammy'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot, session } from 'grammy'

interface SessionData {
  count: number
}

type CounterContext = Context & SessionFlavor<SessionData> & {
  requestTag: string
}

declare module 'fastify-grammy' {
  interface FastifyGrammyBots {
    counter: Bot<CounterContext>
  }
}

async function main() {
  const token = process.env.BOT_TOKEN
  if (!token)
    throw new Error('BOT_TOKEN is required')

  const app = Fastify({ pluginTimeout: 35_000 })
  const bot = new Bot<CounterContext>(token)
  bot.use(session({
    initial: (): SessionData => ({ count: 0 })
  }))
  bot.use(async (ctx, next) => {
    ctx.requestTag = String(ctx.update.update_id)
    await next()
  })
  bot.command('count', async (ctx) => {
    ctx.session.count += 1
    await ctx.reply(`${ctx.requestTag}: ${ctx.session.count}`)
  })

  await app.register(fastifyGrammy, { name: 'counter', bot, mode: 'polling' })
  const counter: Bot<CounterContext> = app.grammy.get('counter')
  console.log(counter === bot)
  await app.ready()
  await app.close()
}

void main()
```

Choose appropriate session storage for production; the default grammY session storage lives in memory.

## Webhook

Webhook mode initializes the Bot and registers a local POST route. Both `path` and `secretToken` are required. Use an HTTPS URL reachable by Telegram in production.

```js
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

const { BOT_TOKEN, WEBHOOK_SECRET, PUBLIC_ORIGIN } = process.env
if (!BOT_TOKEN || !WEBHOOK_SECRET || !PUBLIC_ORIGIN)
  throw new Error('BOT_TOKEN, WEBHOOK_SECRET, and PUBLIC_ORIGIN are required')

const app = Fastify({ logger: true, pluginTimeout: 35_000 })
const bot = new Bot(BOT_TOKEN)
bot.command('start', ctx => ctx.reply('Hello from the webhook!'))

await app.register(fastifyGrammy, {
  bot,
  mode: 'webhook',
  path: '/updates',
  prefix: '/telegram',
  secretToken: WEBHOOK_SECRET,
  onError: ({ name, mode }, scope) => {
    scope.log.error({ name, mode }, 'Bot error after the HTTP response')
  },
})
await app.listen({ port: 3000, host: '0.0.0.0' })

// Deployment-owned provisioning, after this instance is reachable over HTTPS.
await bot.api.setWebhook(new URL('/telegram/updates', PUBLIC_ORIGIN).href, {
  secret_token: WEBHOOK_SECRET,
})
```

The plugin validates Telegram's `X-Telegram-Bot-Api-Secret-Token` header with grammY's adapter; a wrong secret does not reach Bot middleware. Route prefixes follow Fastify's normal rules. The example's endpoint is `/telegram/updates`; an enclosing scope prefix is also part of the public URL.

`setWebhook` is an explicit application or deployment operation. The plugin never calls it or removes the remote webhook in webhook mode, including on close. On decommission, the deployment can call `await bot.api.deleteWebhook()` if appropriate for the token's current owner. Avoid clearing another deployment's webhook during a rolling replacement.

Configure Fastify error handlers for webhook update failures before an HTTP response is sent. The plugin preserves grammY's optional webhook reply setting: an early successful response can precede middleware completion. A later error is logged and passed to `onError`; it cannot change the sent response or promise Telegram redelivery. Full update tasks stay tracked after an early response or an HTTP timeout. The callback has no finite internal timeout; an HTTP deadline does not cancel middleware.

## Manual: external lifecycle

Manual mode only provides scoped lookup. It does not initialize, start, stop, or drain the Bot. An already-running Bot is allowed.

```js
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

const app = Fastify()
const bot = new Bot(process.env.BOT_TOKEN)
bot.command('start', ctx => ctx.reply('Managed by the application'))

await app.register(fastifyGrammy, { bot, mode: 'manual' })
await app.ready() // No Telegram request from the plugin.

// Start your external runner here and retain its shutdown handle.
// The application owns the runner, Bot initialization, errors, and full drain.
console.log(app.grammy.get('default') === bot)
await app.close() // Leaves external execution alone.
```

For an external [`@grammyjs/runner`](https://grammy.dev/plugins/runner), install that optional package separately with `npm install @grammyjs/runner`. The following application explicitly starts and drains its runner. Its own hook supplies this behavior; manual mode does not add it.

```js
import { run } from '@grammyjs/runner'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

const app = Fastify({ logger: true })
const bot = new Bot(process.env.BOT_TOKEN)
bot.command('start', ctx => ctx.reply('Hello from the external runner!'))
bot.catch(error => app.log.error({ updateId: error.ctx.update.update_id }, 'Bot update failed'))

await bot.init() // Application-owned initialization and delivery setup.
await bot.api.deleteWebhook() // Explicitly switch this token to external polling.
const runner = run(bot)
const runnerTask = runner.task()
void runnerTask?.catch(() => app.log.error('External runner failed'))

app.addHook('onClose', async () => {
  await runner.stop()
  await runnerTask
})
await app.register(fastifyGrammy, { bot, mode: 'manual' })
await app.listen({ port: 3000 })

async function shutdown() {
  const deadline = setTimeout(() => process.exit(1), 30_000)
  deadline.unref()
  try {
    await app.close()
  }
  catch {
    process.exitCode = 1
  }
  finally {
    clearTimeout(deadline)
  }
}
process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
```

## Names, scopes, and ownership

Register each Bot separately, setting `name` for names other than `default`. Access every Bot with `app.grammy.get(name)` and its status with `app.grammy.status(name)`.

Fastify encapsulation applies: a child sees a parent's Bots; the parent and siblings do not see child registrations. An already-visible name cannot be shadowed. Independent sibling scopes can use the same local name for separate instances of the type declared in the global map. The type map describes allowed names and types; it does not make every name visible in every scope. Looking up an absent or invisible name throws `FST_ERR_GRAMMY_BOT_NOT_FOUND`.

A Bot instance can have only one simultaneous registration, including manual mode. Within a Fastify application, a Telegram token can have only one managed registration across polling and webhook modes and all scopes. Managed modes accept an initialized Bot but reject an already-running Bot. These checks do not coordinate separate processes or deployments.

## Readiness, errors, and shutdown

`await app.ready()` and `await app.listen(...)` wait for managed initialization and, for polling, startup including your asynchronous `pollingOptions.onStart`. They do not await the long-running polling loop. A startup error or timeout rejects Fastify readiness and triggers cancellation and cleanup of started work.

`startupTimeoutMs` defaults to `30_000` in managed modes. Fastify's independent `pluginTimeout` can expire earlier; the plugin does not override that host budget. Give Fastify enough time for startup, other boot hooks, and cleanup, for example `Fastify({ pluginTimeout: 35_000 })` for one Bot with the default budget. Applications with multiple Bots or slow boot work may need more time. Manual mode has no plugin startup budget.

`app.grammy.status(name)` returns a snapshot with `mode`, `state`, and an optional `error`. States are `registered`, `starting`, `running`, `stopping`, `stopped`, `failed`, and `manual`. `running` describes managed readiness, not a health probe of Telegram connectivity. Read a new snapshot to see later transitions.

Fatal managed failures after startup are logged, set state to `failed`, and notify `onError`. The callback receives `{ name, mode, error }` and the registration's Fastify scope. Your application chooses recovery and whether to close the server; the plugin does not restart the Bot, close Fastify, or exit the process. Errors in `onError` are logged. Polling keeps your `bot.catch` policy; an update error handled there does not automatically mark the Bot failed. Webhook errors before a response use Fastify's error handling; errors after a response also notify `onError`.

Managed `await app.close()` waits for all accepted updates. Polling waits for both `stop()` and the full `start()` promise. Webhook waits for full update tasks, including those continuing after an HTTP response or timeout. There is no forced shutdown deadline inside the library: a hung handler can hold `close()` open. Set the overall process deadline in your application or deployment, and close resources used by handlers after Bot work has drained. Arbitrary JavaScript middleware cannot be forcibly canceled by the plugin.

The plugin adds no update storage or deduplication. Design handlers for possible repeated Telegram delivery; distributed ownership and exactly-once processing belong to the application.

## CommonJS

```js
const Fastify = require('fastify')
const { fastifyGrammy } = require('fastify-grammy')
const { Bot } = require('grammy')

async function main() {
  const app = Fastify()
  const bot = new Bot(process.env.BOT_TOKEN)
  await app.register(fastifyGrammy, { bot, mode: 'manual' })
  await app.ready()
  console.log(app.grammy.get('default') === bot)
  await app.close()
}

void main()
```

## Playground and development

Runtime consumers need Node.js 22+. The development toolchain requires Node.js **22.22.2+ or 24.15+ on those release lines**, or a newer supported Node line. Use the version pinned in [`.node-version`](./.node-version) and the pnpm version in [`package.json`](./package.json). The project uses TypeScript 6 for build and lint tool compatibility.

```sh
pnpm install --frozen-lockfile
pnpm build
BOT_TOKEN=your-token pnpm --dir playground dev
pnpm check
```

The playground runs directly with Node and handles `SIGINT`/`SIGTERM` with `app.close()` and an application-owned process deadline. Its default polling mode contacts Telegram and can remove a configured webhook. For an offline manual smoke run, use `BOT_TOKEN=123456:offline BOT_MODE=manual pnpm --dir playground dev`; it serves HTTP without starting Bot delivery.

## License

[MIT](./LICENSE).
