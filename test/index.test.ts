import type { FastifyInstance } from 'fastify'
import fastify from 'fastify'
import { Bot } from 'grammy'
import { afterEach, expect, it } from 'vitest'
import { fastifyGrammy } from '../src'

const BOT_TOKEN = 'test'

let app: FastifyInstance

afterEach(() => {
  app.close()
})

it('should register the correct decorator', async () => {
  app = fastify()

  await app.register(fastifyGrammy, {
    token: BOT_TOKEN,
  })

  const ready = await app.ready()
  expect(ready).toBeTruthy()

  expect(app.grammy).toBeDefined()
  expect(app.grammy).instanceOf(Bot)
  expect(app.grammy.isInited()).toBe(true)
})

it('should not throw if registered within different scopes (with and without named instances)', async () => {
  app = fastify()

  await app.register((instance, _, next) => {
    instance.register(fastifyGrammy, {
      token: BOT_TOKEN,
    })

    next()
  })

  await app.register((instance, _, next) => {
    instance.register(fastifyGrammy, {
      token: BOT_TOKEN,
      name: 'one',
    })

    instance.register(fastifyGrammy, {
      token: BOT_TOKEN,
      name: 'two',
    })

    next()
  })

  const ready = await app.ready()
  expect(ready).toBeTruthy()
})

it('should throw when trying to register multiple instances without giving a name', async () => {
  app = fastify()

  await app.register(fastifyGrammy, {
    token: BOT_TOKEN,
  })

  await expect(async () => await app.register(fastifyGrammy, {
    token: BOT_TOKEN,
  }))
    .rejects
    .toThrow('bot has already been registered')
})

it('should throw when trying to register duplicate connection names', async () => {
  app = fastify()

  const name = 'test'

  await app.register(fastifyGrammy, {
    token: BOT_TOKEN,
    name,
  })

  await expect(async () => await app.register(fastifyGrammy, {
    token: BOT_TOKEN,
    name,
  }))
    .rejects
    .toThrow(`'${name}' instance name has already been registered`)
})

it('const result = await fastify.grammy namespace should exist', async () => {
  app = fastify()

  await app.register(fastifyGrammy, {
    token: BOT_TOKEN,
  })

  const ready = await app.ready()
  expect(ready).toBeTruthy()

  expect(app.grammy).toBeDefined()
  expect(app.grammy.start).toBeDefined()
  expect(app.grammy.on).toBeDefined()
  expect(app.grammy.use).toBeDefined()
})

it('const result = await fastify.grammy custom namespace should exist if a name is set', async () => {
  app = fastify()

  await app.register(fastifyGrammy, {
    token: BOT_TOKEN,
    name: 'test',
  })

  const ready = await app.ready()
  expect(ready).toBeTruthy()

  expect(app.grammy.test).toBeDefined()
  expect(app.grammy.test.start).toBeDefined()
  expect(app.grammy.test.on).toBeDefined()
  expect(app.grammy.test.use).toBeDefined()
})
