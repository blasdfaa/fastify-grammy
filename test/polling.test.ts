import type { FastifyInstance } from 'fastify'
import type { Context } from 'grammy'
import type { FastifyGrammyError } from '../src'
import Fastify from 'fastify'
import { Bot } from 'grammy'
import { afterEach, expect, it } from 'vitest'
import { fastifyGrammy } from '../src'
import { botInfo, deferred, telegram, telegramError } from './helpers/telegram'

declare module '../src' {
  interface FastifyGrammyBots {
    polling: Bot<Context>
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

it('waits for async onStart before readiness and preserves polling options', async () => {
  const instance = app()
  const configured = deferred<void>()
  const transport = telegram()
  const bot = new Bot('polling-options', {
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, {
    name: 'polling',
    bot,
    mode: 'polling',
    pollingOptions: {
      allowed_updates: ['message'],
      drop_pending_updates: true,
      limit: 5,
      timeout: 7,
      onStart: () => configured.promise,
    },
  })
  let ready = false
  const boot = instance.ready().then(() => {
    ready = true
  })
  await new Promise(resolve => setTimeout(resolve, 15))
  try {
    expect(ready).toBe(false)
    expect(transport.requests.some(request => request.method === 'getUpdates')).toBe(false)
  }
  finally {
    configured.resolve()
  }
  await boot
  expect(bot.isRunning()).toBe(true)
  expect(instance.grammy.status('polling')).toEqual({ mode: 'polling', state: 'running' })
  expect(transport.requests.find(request => request.method === 'deleteWebhook')?.payload).toEqual({ drop_pending_updates: true })
  expect(transport.requests.find(request => request.method === 'getUpdates')?.payload).toMatchObject({
    allowed_updates: ['message'],
    limit: 5,
    timeout: 7,
  })
})

it('keeps close pending until an accepted polling update finishes', async () => {
  const instance = app()
  const handling = deferred<void>()
  const complete = deferred<void>()
  const transport = telegram({
    getUpdates: ({ payload }) => payload.limit === 1
      ? []
      : [
          {
            update_id: 1,
            message: {
              message_id: 1,
              date: 0,
              chat: { id: 1, type: 'private' },
              text: 'hello',
            },
          },
        ],
  })
  const bot = new Bot('polling-drain', {
    client: { fetch: transport.fetch },
  })
  let finished = false
  bot.on('message', async () => {
    handling.resolve()
    await complete.promise
    finished = true
  })
  instance.register(fastifyGrammy, { name: 'polling', bot, mode: 'polling' })
  await instance.ready()
  await handling.promise
  let closed = false
  const closing = instance.close().then(() => {
    closed = true
  })
  await new Promise(resolve => setTimeout(resolve, 15))
  try {
    expect(closed).toBe(false)
    expect(finished).toBe(false)
  }
  finally {
    complete.resolve()
    await closing
  }
  expect(finished).toBe(true)
  expect(bot.isRunning()).toBe(false)
})

it('rejects readiness if onStart stops the bot before polling begins', async () => {
  const instance = app()
  const transport = telegram()
  const bot = new Bot('polling-stopped-startup', {
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, {
    name: 'polling',
    bot,
    mode: 'polling',
    pollingOptions: {
      onStart: () => bot.stop(),
    },
  })
  await expect(instance.ready()).rejects.toThrow('Polling stopped')
  expect(bot.isRunning()).toBe(false)
  expect(instance.grammy.status('polling').state).toBe('failed')
})

it('preserves an async onStart rejection as the startup error', async () => {
  const instance = app()
  const error = new Error('application setup failed')
  const transport = telegram()
  const bot = new Bot('polling-onstart-error', {
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, {
    name: 'polling',
    bot,
    mode: 'polling',
    pollingOptions: {
      onStart: async () => {
        await Promise.resolve()
        throw error
      },
    },
  })
  await expect(instance.ready()).rejects.toBe(error)
  expect(instance.grammy.status('polling')).toMatchObject({ state: 'failed', error })
  expect(bot.isRunning()).toBe(false)
})

it.each(['deleteWebhook', 'getUpdates'] as const)('rejects boot when Telegram immediately refuses %s', async (method) => {
  const instance = app()
  const transport = telegram({
    [method]: () => telegramError(401, 'Unauthorized'),
  })
  const bot = new Bot(`polling-unauthorized-${method}`, {
    botInfo,
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, { name: 'polling', bot, mode: 'polling' })
  await expect(instance.ready()).rejects.toThrow('Unauthorized')
  expect(instance.grammy.status('polling').state).toBe('failed')
  expect(bot.isRunning()).toBe(false)
})

it('reports a later fatal polling error while leaving the HTTP server available', async () => {
  const logs: string[] = []
  const instance = Fastify({
    logger: {
      stream: {
        write: (line: string) => { logs.push(line) },
      },
    },
  })
  apps.push(instance)
  instance.get('/health', () => ({ ok: true }))
  const failedRequest = deferred<Response>()
  const notified = deferred<FastifyGrammyError>()
  const transport = telegram({
    getUpdates: () => failedRequest.promise,
  })
  const bot = new Bot('polling-runtime-fatal', {
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, {
    name: 'polling',
    bot,
    mode: 'polling',
    onError: event => notified.resolve(event),
  })
  await instance.ready()
  failedRequest.resolve(telegramError(409, 'another poller is running'))
  const event = await notified.promise
  expect(event).toMatchObject({
    name: 'polling',
    mode: 'polling',
    error: { error_code: 409 },
  })
  expect(instance.grammy.status('polling')).toMatchObject({ state: 'failed', error: event.error })
  expect(logs.some(line => line.includes('another poller is running'))).toBe(true)
  expect((await instance.inject('/health')).json()).toEqual({ ok: true })
  expect(bot.isRunning()).toBe(false)
})

it('rejects a startup deadline without waiting for uncancellable onStart or the final acknowledgement', async () => {
  const instance = app()
  const configured = deferred<void>()
  const acknowledged = deferred<unknown[]>()
  const transport = telegram({
    getUpdates: () => acknowledged.promise,
  })
  const bot = new Bot('polling-startup-timeout', {
    botInfo,
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, {
    name: 'polling',
    bot,
    mode: 'polling',
    startupTimeoutMs: 25,
    pollingOptions: {
      onStart: () => configured.promise,
    },
  })
  const result = await Promise.race([
    instance.ready().then(() => 'ready', (error: unknown) => error),
    new Promise(resolve => setTimeout(resolve, 150, 'readiness is still pending')),
  ])
  try {
    expect(result).toMatchObject({ code: 'FST_ERR_GRAMMY_STARTUP_TIMEOUT' })
    expect(bot.isRunning()).toBe(false)
    expect(instance.grammy.status('polling').state).toBe('failed')
  }
  finally {
    configured.resolve()
    acknowledged.resolve([])
    await instance.close()
  }
  expect(transport.requests.filter(request => request.method === 'getUpdates').every(request => request.payload.limit === 1)).toBe(true)
})

it('preserves bot.catch for update errors without failing managed polling', async () => {
  const instance = app()
  const handled = deferred<unknown>()
  const updateError = new Error('this update failed')
  const fatalErrors: unknown[] = []
  let delivered = false
  const transport = telegram({
    getUpdates: ({ payload, signal }) => {
      if (payload.limit === 1)
        return []
      if (!delivered) {
        delivered = true
        return [
          {
            update_id: 1,
            message: {
              message_id: 1,
              date: 0,
              chat: { id: 1, type: 'private' },
              text: 'hello',
            },
          },
        ]
      }
      return new Promise((_, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'))
        if (signal?.aborted)
          abort()
        else signal?.addEventListener('abort', abort, { once: true })
      })
    },
  })
  const bot = new Bot('polling-update-error', {
    client: { fetch: transport.fetch },
  })
  bot.on('message', () => {
    throw updateError
  })
  bot.catch(error => handled.resolve(error.error))
  instance.register(fastifyGrammy, {
    name: 'polling',
    bot,
    mode: 'polling',
    onError: (event) => { fatalErrors.push(event.error) },
  })
  await instance.ready()
  expect(await handled.promise).toBe(updateError)
  expect(instance.grammy.status('polling').state).toBe('running')
  expect(bot.isRunning()).toBe(true)
  expect(fatalErrors).toEqual([])
})

it('aborts deleteWebhook when the managed startup deadline expires', async () => {
  const instance = app()
  const aborted = deferred<void>()
  let configured = false
  const transport = telegram({
    deleteWebhook: ({ signal }) => new Promise((_, reject) => {
      const abort = () => {
        aborted.resolve()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      if (signal?.aborted)
        abort()
      else signal?.addEventListener('abort', abort, { once: true })
    }),
  })
  const bot = new Bot('polling-delete-timeout', {
    botInfo,
    client: { fetch: transport.fetch },
  })
  instance.register(fastifyGrammy, {
    name: 'polling',
    bot,
    mode: 'polling',
    startupTimeoutMs: 25,
    pollingOptions: {
      onStart: () => { configured = true },
    },
  })
  await expect(instance.ready()).rejects.toMatchObject({ code: 'FST_ERR_GRAMMY_STARTUP_TIMEOUT' })
  await aborted.promise
  expect(configured).toBe(false)
  expect(bot.isRunning()).toBe(false)
  expect(instance.grammy.status('polling').state).toBe('failed')
})

it('stops an earlier polling sibling when a later startup exceeds the Fastify host budget', async () => {
  const instance = Fastify({ pluginTimeout: 75 })
  apps.push(instance)
  const configured = deferred<void>()
  const firstTransport = telegram()
  const secondTransport = telegram()
  const first = new Bot('polling-first-sibling', {
    botInfo,
    client: { fetch: firstTransport.fetch },
  })
  const second = new Bot('polling-second-sibling', {
    botInfo,
    client: { fetch: secondTransport.fetch },
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, {
      name: 'polling',
      bot: first,
      mode: 'polling',
      startupTimeoutMs: 1000,
    })
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, {
      name: 'polling',
      bot: second,
      mode: 'polling',
      startupTimeoutMs: 1000,
      pollingOptions: {
        onStart: () => configured.promise,
      },
    })
  })
  try {
    await expect(instance.ready()).rejects.toMatchObject({ code: 'FST_ERR_HOOK_TIMEOUT' })
    await new Promise(resolve => setImmediate(resolve))
    expect(first.isRunning()).toBe(false)
    expect(second.isRunning()).toBe(false)
  }
  finally {
    configured.resolve()
  }
})
