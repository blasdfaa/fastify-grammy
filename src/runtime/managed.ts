import type { FastifyInstance } from 'fastify'
import type { Entry } from '../registry'
import type { FastifyGrammyError, RuntimeBot, RuntimeOptions } from '../types'
import { StartupTimeoutError } from '../errors'

export interface ManagedContext {
  fastify: FastifyInstance
  bot: RuntimeBot
  name: string
  signal: AbortSignal
  fatal: (error: unknown) => void
  reportError: (error: unknown) => void
}
export interface ManagedController {
  start: () => Promise<void>
  stop: () => Promise<void>
}
type ManagedOptions = Exclude<RuntimeOptions, { mode: 'manual' }>
interface ApplicationStartup {
  root: FastifyInstance
  observing: boolean
  cancel: Set<(error: unknown) => void>
}
const applications = new WeakMap<FastifyInstance['server'], ApplicationStartup>()

function applicationFor(fastify: FastifyInstance): ApplicationStartup {
  let app = applications.get(fastify.server)
  if (!app) {
    // Fastify encapsulates scopes with prototype inheritance. Only the root owns
    // the server and the application-wide ready barrier (child ready is Avvio).
    let root = fastify
    while (!Object.hasOwn(root, 'server')) root = Object.getPrototypeOf(root)
    app = { root, observing: false, cancel: new Set() }
    applications.set(fastify.server, app)
  }
  return app
}

export function installManagedLifecycle(
  fastify: FastifyInstance,
  entry: Entry,
  options: ManagedOptions,
  createController: (context: ManagedContext) => ManagedController,
): void {
  const name = options.name ?? 'default'
  const mode = options.mode
  const abortController = new AbortController()
  const app = applicationFor(fastify)
  let startup: Promise<void> | undefined
  let controller: ManagedController
  let cleanup: Promise<void> | undefined
  let cancelled = false
  let rejectCancellation!: (error: unknown) => void
  const cancellation = new Promise<never>((_, reject) => {
    rejectCancellation = reject
  })
  void cancellation.catch(() => {})

  function log(error: unknown, message: string) {
    // BotError contains a whole Context (and its token). Never serialize it.
    const redact = (text: string) => text.replaceAll(entry.bot.token, '[REDACTED]')
    const summary = error instanceof Error
      ? { name: redact(error.name), message: redact(error.message) }
      : { message: redact(String(error)) }
    fastify.log.error({ grammy: { name, mode }, err: summary }, message)
  }
  function reportError(error: unknown) {
    log(error, 'Telegram bot execution failed')
    const event: FastifyGrammyError = { name, mode, error }
    try {
      void Promise.resolve(options.onError?.(event, fastify)).catch(error => log(error, 'Telegram bot error observer failed'))
    }
    catch (error) { log(error, 'Telegram bot error observer failed') }
  }
  function stop(): Promise<void> {
    if (!cleanup) {
      try {
        cleanup = Promise.resolve(controller.stop())
      }
      catch (error) {
        cleanup = Promise.reject(error)
      }
      void cleanup.catch(error => log(error, 'Telegram bot cleanup failed'))
    }
    return cleanup
  }
  function cancel(error: unknown) {
    if (cancelled)
      return
    cancelled = true
    abortController.abort(error)
    entry.status = { mode, state: 'failed', error }
    rejectCancellation(error)
    void stop()
  }
  controller = createController({
    fastify,
    bot: entry.bot,
    name,
    signal: abortController.signal,
    reportError,
    fatal(error) {
      if (abortController.signal.aborted || entry.status.state === 'failed')
        return
      if (entry.status.state !== 'running') {
        cancel(error)
        return
      }
      entry.status = { mode, state: 'failed', error }
      reportError(error)
    },
  })
  app.cancel.add(cancel)

  fastify.addHook('onReady', async () => {
    if (!app.observing) {
      app.observing = true
      // Attach inside onReady: the root ready promise now exists. Never await
      // this observer from a boot hook; that would await our own completion.
      app.root.ready((error) => {
        if (error) {
          for (const cancelStartup of app.cancel) cancelStartup(error)
        }
      })
    }
    if (cancelled)
      return await cancellation
    entry.status = { mode, state: 'starting' }
    const timeout = options.startupTimeoutMs ?? 30_000
    const timer = setTimeout(() => cancel(new StartupTimeoutError(name, timeout)), timeout)
    startup = (async () => {
      await entry.bot.init(abortController.signal as Parameters<RuntimeBot['init']>[0])
      abortController.signal.throwIfAborted()
      await controller.start()
      abortController.signal.throwIfAborted()
      entry.status = { mode, state: 'running' }
    })()
    try {
      await Promise.race([startup, cancellation])
    }
    catch (error) {
      cancel(error)
      throw error
    }
    finally {
      clearTimeout(timer)
    }
  })

  fastify.addHook('onClose', async () => {
    app.cancel.delete(cancel)
    abortController.abort()
    if (entry.status.state !== 'failed')
      entry.status = { mode, state: 'stopping' }
    const results = await Promise.allSettled([stop(), startup])
    entry.status = { mode, state: 'stopped' }
    const stopError = results[0]
    if (stopError.status === 'rejected')
      throw stopError.reason
  })
}
