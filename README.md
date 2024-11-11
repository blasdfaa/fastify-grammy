# fastify-grammy

[![CI](https://github.com/blasdfaa/fastify-grammy/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/blasdfaa/fastify-grammy/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/fastify-grammy.svg?style=flat)](https://www.npmjs.com/package/fastify-grammy)

## 🚧 In development

This library is a work in progress and in active development.

Supports Fastify versions `5.x`

## Install

```bash
# npm
npm install fastify-grammy

# pnpm
pnpm install fastify-grammy
```

## Usage

Import `fastify-grammy` and register.

```js
import Fastify from 'fastify'
import { fastifyGrammy } from 'fastify-grammy'

const fastify = Fastify()

fastify.register(fastifyGrammy, {
  token: 'your-tg-bot-token'
})

fastify.listen({ port: 3000 })
```

Before using `fastify-grammy`, make sure to check the [Grammy](https://grammy.dev/guide/getting-started) documentation for more information about how to create and configure a Telegram bot.

## Middlewares

You can use middlewares with `fastify-grammy` by passing them in the options object when registering the plugin.

```ts
import { session } from 'grammy'

fastify.register(fastifyGrammy, {
  token: 'your-tg-bot-token',
  middlewares: [session()]
})
```

## Using with TypeScript

To use `fastify-grammy` with TypeScript, you need to extend the Fastify instance with the FastifyGrammyBot type.

Here's an example for a single instance:

```ts
import type { FastifyGrammyBot } from 'fastify-grammy'

declare module 'fastify' {
  interface FastifyInstance {
    grammy: FastifyGrammyBot
  }
}
```

And here's an example for multiple instances:

```ts
import type { FastifyGrammyBot } from 'fastify-grammy'

declare module 'fastify' {
  interface FastifyInstance {
    grammy: {
      one: FastifyGrammyBot
      two: FastifyGrammyBot
    }
  }
}
```

## Acknowledgements

This library is based on the [Grammy](https://grammy.dev) library.

## License

Licensed under [MIT](./LICENSE).
