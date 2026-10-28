import process from 'node:process'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

async function main() {
  const token = process.env.BOT_TOKEN
  if (!token)
    throw new Error('BOT_TOKEN is required')

  const mode = process.env.BOT_MODE ?? 'polling'
  if (mode !== 'polling' && mode !== 'manual')
    throw new Error('BOT_MODE must be polling or manual')

  const app = Fastify({ logger: true, pluginTimeout: 35_000 })
  const bot = new Bot(token)

  // Configure all grammY middleware before registration can start the Bot.
  bot.command('start', ctx => ctx.reply('Hello from fastify-grammy!'))
  bot.on('message', ctx => ctx.react('👍'))
  bot.catch(error => app.log.error({ updateId: error.ctx.update.update_id }, 'Bot update failed'))

  app.get('/health', () => ({
    bot: app.grammy.status('default'),
  }))

  let closing = false
  async function shutdown(signal) {
    if (closing)
      return
    closing = true
    app.log.info({ signal }, 'Closing application')
    // The application owns this deadline; managed close itself drains fully.
    const deadline = setTimeout(() => {
      app.log.error('Shutdown exceeded the application deadline')
      process.exit(1)
    }, 30_000)
    deadline.unref()
    try {
      await app.close()
    }
    catch (error) {
      app.log.error(error, 'Shutdown failed')
      process.exitCode = 1
    }
    finally {
      clearTimeout(deadline)
    }
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM')
  })

  try {
    // Polling may remove an existing Telegram webhook. Manual mode stays offline.
    await app.register(fastifyGrammy, mode === 'manual'
      ? { bot, mode }
      : {
          bot,
          mode,
          onError: ({ name, mode }, scope) => {
            scope.log.error({ name, mode }, 'Managed Bot failed')
          },
        })
    await app.listen({
      port: Number(process.env.PORT ?? 3000),
      host: '127.0.0.1',
    })
  }
  catch (error) {
    app.log.error(error, 'Application startup failed')
    process.exitCode = 1
    await shutdown('startup failure')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
