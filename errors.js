const { createError } = require('@fastify/error')

const MissingBotTokenError = createError(
  'FST_ERR_GRAMMY_MISSING_BOT_TOKEN',
  'Missing bot token'
)
const NameAlreadyRegisterError = createError(
  'FST_ERR_GRAMMY_NAME_ALREADY_REGISTER',
  '\'%s\' instance name has already been registered'
)
const AlreadyRegisterError = createError(
  'FST_ERR_GRAMMY_ALREADY_REGISTER',
  'bot has already been registered'
)

module.exports = {
  MissingBotTokenError,
  NameAlreadyRegisterError,
  AlreadyRegisterError
}
