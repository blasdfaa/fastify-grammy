import type { Context, SessionFlavor } from 'grammy'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

type SessionContext = Context & SessionFlavor<{ count: number }>
declare module 'fastify-grammy' {
  interface FastifyGrammyBots {
    default: Bot<SessionContext>
  }
}
const app = Fastify()
const bot = new Bot<SessionContext>('session-default')
app.register(fastifyGrammy, { bot, mode: 'manual' })
app.grammy.get('default').command('count', ctx => ctx.reply(String(ctx.session.count)))
// @ts-expect-error an omitted name must check the declared default context
app.register(fastifyGrammy, {
  bot: new Bot('wrong-default'),
  mode: 'manual',
})
