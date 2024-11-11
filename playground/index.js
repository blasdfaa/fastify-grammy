import { fastifyGrammy } from 'fastify-grammy'

export default async function (fastify, _opts) {
  await fastify.register(fastifyGrammy, {
    token: '',
  })

  fastify.grammy.command('start', ctx => ctx.react('😍'))
  fastify.grammy.on('message', ctx => ctx.react('👍'))
}
