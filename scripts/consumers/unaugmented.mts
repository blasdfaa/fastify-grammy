import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

const app = Fastify()
const bot = new Bot('no-map')
// @ts-expect-error an explicit application map is required for TypeScript
app.register(fastifyGrammy, { bot, mode: 'manual' })
// @ts-expect-error an absent map must not introduce an any lookup fallback
app.grammy.get('default')
