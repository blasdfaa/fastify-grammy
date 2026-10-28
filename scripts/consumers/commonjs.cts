import type { Context, SessionFlavor } from 'grammy'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot } from 'grammy'

type CommonContext = Context & SessionFlavor<{ total: number }>
declare module 'fastify-grammy' {
  interface FastifyGrammyBots {
    commonjs: Bot<CommonContext>
  }
}
const app = Fastify()
const bot = new Bot<CommonContext>('commonjs-token')
app.register(fastifyGrammy, { name: 'commonjs', bot, mode: 'manual' })
app.grammy.get('commonjs').command('total', ctx => ctx.reply(String(ctx.session.total)))
// @ts-expect-error CJS declarations must retain the exact application Bot type
app.register(fastifyGrammy, {
  name: 'commonjs',
  bot: new Bot('wrong-context'),
  mode: 'manual',
})
// @ts-expect-error CJS declarations must reject unknown names
app.grammy.get('missing')
// @ts-expect-error named registrations require a name, including in CJS
app.register(fastifyGrammy, { bot, mode: 'manual' })
