import type { FastifyGrammyOptions } from '../types'
import process from 'node:process'
import { Bot as TelegramBot } from 'grammy'

export async function createBotFactory(options: FastifyGrammyOptions) {
  const { token, middlewares = [], config } = options

  const bot = new TelegramBot(token, config)

  bot.use(...middlewares)

  if (process.env.TEST === 'true') {
    // @ts-expect-error TODO: Type this
    bot.api.config.use(() => {
      return { ok: true, result: true }
    })
  }

  return bot
}

export type FastifyGrammyBot = ReturnType<typeof createBotFactory>
