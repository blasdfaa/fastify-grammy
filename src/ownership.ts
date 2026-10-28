import type { FastifyInstance } from 'fastify'
import type { RuntimeBot } from './types'
import { BotAlreadyRegisteredError, BotAlreadyRunningError, TokenAlreadyRegisteredError } from './errors'

const botOwners = new WeakSet<RuntimeBot>()
const applicationTokens = new WeakMap<FastifyInstance['server'], Set<string>>()

export function claimBot(fastify: FastifyInstance, bot: RuntimeBot, managed: boolean): () => void {
  if (botOwners.has(bot))
    throw new BotAlreadyRegisteredError()
  if (managed && bot.isRunning())
    throw new BotAlreadyRunningError()
  let tokens = applicationTokens.get(fastify.server)
  if (!tokens) {
    tokens = new Set()
    applicationTokens.set(fastify.server, tokens)
  }
  if (managed && tokens.has(bot.token))
    throw new TokenAlreadyRegisteredError()
  botOwners.add(bot)
  if (managed)
    tokens.add(bot.token)
  let released = false
  return () => {
    if (released)
      return
    released = true
    botOwners.delete(bot)
    if (managed)
      tokens.delete(bot.token)
  }
}
