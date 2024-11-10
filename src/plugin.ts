import type { FastifyPluginAsync } from 'fastify'
import type { Bot } from 'grammy'
import type { FastifyGrammyOptions } from './types'
import fp from 'fastify-plugin'
import { AlreadyRegisterError, MissingBotTokenError, NameAlreadyRegisterError } from './errors'
import { createBotFactory } from './utils/create-bot-factory'

function isBotRegistry(v: unknown): v is Record<string, Bot> {
  return typeof v === 'object' && v !== null
}

const plugin: FastifyPluginAsync<FastifyGrammyOptions> = async (
  fastify,
  options,
) => {
  const { name, token } = options

  if (!token) {
    throw new MissingBotTokenError()
  }

  const bot = await createBotFactory(options)

  if (name) {
    if (!fastify.grammy) {
      fastify.decorate('grammy', {} as any)
    }

    if (isBotRegistry(fastify.grammy)) {
      if (fastify.grammy[name]) {
        throw new NameAlreadyRegisterError(name)
      }

      fastify.grammy[name] = bot
    }
  }
  else {
    if (fastify.grammy) {
      throw new AlreadyRegisterError()
    }
    else {
      fastify.decorate('grammy', bot)
    }
  }

  fastify.addHook('onClose', () => bot.stop())

  bot
    .start({ onStart: () => fastify.log.info('Bot started') })
    .catch(() => {})
}

export const fastifyGrammy = fp(plugin, {
  fastify: '5.x',
  name: 'fastify-grammy',
})
