import type { FastifyGrammyOptions } from 'fastify-grammy'
import type { Api, Context, SessionFlavor } from 'grammy'
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'
import { Bot, session } from 'grammy'

type SessionContext = Context & SessionFlavor<{ count: number }>
type CustomContext = SessionContext & { marker: string }
type ExtraApi = Api & { extra: () => Promise<string> }
class SpecialBot extends Bot<SessionContext> {
  special(): 'special' { return 'special' }
}

declare module 'fastify-grammy' {
  interface FastifyGrammyBots {
    default: Bot
    session: Bot<SessionContext>
    custom: Bot<CustomContext>
    special: SpecialBot
    flavored: Bot<Context, ExtraApi>
  }
}

const app = Fastify()
const ordinary = new Bot('ordinary-token')
const withSession = new Bot<SessionContext>('session-token')
withSession.use(session({
  initial: () => ({ count: 0 }),
}))
const custom = new Bot<CustomContext>('custom-token')
declare const flavored: Bot<Context, ExtraApi>

app.register(fastifyGrammy, { bot: ordinary, mode: 'manual' })
app.register(fastifyGrammy, {
  name: 'default',
  bot: ordinary,
  mode: 'polling',
  pollingOptions: {
    async onStart(info) { console.log(info.id) },
  },
})
app.register(fastifyGrammy, {
  name: 'session',
  bot: withSession,
  mode: 'webhook',
  path: '/telegram',
  secretToken: 'secret',
  prefix: '/api',
})
app.register(fastifyGrammy, { name: 'custom', bot: custom, mode: 'manual' })
app.register(fastifyGrammy, {
  name: 'special',
  bot: new SpecialBot('special-token'),
  mode: 'manual',
})
app.register(fastifyGrammy, { name: 'flavored', bot: flavored, mode: 'manual' })
app.grammy.get('special').special()
app.grammy.get('flavored').api.extra()
const sessionBot: Bot<SessionContext> = app.grammy.get('session')
sessionBot.command('count', ctx => ctx.reply(String(ctx.session.count)))
app.grammy.get('custom').command('marker', ctx => ctx.reply(ctx.marker))
const options: FastifyGrammyOptions = {
  name: 'session',
  bot: withSession,
  mode: 'polling',
  startupTimeoutMs: 5000,
  onError(event, instance) { instance.log.error({ err: event.error, mode: event.mode }) },
}
app.register(fastifyGrammy, options)
app.grammy.status('default').state satisfies 'manual' | 'registered' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed'

// @ts-expect-error unknown lookup names cannot fall back to any
app.grammy.get('missing')
// @ts-expect-error status requires an application map name
app.grammy.status('missing')
// @ts-expect-error registration names must appear in the map
app.register(fastifyGrammy, { name: 'missing', bot: ordinary, mode: 'manual' })
// @ts-expect-error a session name requires the corresponding Bot context
app.register(fastifyGrammy, { name: 'session', bot: ordinary, mode: 'manual' })
// @ts-expect-error Bot contexts are invariant in the reverse direction too
app.register(fastifyGrammy, { name: 'default', bot: withSession, mode: 'manual' })
// @ts-expect-error an omitted name selects default, not any compatible map entry
app.register(fastifyGrammy, { bot: withSession, mode: 'manual' })
// @ts-expect-error nondefault Bots require an explicit name
app.register(fastifyGrammy, { bot: custom, mode: 'manual' })
// @ts-expect-error mode is mandatory
app.register(fastifyGrammy, { bot: ordinary })
// @ts-expect-error only the three explicit delivery modes are supported
app.register(fastifyGrammy, { bot: ordinary, mode: 'automatic' })
// @ts-expect-error webhook requires a secret
app.register(fastifyGrammy, { bot: ordinary, mode: 'webhook', path: '/telegram' })
// @ts-expect-error webhook requires a path
app.register(fastifyGrammy, { bot: ordinary, mode: 'webhook', secretToken: 'secret' })
// @ts-expect-error webhook secret must be a string
app.register(fastifyGrammy, {
  bot: ordinary,
  mode: 'webhook',
  path: '/telegram',
  secretToken: 42,
})
// @ts-expect-error webhook path must be a string
app.register(fastifyGrammy, {
  bot: ordinary,
  mode: 'webhook',
  path: 42,
  secretToken: 'secret',
})
// @ts-expect-error manual mode has no polling options
app.register(fastifyGrammy, { bot: ordinary, mode: 'manual', pollingOptions: {} })
// @ts-expect-error manual mode has no webhook path
app.register(fastifyGrammy, { bot: ordinary, mode: 'manual', path: '/telegram' })
// @ts-expect-error polling does not accept a webhook path
app.register(fastifyGrammy, { bot: ordinary, mode: 'polling', path: '/telegram' })
// @ts-expect-error the ordinary context has no session
app.grammy.get('default').command('count', ctx => ctx.reply(String(ctx.session.count)))
// @ts-expect-error session context does not acquire unrelated custom fields
app.grammy.get('session').command('marker', ctx => ctx.reply(ctx.marker))
// @ts-expect-error manual mode does not own startup
app.register(fastifyGrammy, { bot: ordinary, mode: 'manual', startupTimeoutMs: 1000 })
// @ts-expect-error a plain session Bot cannot satisfy a concrete subclass entry
app.register(fastifyGrammy, { name: 'special', bot: withSession, mode: 'manual' })
// @ts-expect-error the Bot API generic is preserved
app.register(fastifyGrammy, { name: 'flavored', bot: ordinary, mode: 'manual' })
// @ts-expect-error the options callback must preserve the name/context correspondence
app.register(fastifyGrammy, () => ({ name: 'session', bot: ordinary, mode: 'manual' }))
