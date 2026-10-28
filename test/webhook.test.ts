import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import { Bot, Context } from 'grammy'
import { afterEach, expect, it, vi } from 'vitest'
import { fastifyGrammy } from '../src'
import { botInfo, deferred, telegram } from './helpers/telegram'

class WebhookContext extends Context {
  readonly marker = 'configured-context'
}

declare module '../src' {
  interface FastifyGrammyBots {
    webhook: Bot<Context>
    webhookCustom: Bot<WebhookContext>
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
const update = {
  update_id: 1,
  message: {
    message_id: 1,
    date: 0,
    chat: { id: 123, type: 'private' },
    from: { id: 123, is_bot: false, first_name: 'User' },
    text: 'Hello',
  },
}

it('handles authenticated webhook updates without changing Telegram configuration', async () => {
  const instance = app()
  const transport = telegram()
  const bot = new Bot('webhook-token', {
    client: { fetch: transport.fetch },
  })
  const messages: string[] = []
  bot.on('message:text', (ctx) => {
    messages.push(ctx.message.text)
  })
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'webhook-secret',
  })
  await instance.ready()
  const response = await instance.inject({
    method: 'POST',
    url: '/telegram',
    headers: { 'x-telegram-bot-api-secret-token': 'webhook-secret' },
    payload: update,
  })
  expect(response.statusCode).toBe(200)
  expect(messages).toEqual(['Hello'])
  expect(instance.grammy.get('webhook')).toBe(bot)
  await instance.close()
  expect(transport.requests.map(request => request.method)).toEqual(['getMe'])
})

it('rejects an empty webhook secret before accepting requests', async () => {
  const instance = app()
  const transport = telegram()
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot: new Bot('secret-token', {
      client: { fetch: transport.fetch },
    }),
    mode: 'webhook',
    path: '/telegram',
    secretToken: '',
  })
  await expect(instance.ready()).rejects.toMatchObject({
    code: 'FST_ERR_GRAMMY_INVALID_OPTIONS',
    message: 'Webhook secretToken must be a non-empty string',
  })
  expect(transport.requests).toEqual([])
})

it.each(['', 'telegram'])('requires an explicit absolute webhook path: %j', async (path) => {
  const instance = app()
  const transport = telegram()
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot: new Bot('path-token', {
      client: { fetch: transport.fetch },
    }),
    mode: 'webhook',
    path,
    secretToken: 'secret',
  })
  await expect(instance.ready()).rejects.toMatchObject({
    code: 'FST_ERR_GRAMMY_INVALID_OPTIONS',
    message: 'Webhook path must be a string beginning with /',
  })
})

it('keeps shutdown pending until middleware finishes after an early webhook reply', async () => {
  const instance = app()
  const release = deferred<void>()
  const entered = deferred<void>()
  const transport = telegram()
  const bot = new Bot('early-reply-token', {
    botInfo,
    client: {
      fetch: transport.fetch,
      canUseWebhookReply: method => method === 'sendMessage',
    },
  })
  bot.on('message:text', async (ctx) => {
    await ctx.reply('Accepted')
    entered.resolve()
    await release.promise
  })
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
  })
  await instance.ready()
  try {
    const response = await instance.inject({
      method: 'POST',
      url: '/telegram',
      headers: { 'x-telegram-bot-api-secret-token': 'secret' },
      payload: update,
    })
    expect(response.json()).toMatchObject({ method: 'sendMessage', text: 'Accepted' })
    await entered.promise
    let closed = false
    const closing = instance.close().then(() => {
      closed = true
    })
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(closed).toBe(false)
    release.resolve()
    await closing
    expect(closed).toBe(true)
    expect(transport.requests).toEqual([])
  }
  finally {
    release.resolve()
  }
})

it('reports an error after an early reply while keeping the bot and HTTP server running', async () => {
  const instance = app()
  const release = deferred<void>()
  const failure = new Error('late middleware failure')
  const errors: unknown[] = []
  const bot = new Bot('late-error-token', {
    botInfo,
    client: {
      canUseWebhookReply: method => method === 'sendMessage',
    },
  })
  bot.on('message:text', async (ctx) => {
    await ctx.reply('Accepted')
    await release.promise
    throw failure
  })
  instance.get('/health', () => 'ok')
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
    onError: (event) => {
      errors.push(event.error)
    },
  })
  await instance.ready()
  try {
    const response = await instance.inject({
      method: 'POST',
      url: '/telegram',
      headers: { 'x-telegram-bot-api-secret-token': 'secret' },
      payload: update,
    })
    expect(response.statusCode).toBe(200)
    release.resolve()
    await expect.poll(() => errors, { timeout: 100 }).toHaveLength(1)
    expect(errors[0]).toMatchObject({ error: failure })
    expect(instance.grammy.status('webhook').state).toBe('running')
    expect((await instance.inject('/health')).body).toBe('ok')
  }
  finally {
    release.resolve()
  }
})

it.each([undefined, 'wrong-secret'])('rejects an unauthenticated update with secret %j', async (secret) => {
  const instance = app()
  const bot = new Bot('auth-token', { botInfo })
  let handled = false
  bot.use(() => {
    handled = true
  })
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
  })
  const response = await instance.inject({
    method: 'POST',
    url: '/telegram',
    headers: secret === undefined
      ? {}
      : { 'x-telegram-bot-api-secret-token': secret },
    payload: update,
  })
  expect(response.statusCode).toBe(401)
  expect(handled).toBe(false)
})

it('inherits parent and registration prefixes while keeping the registry in the caller scope', async () => {
  const instance = app()
  const bot = new Bot('prefix-token', { botInfo })
  let handled = false
  bot.use(() => {
    handled = true
  })
  instance.register(async (scope) => {
    scope.register(fastifyGrammy, {
      name: 'webhook',
      bot,
      mode: 'webhook',
      prefix: '/bot',
      path: '/telegram',
      secretToken: 'secret',
    })
    scope.get('/registry', () => scope.grammy.get('webhook') === bot)
  }, { prefix: '/parent' })
  await instance.ready()
  const response = await instance.inject({
    method: 'POST',
    url: '/parent/bot/telegram',
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    payload: update,
  })
  expect(response.statusCode).toBe(200)
  expect(handled).toBe(true)
  expect((await instance.inject('/parent/registry')).json()).toBe(true)
  expect(instance.hasDecorator('grammy')).toBe(false)
})

it('passes ordinary middleware errors to Fastify without invoking bot.catch', async () => {
  const instance = app()
  const bot = new Bot('error-policy-token', { botInfo })
  const failure = new Error('webhook middleware failed')
  let pollingCatchCalled = false
  const lateErrors: unknown[] = []
  bot.catch(() => {
    pollingCatchCalled = true
  })
  bot.use(() => {
    throw failure
  })
  instance.setErrorHandler((error, _request, reply) => {
    expect(error).toMatchObject({ error: failure })
    reply.code(422).send({ policy: 'application' })
  })
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
    onError: (event) => {
      lateErrors.push(event.error)
    },
  })
  const response = await instance.inject({
    method: 'POST',
    url: '/telegram',
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    payload: update,
  })
  expect(response.statusCode).toBe(422)
  expect(response.json()).toEqual({ policy: 'application' })
  expect(pollingCatchCalled).toBe(false)
  expect(lateErrors).toEqual([])
  expect(instance.grammy.status('webhook').state).toBe('running')
})

it('waits for full processing after an application HTTP deadline has sent a response', async () => {
  const instance = app()
  const entered = deferred<void>()
  const release = deferred<void>()
  const bot = new Bot('deadline-token', { botInfo })
  bot.use(async () => {
    entered.resolve()
    await release.promise
  })
  instance.addHook('onRequest', async (_request, reply) => {
    setTimeout(() => {
      if (!reply.sent)
        reply.code(504).send('application deadline')
    }, 10)
  })
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
  })
  try {
    const request = instance.inject({
      method: 'POST',
      url: '/telegram',
      headers: { 'x-telegram-bot-api-secret-token': 'secret' },
      payload: update,
    })
    await entered.promise
    const response = await request
    expect(response.statusCode).toBe(504)
    let closed = false
    const closing = instance.close().then(() => {
      closed = true
    })
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(closed).toBe(false)
    release.resolve()
    await closing
    expect(closed).toBe(true)
  }
  finally {
    release.resolve()
  }
})

it('does not impose grammY\'s finite callback timeout on a long running update', async () => {
  const instance = app()
  const entered = deferred<void>()
  const release = deferred<void>()
  const bot = new Bot('long-update-token', { botInfo })
  bot.use(async () => {
    entered.resolve()
    await release.promise
  })
  instance.register(fastifyGrammy, {
    name: 'webhook',
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
  })
  await instance.ready()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout'],
  })
  try {
    let responded = false
    const request = instance.inject({
      method: 'POST',
      url: '/telegram',
      headers: { 'x-telegram-bot-api-secret-token': 'secret' },
      payload: update,
    }).then((response) => {
      responded = true
      return response
    })
    await entered.promise
    await vi.advanceTimersByTimeAsync(10_001)
    expect(responded).toBe(false)
    release.resolve()
    expect((await request).statusCode).toBe(200)
  }
  finally {
    release.resolve()
    vi.useRealTimers()
  }
})

it('runs the original bot middleware with its configured context constructor', async () => {
  const instance = app()
  const bot = new Bot<WebhookContext>('custom-context-token', {
    botInfo,
    ContextConstructor: WebhookContext,
  })
  const markers: string[] = []
  bot.use((ctx) => {
    markers.push(ctx.marker)
  })
  instance.register(fastifyGrammy, {
    name: 'webhookCustom',
    bot,
    mode: 'webhook',
    path: '/telegram',
    secretToken: 'secret',
  })
  const response = await instance.inject({
    method: 'POST',
    url: '/telegram',
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    payload: update,
  })
  expect(response.statusCode).toBe(200)
  expect(markers).toEqual(['configured-context'])
  expect(instance.grammy.get('webhookCustom')).toBe(bot)
})
