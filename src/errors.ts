import { createError } from '@fastify/error'

export const NameAlreadyRegisteredError = createError('FST_ERR_GRAMMY_NAME_ALREADY_REGISTERED', 'Bot name \'%s\' is already visible in this Fastify scope')
export const BotNotFoundError = createError('FST_ERR_GRAMMY_BOT_NOT_FOUND', 'Bot \'%s\' is not registered in this Fastify scope')
export const InvalidOptionsError = createError('FST_ERR_GRAMMY_INVALID_OPTIONS', '%s')
export const BotAlreadyRegisteredError = createError('FST_ERR_GRAMMY_BOT_ALREADY_REGISTERED', 'This Bot instance is already registered')
export const TokenAlreadyRegisteredError = createError('FST_ERR_GRAMMY_TOKEN_ALREADY_REGISTERED', 'This Telegram bot already has a managed registration in the Fastify application')
export const BotAlreadyRunningError = createError('FST_ERR_GRAMMY_BOT_ALREADY_RUNNING', 'A managed Bot must not already be running')
export const StartupTimeoutError = createError('FST_ERR_GRAMMY_STARTUP_TIMEOUT', 'Bot \'%s\' startup exceeded %s ms')
