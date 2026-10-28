import type { BotConfig, Context } from 'grammy'

export const botInfo = { id: 42, is_bot: true, first_name: 'Offline', username: 'offline_bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false } as const
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

export interface TelegramRequest {
  method: string
  payload: Record<string, unknown>
  signal: AbortSignal | null | undefined
}
export type TelegramHandler = (request: TelegramRequest) => unknown | Promise<unknown>

/** Replace only Telegram's HTTP transport; the real Bot retains its full execution path. */
export function telegram(handlers: Record<string, TelegramHandler> = {}) {
  const requests: TelegramRequest[] = []
  type TelegramFetch = NonNullable<NonNullable<BotConfig<Context>['client']>['fetch']>
  const fetch: TelegramFetch = async (url: Parameters<TelegramFetch>[0], init: Parameters<TelegramFetch>[1]) => {
    const method = String(url).split('/').at(-1)!
    const payload: Record<string, unknown> = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
    const request = { method, payload, signal: init?.signal }
    requests.push(request)
    let result: unknown
    if (handlers[method]) {
      result = await handlers[method](request)
    }
    else if (method === 'getMe') {
      result = botInfo
    }
    else if (method === 'deleteWebhook') {
      result = true
    }
    else if (method === 'getUpdates') {
      if (payload.limit === 1) {
        result = []
      }
      else {
        return await new Promise<never>((_, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'))
          if (init?.signal?.aborted)
            abort()
          else init?.signal?.addEventListener('abort', abort, { once: true })
        })
      }
    }
    else {
      throw new Error(`Unexpected Telegram API method: ${method}`)
    }
    return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return { fetch, requests }
}

export function telegramError(code: number, description: string): Response {
  return new Response(JSON.stringify({ ok: false, error_code: code, description }), { status: code, headers: { 'content-type': 'application/json' } })
}
