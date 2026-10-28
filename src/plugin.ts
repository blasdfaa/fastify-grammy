import type { FastifyPluginAsync } from 'fastify'
import type { FastifyGrammy, RuntimeOptions } from './types'
import fp from 'fastify-plugin'
import { InvalidOptionsError } from './errors'
import { claimBot } from './ownership'
import { registryFor } from './registry'
import { installManagedLifecycle } from './runtime/managed'
import { createPollingController } from './runtime/polling'
import { createWebhookController } from './runtime/webhook'

const plugin: FastifyPluginAsync<RuntimeOptions> = async (fastify, options) => {
  const { bot, mode, name = 'default' } = options
  if (!bot || typeof bot.init !== 'function' || typeof bot.handleUpdate !== 'function')
    throw new InvalidOptionsError('A prepared grammY Bot is required')
  if (mode !== 'manual' && mode !== 'polling' && mode !== 'webhook')
    throw new InvalidOptionsError('mode must be polling, webhook, or manual')
  if (mode !== 'manual' && options.startupTimeoutMs !== undefined && (!Number.isFinite(options.startupTimeoutMs) || options.startupTimeoutMs <= 0))
    throw new InvalidOptionsError('startupTimeoutMs must be a finite positive number')
  const release = claimBot(fastify, bot, mode !== 'manual')
  // onClose runs in reverse registration order: release after managed drain.
  fastify.addHook('onClose', async () => {
    release()
  })
  try {
    const entry = {
      bot,
      status: {
        mode,
        state: mode === 'manual'
          ? 'manual' as const
          : 'registered' as const,
      },
    }
    registryFor(fastify).add(name, entry)
    if (options.mode === 'polling')
      installManagedLifecycle(fastify, entry, options, context => createPollingController(context, options.pollingOptions))
    if (options.mode === 'webhook')
      installManagedLifecycle(fastify, entry, options, context => createWebhookController(context, options))
  }
  catch (error) {
    release()
    throw error
  }
}

export const fastifyGrammy = fp(plugin, { fastify: '5.x', name: 'fastify-grammy' }) as FastifyGrammy
