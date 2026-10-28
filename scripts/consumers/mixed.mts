import Fastify from 'fastify'
import './esm.mjs'
import './commonjs.cjs'

const app = Fastify()
app.grammy.get('commonjs').command('total', ctx => ctx.reply(String(ctx.session.total)))
app.grammy.get('session').command('count', ctx => ctx.reply(String(ctx.session.count)))
// @ts-expect-error independent format augmentations must not erase context differences
app.grammy.get('commonjs').command('count', ctx => ctx.reply(String(ctx.session.count)))
