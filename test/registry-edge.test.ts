import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import { Bot } from 'grammy'
import { afterEach, expect, it } from 'vitest'
import { fastifyGrammy } from '../src'

declare module '../src' {
  interface FastifyGrammyBots {
    edgeParent: Bot
    edgeLocal: Bot
    edgeShared: Bot
    edgeEarly: Bot
  }
}

const apps: FastifyInstance[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.close()))
})
function createApp() {
  const app = Fastify()
  apps.push(app)
  return app
}

const scopeOrders = [1, 2, 3].flatMap(depth => [false, true].map(earlyParent => ({ depth, earlyParent })))

function inNestedScope(parent: FastifyInstance, depth: number, use: (scope: FastifyInstance) => void) {
  parent.register(async (child) => {
    if (depth === 1)
      use(child)
    else inNestedScope(child, depth - 1, use)
  })
}

it.each(scopeOrders)('sees a late ancestor through $depth child scopes (early parent: $earlyParent)', async ({ depth, earlyParent }) => {
  const app = createApp()
  const local = new Bot('edge-child')
  const parent = new Bot('edge-parent')
  if (earlyParent) {
    app.register(fastifyGrammy, {
      bot: new Bot('edge-early'),
      name: 'edgeEarly',
      mode: 'manual',
    })
  }
  inNestedScope(app, depth, (child) => {
    child.register(fastifyGrammy, { bot: local, name: 'edgeLocal', mode: 'manual' })
    child.get('/child', () => ({
      parent: child.grammy.get('edgeParent') === parent,
      local: child.grammy.get('edgeLocal') === local,
    }))
  })
  app.register(fastifyGrammy, { bot: parent, name: 'edgeParent', mode: 'manual' })
  await app.ready()
  const response = await app.inject('/child')
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ parent: true, local: true })
})

it.each(scopeOrders)('rejects a late ancestor collision through $depth child scopes (early parent: $earlyParent)', async ({ depth, earlyParent }) => {
  const app = createApp()
  if (earlyParent) {
    app.register(fastifyGrammy, {
      bot: new Bot('edge-early'),
      name: 'edgeEarly',
      mode: 'manual',
    })
  }
  inNestedScope(app, depth, (child) => {
    child.register(fastifyGrammy, {
      bot: new Bot('edge-child-shared'),
      name: 'edgeShared',
      mode: 'manual',
    })
  })
  app.register(fastifyGrammy, {
    bot: new Bot('edge-parent-shared'),
    name: 'edgeShared',
    mode: 'manual',
  })
  const result = await app.ready().then(
    () => ({ code: 'ready' }),
    error => ({ code: error.code }),
  )
  expect(result).toEqual({ code: 'FST_ERR_GRAMMY_NAME_ALREADY_REGISTERED' })
})

it('connects a late intermediate ancestor without exposing registries in its parents', async () => {
  const app = createApp()
  const parent = new Bot('edge-middle-parent')
  const local = new Bot('edge-grandchild')
  app.register(async (middle) => {
    middle.register(async (child) => {
      child.register(fastifyGrammy, { bot: local, name: 'edgeLocal', mode: 'manual' })
      child.get('/grandchild', () => ({
        parent: child.grammy.get('edgeParent') === parent,
        local: child.grammy.get('edgeLocal') === local,
      }))
    })
    middle.register(fastifyGrammy, { bot: parent, name: 'edgeParent', mode: 'manual' })
  })
  await app.ready()
  const response = await app.inject('/grandchild')
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ parent: true, local: true })
  expect(app.hasDecorator('grammy')).toBe(false)
})

it('does not expose a parent registry merely because its child registers a bot', async () => {
  const app = createApp()
  app.register(async (child) => {
    child.register(fastifyGrammy, {
      bot: new Bot('edge-only-child'),
      name: 'edgeLocal',
      mode: 'manual',
    })
    child.get('/child-only', () => child.grammy.get('edgeLocal').token)
  })
  await app.ready()
  expect((await app.inject('/child-only')).body).toBe('edge-only-child')
  expect(app.hasDecorator('grammy')).toBe(false)
})
