import type { PollingOptions } from 'grammy'
import type { ManagedContext, ManagedController } from './managed'

export function createPollingController(context: ManagedContext, options?: PollingOptions): ManagedController {
  let lifetime: Promise<void> | undefined
  let stopping = false
  let shutdown: Promise<void> | undefined

  return {
    async start() {
      context.signal.throwIfAborted()
      let resolveStartup!: () => void
      let rejectStartup!: (error: unknown) => void
      const startup = new Promise<void>((resolve, reject) => {
        resolveStartup = resolve
        rejectStartup = reject
      })
      lifetime = context.bot.start({
        ...options,
        onStart: async (info) => {
          context.signal.throwIfAborted()
          await options?.onStart?.(info)
          context.signal.throwIfAborted()
          // Let grammY enter its loop and surface immediate failures before boot.
          setImmediate(() => {
            if (context.signal.aborted || stopping)
              rejectStartup(context.signal.reason ?? new Error('Polling stopped during startup'))
            else resolveStartup()
          })
        },
      })
      void lifetime.then(
        () => {
          if (!stopping && !context.signal.aborted) {
            const error = new Error('Polling stopped unexpectedly')
            rejectStartup(error)
            context.fatal(error)
          }
        },
        (error: unknown) => {
          rejectStartup(error)
          context.fatal(error)
        },
      )
      await startup
    },
    stop() {
      stopping = true
      shutdown ??= (async () => {
        const [stopped] = await Promise.allSettled([
          context.bot.stop(),
          lifetime,
        ])
        if (stopped.status === 'rejected')
          throw stopped.reason
      })()
      return shutdown
    },
  }
}
