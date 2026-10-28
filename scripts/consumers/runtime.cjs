const assert = require('node:assert/strict')
const process = require('node:process')
const Fastify = require('fastify')
const { fastifyGrammy } = require('fastify-grammy')
const { Bot } = require('grammy')

async function main() {
  const app = Fastify()
  const bot = new Bot('offline-cjs', {
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
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
