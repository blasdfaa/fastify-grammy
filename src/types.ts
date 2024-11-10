import type { FastifyPluginCallback } from 'fastify'
import type { BotConfig, Middleware } from 'grammy'

declare module 'fastify' {
  export interface FastifyInstance {
    grammy: any
  }
}

export type FastifyGrammy = FastifyPluginCallback<FastifyGrammyOptions>

export interface FastifyGrammyOptions {
  token: string
  name?: string
  middlewares?: Middleware[]
  config?: BotConfig<any>
}
