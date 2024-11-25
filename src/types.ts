import type { FastifyPluginAsync } from 'fastify'
import type { BotConfig, Middleware, PollingOptions } from 'grammy'

declare module 'fastify' {
  export interface FastifyInstance {
    grammy: any
  }
}

export type FastifyGrammy = FastifyPluginAsync<FastifyGrammyOptions>

export interface FastifyGrammyOptions {
  token: string
  name?: string
  middlewares?: Middleware[]
  config?: BotConfig<any>
  pollingOptions?: PollingOptions
}
