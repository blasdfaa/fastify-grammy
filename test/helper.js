const fp = require('fastify-plugin')
const fastifyGrammy = require('..')
const Fastify = require('fastify')
const assert = require('node:assert')

async function register (t, options = {}) {
  const app = Fastify()
  t.after(() => app.close())

  await app.register(fp(fastifyGrammy), options)

  const ready = await app.ready()
  assert.ok(ready)

  return app
}

module.exports = { register }
