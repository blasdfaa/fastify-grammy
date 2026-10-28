# Migrating from 0.1.0 to 0.2.0

Version 0.2.0 is a breaking release. It supports Fastify 5, Node.js 22+, ESM, and CommonJS; its supported consumer compiler is TypeScript 6.0.3. Create and configure your grammY Bot in the application, select delivery explicitly, and use a scoped registry to access it.

See the [README](../README.md) for complete examples and the [changelog](../CHANGELOG.md) for the release changes.

## Replace plugin-owned Bot construction

In 0.1.0, registration constructed a Bot and implicitly started polling:

```js
await app.register(fastifyGrammy, {
  token: process.env.BOT_TOKEN,
  config: botConfig,
  middlewares: [middleware],
})
```

In 0.2.0, use grammY's own constructor and middleware interface. Configure commands, session, API transformers, custom context, and `bot.catch` before registration. Registration can trigger boot; adding middleware after `await app.register(...)` can be too late.

```js
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot, session } from 'grammy'

const app = Fastify({ logger: true, pluginTimeout: 35_000 })
const bot = new Bot(process.env.BOT_TOKEN)
bot.use(session({
  initial: () => ({ count: 0 })
}))
bot.command('count', async (ctx) => {
  ctx.session.count += 1
  await ctx.reply(String(ctx.session.count))
})
bot.catch(error => app.log.error({ updateId: error.ctx.update.update_id }, 'Bot update failed'))

await app.register(fastifyGrammy, { bot, mode: 'polling' })
await app.listen({ port: 3000 })
```

If you had `config`, pass it as the second argument to `new Bot(token, config)`. Replace `middlewares` with `bot.use(...)`. There are no plugin `token`, `config`, `middlewares`, or setup callback options. One registration accepts one prepared Bot.

## Choose a mode explicitly

| Mode | Plugin behavior | Application responsibility |
| --- | --- | --- |
| `polling` | Initializes, starts polling, observes errors, and drains on close | Configure middleware and error policy; authorize polling's remote effects |
| `webhook` | Initializes, exposes a secret-protected local POST route, and drains accepted updates | Provision the public HTTPS URL and Telegram webhook |
| `manual` | Provides scoped lookup without `init`, `start`, `stop`, or drain | Own initialization, delivery or external runner, errors, and shutdown |

`mode` has no default. Move polling-specific options into `pollingOptions`; grammY's options, including asynchronous `onStart`, retain their behavior.

```js
await app.register(fastifyGrammy, {
  bot,
  mode: 'polling',
  pollingOptions: {
    allowed_updates: ['message'],
    onStart: async (info) => {
      app.log.info({ username: info.username }, 'Polling starts')
    },
  },
})
```

**Polling changes remote Telegram configuration:** grammY calls `deleteWebhook` before polling. Choosing this mode can switch updates away from an existing webhook, including one used by another deployment. Review deployment ownership before starting it. Set `drop_pending_updates` only when intentionally discarding queued updates.

## Replace both decorator shapes with registry lookup

| 0.1.0 | 0.2.0 |
| --- | --- |
| `app.grammy` as a single Bot | `app.grammy.get('default')` |
| `app.grammy.support` or `app.grammy['support']` | `app.grammy.get('support')` |
| Shape changes depending on Bot count | One registry interface for every count and mode |
| `name` omitted | Registered as `default` |

Name every registration other than `default` explicitly:

```js
await app.register(fastifyGrammy, { bot: supportBot, name: 'support', mode: 'polling' })
app.grammy.get('support')
app.grammy.status('support')
```

The registry returns the original Bot instance. Accessing an absent or invisible name throws `FST_ERR_GRAMMY_BOT_NOT_FOUND`.

## Replace Fastify augmentation with the application map

Remove your old `FastifyInstance.grammy` declaration and imports of `FastifyGrammyBot`. The plugin declares the registry property. Extend the package's `FastifyGrammyBots` interface instead, using the full Bot type for each name. Include `default` explicitly when using it.

This complete example preserves custom fields and a session flavor:

```ts
import type { Context, SessionFlavor } from 'grammy'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot, session } from 'grammy'

interface SessionData {
  count: number
}

type SupportContext = Context & SessionFlavor<SessionData> & {
  tenant: string
}

declare module 'fastify-grammy' {
  interface FastifyGrammyBots {
    default: Bot<Context>
    support: Bot<SupportContext>
  }
}

async function main() {
  const defaultToken = process.env.BOT_TOKEN
  const supportToken = process.env.SUPPORT_BOT_TOKEN
  if (!defaultToken || !supportToken)
    throw new Error('BOT_TOKEN and SUPPORT_BOT_TOKEN are required')

  const app = Fastify()
  const defaultBot = new Bot(defaultToken)
  const supportBot = new Bot<SupportContext>(supportToken)
  supportBot.use(session({
    initial: (): SessionData => ({ count: 0 })
  }))
  supportBot.use(async (ctx, next) => {
    ctx.tenant = 'support'
    await next()
  })
  supportBot.command('count', async (ctx) => {
    ctx.session.count += 1
    await ctx.reply(`${ctx.tenant}: ${ctx.session.count}`)
  })

  await app.register(fastifyGrammy, { bot: defaultBot, mode: 'manual' })
  await app.register(fastifyGrammy, { bot: supportBot, name: 'support', mode: 'manual' })
  await app.ready()
  const support: Bot<SupportContext> = app.grammy.get('support')
  console.log(support === supportBot)
  await app.close()
}

void main()
```

In TypeScript, an undeclared name or a Bot with the wrong context for that name is rejected. The map has no permissive fallback. It describes names across the application, while runtime visibility still follows Fastify scopes. Use `NodeNext` or another compatible Node-aware module resolution strategy. Shared ESM/CommonJS declarations are checked with TypeScript 6.0.3, which is also used for build and lint tool compatibility. Older compiler versions are outside the supported matrix.

## Review scopes and ownership

A Bot registered in a parent scope is visible in descendants. Local registrations stay out of the parent and siblings. You cannot shadow a visible name. Independent sibling scopes may register the same local name with separate Bot instances of its declared type.

One Bot instance cannot belong to multiple simultaneous registrations, even in manual mode. A Telegram token cannot have multiple simultaneous managed registrations within one Fastify application, across scopes and across polling/webhook modes. Managed modes accept an already-initialized Bot but reject an already-running Bot; manual accepts external execution. Separate processes and deployments require your own coordination. No new guarantee is made about reusing an instance or switching modes after registration has completed.

## Provision webhook delivery separately

The new webhook mode owns the local endpoint only. Both `path` and `secretToken` are required; prefixes follow Fastify routing rules.

```js
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

const { BOT_TOKEN, WEBHOOK_SECRET, PUBLIC_ORIGIN } = process.env
if (!BOT_TOKEN || !WEBHOOK_SECRET || !PUBLIC_ORIGIN)
  throw new Error('BOT_TOKEN, WEBHOOK_SECRET, and PUBLIC_ORIGIN are required')

const app = Fastify({ pluginTimeout: 35_000 })
const bot = new Bot(BOT_TOKEN)
bot.command('start', ctx => ctx.reply('Hello!'))

await app.register(fastifyGrammy, {
  bot,
  mode: 'webhook',
  path: '/updates',
  prefix: '/telegram',
  secretToken: WEBHOOK_SECRET,
})
await app.listen({ port: 3000, host: '0.0.0.0' })

// Run only when this deployment is reachable over HTTPS.
await bot.api.setWebhook(new URL('/telegram/updates', PUBLIC_ORIGIN).href, {
  secret_token: WEBHOOK_SECRET,
})
```

Telegram must send the matching `X-Telegram-Bot-Api-Secret-Token` header. Account for every enclosing route prefix when constructing the public URL. You can run `setWebhook` from a separate provisioning job instead of application startup. The plugin never calls `setWebhook` or `deleteWebhook` in webhook mode, on startup or shutdown. If retiring delivery, the deployment may explicitly call `bot.api.deleteWebhook()` after checking ownership; a rolling replacement must avoid removing the new deployment's webhook.

Webhook update errors before the response follow Fastify error handling, rather than polling's `bot.catch`. Your Bot's configured webhook reply behavior is preserved. After an early successful response, later failures are logged and notified via `onError`; the response cannot be changed, and Telegram redelivery is not guaranteed. An HTTP timeout does not cancel the update task.

## Make startup and shutdown part of application readiness

Managed modes now wait for Bot initialization. Polling also waits for actual startup, including asynchronous `pollingOptions.onStart`. Startup errors and timeout reject Fastify readiness and trigger abort and cleanup of started work, rather than being silently swallowed. Configure `startupTimeoutMs` when the default **30 seconds** is unsuitable.

Fastify's `pluginTimeout` is a separate, potentially earlier deadline. The plugin does not override it. Set a sufficient host budget, for example `Fastify({ pluginTimeout: 35_000 })` for one default-budget Bot, with more room for additional Bots or boot hooks. Manual mode does not use a plugin startup timeout.

After startup, inspect `app.grammy.status(name)` for the mode, lifecycle state, and optional error. It returns a snapshot. Fatal managed failures set `failed`, log, and notify `onError({ name, mode, error }, scope)`. Ordinary polling update errors retain your `bot.catch` policy; webhook errors retain Fastify's error handling, with post-response errors also reported to `onError`. The plugin never automatically restarts the Bot, closes Fastify, or exits the process.

Always await `app.close()`. Managed shutdown drains complete update work: polling awaits both `stop()` and its full `start()` promise; webhook awaits middleware even after an early response or HTTP timeout. No finite callback timeout detaches this work. A hung handler can hold close open indefinitely, so set the overall process deadline in the application or deployment. Close dependent resources after handlers finish. The plugin cannot forcibly cancel arbitrary JavaScript middleware.

Manual mode leaves external execution alone. If you use an external runner, retain its handle, stop it, and await its complete task yourself; closing Fastify is not a substitute for that drain.

## Installation, tooling, and tests

Consumers no longer run a `lefthook` install hook and do not need the library's development dependencies. ESM and CommonJS runtime exports have matching declarations and share the same application map.

Node.js 22+ is the runtime minimum. The development toolchain needs Node 22.22.2+ or 24.15+ on those lines, or a newer supported line. Use the repository's [pinned Node version](../.node-version), [package manager](../package.json), and lockfile for development. Maintainers can opt into hooks with `pnpm hooks:install`.

Remove any test reliance on `TEST=true`; it no longer changes production behavior. Prepare a real Bot with an offline `client.fetch` transport returning valid Telegram API responses. Await teardown and exercise the public `register`, `ready`, `inject`, and `close` interface. Test import/require and declarations against the built package or tarball, rather than private source paths.
