import Fastify from 'fastify'
import { Bot } from 'grammy'
import { expect, it } from 'vitest'
import { fastifyGrammy } from '../src'
import { botInfo, deferred, telegram } from './helpers/telegram'

declare module '../src' {
  interface FastifyGrammyBots {
    pollingCancellation: Bot
  }
}

it('does not retry deleting the remote webhook after startup cancellation', async () => {
  const app = Fastify()
  const firstDeletion = deferred<never>()
  let deletionAttempts = 0
  let acknowledged = false
  const transport = telegram({
    deleteWebhook: () => {
      deletionAttempts += 1
      return deletionAttempts === 1
        ? firstDeletion.promise
        : true
    },
    getUpdates: ({ payload }) => {
      if (payload.limit !== 1)
        throw new Error('Polling must not begin after startup cancellation')
      // Let the stop acknowledgement finish before the failed deletion reaches
      // grammY's retry loop, reproducing its cleared internal abort controller.
      setImmediate(() => firstDeletion.reject(new DOMException('Aborted', 'AbortError')))
      return []
    },
  })
  const bot = new Bot('polling-cancelled-deletion', {
    botInfo,
    client: { fetch: transport.fetch },
  })
  bot.api.config.use(async (previous, method, payload, signal) => {
    const response = await previous(method, payload, signal)
    if (method === 'getUpdates')
      acknowledged = true
    return response
  })
  app.register(fastifyGrammy, {
    name: 'pollingCancellation',
    bot,
    mode: 'polling',
    startupTimeoutMs: 20,
  })
  try {
    await expect(app.ready()).rejects.toMatchObject({ code: 'FST_ERR_GRAMMY_STARTUP_TIMEOUT' })
  }
  finally {
    await app.close()
  }
  expect(acknowledged).toBe(true)
  expect(transport.requests.filter(request => request.method === 'deleteWebhook')).toHaveLength(1)
  expect(bot.isRunning()).toBe(false)
})

it('preserves application API calls while already accepted polling work drains', async () => {
  const app = Fastify()
  const handling = deferred<void>()
  const finishHandler = deferred<void>()
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
              text: 'finish',
            },
          },
        ],
  })
  const bot = new Bot('polling-drain-api', {
    botInfo,
    client: { fetch: transport.fetch },
  })
  let deletionResult: boolean | undefined
  bot.on('message', async () => {
    handling.resolve()
    await finishHandler.promise
    deletionResult = await bot.api.deleteWebhook()
  })
  app.register(fastifyGrammy, { name: 'pollingCancellation', bot, mode: 'polling' })
  await app.ready()
  await handling.promise
  const closing = app.close()
  try {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  finally {
    finishHandler.resolve()
    await closing
  }
  expect(deletionResult).toBe(true)
})
