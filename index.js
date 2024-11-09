'use strict'

const fp = require('fastify-plugin')
const { Bot } = require('grammy')
const { NameAlreadyRegisterError, AlreadyRegisterError, MissingBotTokenError } = require('./errors')

function fastifyGrammy (fastify, options, next) {
  const { name, token } = options

  if (!token) {
    return next(new MissingBotTokenError())
  }

  const bot = new Bot(token)

  if (name) {
    if (!fastify.grammy) {
      fastify.decorate('grammy', {})
    }

    if (fastify.grammy[name]) {
      return next(new NameAlreadyRegisterError(name))
    }

    fastify.grammy[name] = bot
  } else {
    if (fastify.grammy) {
      return next(new AlreadyRegisterError())
    } else {
      fastify.decorate('grammy', bot)
    }
  }

  fastify.addHook('onClose', () => bot.stop())

  next()
}

module.exports = fp(fastifyGrammy, {
  fastify: '5.x',
  name: 'fastify-grammy'
})
module.exports.default = fastifyGrammy
module.exports.fastifyGrammy = fastifyGrammy
