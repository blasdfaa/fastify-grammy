'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { Bot } = require('grammy')
const { register } = require('./helper')
const Fastify = require('fastify')
const fastifyGrammy = require('..')

const BOT_TOKEN = 'BOT_TOKEN'

test('should register the correct decorator', async t => {
  const fastify = await register(t, { token: 'aaa' })

  assert.ok(fastify.grammy)
  assert.ok(fastify.grammy instanceof Bot)
})

test('should not throw if registered within different scopes (with and without named instances)', async t => {
  const fastify = Fastify()
  t.after(() => fastify.close())

  await fastify.register(function scopeOne (instance, _, next) {
    instance.register(fastifyGrammy, {
      token: BOT_TOKEN
    })

    next()
  })

  await fastify.register(function scopeTwo (instance, _, next) {
    instance.register(fastifyGrammy, {
      token: BOT_TOKEN,
      name: 'one'
    })

    instance.register(fastifyGrammy, {
      token: BOT_TOKEN,
      name: 'two'
    })

    next()
  })

  const ready = await fastify.ready()
  assert.ok(ready)
})

test('should throw when trying to register multiple instances without giving a name', async (t) => {
  const fastify = Fastify()
  t.after(() => fastify.close())

  await fastify.register(fastifyGrammy, {
    token: BOT_TOKEN
  })

  await assert.rejects(
    async () => await fastify.register(fastifyGrammy, {
      token: BOT_TOKEN
    }),
    (err) => {
      assert.ok(err)
      assert.strictEqual(err.message, 'bot has already been registered')
      return true
    }
  )
})

test('Should throw when trying to register duplicate connection names', async (t) => {
  const fastify = Fastify()
  t.after(() => fastify.close())

  const name = 'test'

  await fastify.register(fastifyGrammy, {
    token: BOT_TOKEN,
    name
  })

  await assert.rejects(
    async () => await fastify.register(fastifyGrammy, {
      token: BOT_TOKEN,
      name
    }),
    (err) => {
      assert.ok(err)
      assert.strictEqual(err.message, `'${name}' instance name has already been registered`)
      return true
    }
  )
})

test('const result = await fastify.grammy namespace should exist', async (t) => {
  const fastify = await register(t, { token: BOT_TOKEN })

  assert.ok(fastify.grammy)
  assert.ok(fastify.grammy.start)
  assert.ok(fastify.grammy.on)
  assert.ok(fastify.grammy.use)
})

test('const result = await fastify.grammy custom namespace should exist if a name is set', async (t) => {
  const fastify = await register(t, {
    token: BOT_TOKEN,
    name: 'test'
  })

  assert.ok(fastify.grammy)
  assert.ok(fastify.grammy.test)
  assert.ok(fastify.grammy.test.start)
  assert.ok(fastify.grammy.test.on)
  assert.ok(fastify.grammy.test.use)
})
