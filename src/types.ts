import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Bot, Context, PollingOptions } from 'grammy'

/** Extend this interface with the names and exact Bot types used by your application. */
export interface FastifyGrammyBots {}

export type FastifyGrammyName = Extract<keyof FastifyGrammyBots, string>
export type FastifyGrammyMode = 'polling' | 'webhook' | 'manual'
export type FastifyGrammyState = 'manual' | 'registered' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed'
export interface FastifyGrammyStatus {
  readonly mode: FastifyGrammyMode
  readonly state: FastifyGrammyState
  readonly error?: unknown
}
export interface FastifyGrammyError {
  readonly name: string
  readonly mode: 'polling' | 'webhook'
  readonly error: unknown
}
export interface FastifyGrammyRegistry {
  get: <K extends FastifyGrammyName>(name: K) => FastifyGrammyBots[K]
  status: (name: FastifyGrammyName) => FastifyGrammyStatus
}

type BotAt<K extends FastifyGrammyName> = FastifyGrammyBots[K] extends Bot<infer C, infer A> ? Bot<C, A> & FastifyGrammyBots[K] : never
interface ManagedOptions {
  startupTimeoutMs?: number
  onError?: (event: FastifyGrammyError, fastify: FastifyInstance) => void | Promise<void>
}
type ModeOptions
  = | { mode: 'manual' }
    | ({ mode: 'polling', pollingOptions?: PollingOptions } & ManagedOptions)
    | ({ mode: 'webhook', path: string, secretToken: string, prefix?: string } & ManagedOptions)

export type FastifyGrammyOptions = {
  [K in FastifyGrammyName]: { bot: BotAt<K> } & (K extends 'default' ? { name?: K } : { name: K }) & ModeOptions
}[FastifyGrammyName]
export type FastifyGrammy = FastifyPluginAsync<FastifyGrammyOptions>

/** Context-independent operations used by the integration; custom contexts stay on the original Bot. */
export type RuntimeBot = Pick<Bot<Context>, 'token' | 'api' | 'init' | 'start' | 'stop' | 'isInited' | 'isRunning' | 'handleUpdate'>
export type RuntimeOptions = { bot: RuntimeBot, name?: string } & ModeOptions

declare module 'fastify' {
  interface FastifyInstance {
    grammy: FastifyGrammyRegistry
  }
}
