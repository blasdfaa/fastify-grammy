import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

const app = Fastify()
const bot = new Bot('offline-esm', {
  client: {
    fetch() { throw new Error('manual mode contacted Telegram') },
  },
})
app.register(fastifyGrammy, { bot, mode: 'manual' })
try {
  await app.ready()
  assert.equal(app.grammy.get('default'), bot)
  assert.deepEqual(app.grammy.status('default'), { mode: 'manual', state: 'manual' })
  assert.equal(bot.isInited(), false)
}
finally {
  await app.close()
}
