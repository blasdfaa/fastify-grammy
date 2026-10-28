import type { Bot, Context } from 'grammy'
import type { ManagedContext, ManagedController } from './managed'
import { webhookCallback } from 'grammy'
import { InvalidOptionsError } from '../errors'

export function createWebhookController(context: ManagedContext, options: { path: string, secretToken: string, prefix?: string }): ManagedController {
  if (typeof options.path !== 'string' || !options.path.startsWith('/'))
    throw new InvalidOptionsError('Webhook path must be a string beginning with /')
  if (typeof options.secretToken !== 'string' || options.secretToken.length === 0)
    throw new InvalidOptionsError('Webhook secretToken must be a non-empty string')
  // The registry erases only context-dependent types; this remains the original
  // grammY Bot, with its configured context constructor and API transformers.
  const callback = webhookCallback(context.bot as Bot<Context>, 'fastify', {
    secretToken: options.secretToken,
    timeoutMilliseconds: Infinity,
  })
  // A sent HTTP response can precede middleware completion. Keep the complete
  // native callback, whose infinite timeout does not detach handleUpdate.
  const tasks = new Set<Promise<void>>()
  let accepting = false
  context.fastify.register(async (scope) => {
    scope.post(options.path, async (request, reply) => {
      if (!accepting || context.signal.aborted)
        return reply.code(503).send('Bot is shutting down')
      const task = callback(request, reply)
      tasks.add(task)
      try {
        await task
        return reply
      }
      catch (error) {
        if (!reply.sent && !reply.raw.headersSent && !reply.raw.destroyed)
          throw error
        context.reportError(error)
        return reply
      }
      finally {
        tasks.delete(task)
      }
    })
  }, { prefix: options.prefix })
  return {
    start: async () => {
      accepting = true
    },
    stop: async () => {
      accepting = false
      await Promise.allSettled(tasks)
    },
  }
}
