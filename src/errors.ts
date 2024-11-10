import { createError } from '@fastify/error'

export const MissingBotTokenError = createError(
  'FST_ERR_GRAMMY_MISSING_BOT_TOKEN',
  'Missing bot token',
)
export const NameAlreadyRegisterError = createError(
  'FST_ERR_GRAMMY_NAME_ALREADY_REGISTER',
  '\'%s\' instance name has already been registered',
)
export const AlreadyRegisterError = createError(
  'FST_ERR_GRAMMY_ALREADY_REGISTER',
  'bot has already been registered',
)
