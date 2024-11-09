# fastify-grammy

![CI](https://github.com/blasdfaa/fastify-grammy/workflows/CI/badge.svg)
[![NPM version](https://img.shields.io/npm/v/fastify-grammy.svg?style=flat)](https://www.npmjs.com/package/fastify-grammy)

## 🚧 In development

This library is a work in progress and in active development.

Supports Fastify versions `5.x`

## Install

```
npm i fastify-grammy
```

## Usage

Require `fastify-grammy` and register.

```js
const fastify = require('fastify')()

fastify.register(require('fastify-grammy'), {
  token: 'your-tg-bot-token'
})

fastify.listen({ port: 3000 })
```

## Acknowledgements

## License

Licensed under [MIT](./LICENSE).<br/>
