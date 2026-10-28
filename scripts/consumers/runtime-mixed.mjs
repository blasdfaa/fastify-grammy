import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

const require = createRequire(import.meta.url)
const { fastifyGrammy: commonjsPlugin } = require('fastify-grammy')

const app = Fastify()
const contender = Fastify()
const first = new Bot('offline-mixed-first')
const second = new Bot('offline-mixed-second')
try {
  app.register(fastifyGrammy, { bot: first, mode: 'manual' })
  app.register(commonjsPlugin, { name: 'mixed', bot: second, mode: 'manual' })
  await app.ready()
  assert.equal(app.grammy.get('default'), first)
  assert.equal(app.grammy.get('mixed'), second)

  contender.register(commonjsPlugin, { bot: first, mode: 'manual' })
  await assert.rejects(contender.ready(), { code: 'FST_ERR_GRAMMY_BOT_ALREADY_REGISTERED' })
}
finally {
  await Promise.all([
    app.close(),
    contender.close(),
  ])
}
