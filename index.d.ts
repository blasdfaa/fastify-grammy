import { FastifyPluginCallback } from 'fastify'
import { Bot } from 'grammy'

declare module 'fastify' {
  export interface FastifyInstance {
    grammy: Bot
  }
}

type FastifyGrammy = FastifyPluginCallback<fastifyGrammy.FastifyGrammyOptions>

declare namespace fastifyGrammy {
  export interface FastifyGrammyOptions {
    token: string
    name?: string
  }

  export const fastifyGrammy: FastifyGrammy
  export { FastifyGrammy as default }
}

declare function fastifyGrammy (...params: Parameters<FastifyGrammy>): ReturnType<FastifyGrammy>
export = fastifyGrammy
