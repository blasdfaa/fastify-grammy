import { fastifyGrammy } from 'fastify-grammy'

export default async function (fastify, _opts) {
  await fastify.register(fastifyGrammy, {
    token: '',
  })

  // fastify.grammy.start()
  fastify.grammy.command('start', ctx => ctx.reply('Hi, I\'m run faster than you :)'))
}
