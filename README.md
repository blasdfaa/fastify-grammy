# fastify-grammy

[![CI](https://github.com/blasdfaa/fastify-grammy/workflows/CI/badge.svg)](https://github.com/blasdfaa/fastify-grammy/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/fastify-grammy.svg?style=flat)](https://www.npmjs.com/package/fastify-grammy)

## 🚧 In development

This library is a work in progress and in active development.

Supports Fastify versions `5.x`

## Install

```
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

## Using with TypeScript

```ts
import type { FastifyGrammyBot } from 'fastify-grammy'

// for single instance
declare module 'fastify' {
  interface FastifyInstance {
    grammy: FastifyGrammyBot
  }
}

// for multiple instances
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

## License

Licensed under [MIT](./LICENSE).<br/>
