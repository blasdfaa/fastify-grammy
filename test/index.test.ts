import type { FastifyInstance } from 'fastify'
import type { Context } from 'grammy'
import Fastify from 'fastify'
import { Bot } from 'grammy'
import { afterEach, expect, it } from 'vitest'
import { fastifyGrammy } from '../src'
import { botInfo, deferred, telegram } from './helpers/telegram'

interface CustomContext extends Context { marker: string }

declare module '../src' {
  interface FastifyGrammyBots {
    default: Bot<CustomContext>
    parent: Bot<CustomContext>
    local: Bot<CustomContext>
    sibling: Bot<CustomContext>
    constructor: Bot<CustomContext>
    toString: Bot<CustomContext>
    __proto__: Bot<CustomContext>
  }
}

const apps: FastifyInstance[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.close()))
})
function app() {
  const instance = Fastify()
  apps.push(instance)
  return instance
}

it('provides the prepared default bot in manual mode without initializing it', async () => {
  const instance = app()
  const bot = new Bot<CustomContext>('manual-token', {
    client: {
      fetch: async () => {
        throw new Error('manual mode must not contact Telegram')
      },
    },
  })
  instance.register(fastifyGrammy, { bot, mode: 'manual' })
  await instance.ready()
  expect(instance.grammy.get('default')).toBe(bot)
  expect(bot.isInited()).toBe(false)
  expect(instance.grammy.status('default')).toEqual({ mode: 'manual', state: 'manual' })
  await instance.close()
})

it('inherits parent bots while keeping child and sibling registrations isolated', async () => {
  const instance = app()
  const parentBot = new Bot<CustomContext>('parent-token')
  const first = new Bot<CustomContext>('local-one')
  const second = new Bot<CustomContext>('local-two')
  instance.register(fastifyGrammy, { name: 'parent', bot: parentBot, mode: 'manual' })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, { name: 'local', bot: first, mode: 'manual' })
    scope.get('/one', () => ({ local: scope.grammy.get('local').token, parent: scope.grammy.get('parent').token }))
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, { name: 'local', bot: second, mode: 'manual' })
    scope.get('/two', () => ({ local: scope.grammy.get('local').token, parent: scope.grammy.get('parent').token }))
  })
  await instance.ready()
  expect((await instance.inject('/one')).json()).toEqual({ local: 'local-one', parent: 'parent-token' })
  expect((await instance.inject('/two')).json()).toEqual({ local: 'local-two', parent: 'parent-token' })
  expect(() => instance.grammy.get('local')).toThrow('not registered in this Fastify scope')
})

it('rejects one Bot instance registered twice even in independent scopes', async () => {
  const instance = app()
  const bot = new Bot<CustomContext>('shared-instance')
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, { name: 'local', bot, mode: 'manual' })
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, { name: 'local', bot, mode: 'manual' })
  })
  await expect(instance.ready()).rejects.toThrow('This Bot instance is already registered')
})

it('rejects missing mode rather than starting polling implicitly', async () => {
  const instance = app()
  const bot = new Bot<CustomContext>('missing-mode')
  // @ts-expect-error mode is required at the public seam
  instance.register(fastifyGrammy, { bot })
  await expect(instance.ready()).rejects.toThrow('mode must be polling, webhook, or manual')
})

it.each(['constructor', 'toString', '__proto__'] as const)('supports the literal name %s', async (name) => {
  const instance = app()
  const bot = new Bot<CustomContext>(`special-${name}`)
  instance.register(fastifyGrammy, { name, bot, mode: 'manual' })
  await instance.ready()
  expect(instance.grammy.get(name)).toBe(bot)
})

it('rejects a visible parent name in a descendant scope', async () => {
  const instance = app()
  instance.register(fastifyGrammy, {
    name: 'parent',
    bot: new Bot<CustomContext>('parent'),
    mode: 'manual',
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, {
      name: 'parent',
      bot: new Bot<CustomContext>('shadow'),
      mode: 'manual',
    })
  })
  await expect(instance.ready()).rejects.toThrow('Bot name \'parent\' is already visible')
})

it('does not report managed readiness until Telegram initialization finishes', async () => {
  const instance = app()
  const initialized = deferred<typeof botInfo>()
  const transport = telegram({
    getMe: () => initialized.promise,
  })
  const bot = new Bot<CustomContext>('managed-init', {
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, {
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
  })
  let ready = false
  const boot = instance.ready().then(() => {
    ready = true
  })
  await new Promise(resolve => setTimeout(resolve, 15))
  expect(ready).toBe(false)
  initialized.resolve(botInfo)
  await boot
  expect(bot.isInited()).toBe(true)
  expect(instance.grammy.status('default')).toEqual({ mode: 'webhook', state: 'running' })
})

it('rejects invalid managed startup budgets before boot', async () => {
  const instance = app()
  const bot = new Bot<CustomContext>('invalid-timeout', { botInfo })
  instance.register(fastifyGrammy, {
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
    startupTimeoutMs: -1,
  })
  await expect(instance.ready()).rejects.toThrow('startupTimeoutMs must be a finite positive number')
})

it('aborts initialization when the configured startup budget expires', async () => {
  const instance = app()
  const aborted = deferred<void>()
  const transport = telegram({
    getMe: ({ signal }) => new Promise((_, reject) => {
      const abort = () => {
        aborted.resolve()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      if (signal?.aborted)
        abort()
      else signal?.addEventListener('abort', abort, { once: true })
    }),
  })
  const bot = new Bot<CustomContext>('timeout-init', {
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, {
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
    startupTimeoutMs: 20,
  })
  await expect(instance.ready()).rejects.toThrow('startup exceeded 20 ms')
  await aborted.promise
  expect(bot.isInited()).toBe(false)
  expect(instance.grammy.status('default').state).toBe('failed')
})

it('reserves a managed Telegram token across independent scopes', async () => {
  const instance = app()
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, {
      name: 'local',
      bot: new Bot<CustomContext>('one-telegram-token', { botInfo }),
      mode: 'webhook',
      path: '/one',
      secretToken: 'secret',
    })
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, {
      name: 'local',
      bot: new Bot<CustomContext>('one-telegram-token', { botInfo }),
      mode: 'polling',
    })
  })
  await expect(instance.ready()).rejects.toThrow('already has a managed registration')
})

it('aborts a later sibling startup when Fastify reaches its earlier host timeout', async () => {
  const instance = Fastify({ pluginTimeout: 35 })
  apps.push(instance)
  const aborted = deferred<void>()
  const transport = telegram({
    getMe: ({ signal }) => new Promise((_, reject) => {
      const abort = () => {
        aborted.resolve()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      if (signal?.aborted)
        abort()
      else signal?.addEventListener('abort', abort, { once: true })
    }),
  })
  const second = new Bot<CustomContext>('later-sibling', {
    client: { fetch: transport.fetch },
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, {
      name: 'local',
      bot: new Bot<CustomContext>('first-sibling', { botInfo }),
      mode: 'webhook',
      path: '/one',
      secretToken: 'secret',
      startupTimeoutMs: 1000,
    })
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, {
      name: 'local',
      bot: second,
      mode: 'webhook',
      path: '/two',
      secretToken: 'secret',
      startupTimeoutMs: 1000,
    })
  })
  await expect(instance.ready()).rejects.toMatchObject({ code: 'FST_ERR_HOOK_TIMEOUT' })
  await aborted.promise
  expect(second.isInited()).toBe(false)
})
