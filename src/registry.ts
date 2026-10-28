import type { FastifyInstance } from 'fastify'
import type { FastifyGrammyBots, FastifyGrammyName, FastifyGrammyRegistry, FastifyGrammyStatus, RuntimeBot } from './types'
import { BotNotFoundError, NameAlreadyRegisteredError } from './errors'

export interface Entry {
  bot: RuntimeBot
  status: FastifyGrammyStatus
}

export class Registry implements FastifyGrammyRegistry {
  private readonly entries = new Map<string, Entry>()
  constructor(private readonly parent?: Registry) {}

  find(name: string): Entry {
    const entry = this.entries.get(name) ?? this.parent?.lookup(name)
    if (!entry)
      throw new BotNotFoundError(name)
    return entry
  }

  private lookup(name: string): Entry | undefined {
    return this.entries.get(name) ?? this.parent?.lookup(name)
  }

  add(name: string, entry: Entry): void {
    if (this.lookup(name))
      throw new NameAlreadyRegisteredError(name)
    this.entries.set(name, entry)
  }

  get<K extends FastifyGrammyName>(name: K): FastifyGrammyBots[K] {
    // Registration's mapped union enforces the declared type for each stored name.
    return this.find(name).bot as FastifyGrammyBots[K]
  }

  status(name: FastifyGrammyName): FastifyGrammyStatus {
    return {
      ...this.find(name).status,
    }
  }
}

const scopeRegistries = new WeakMap<FastifyInstance, Registry>()
export function registryFor(fastify: FastifyInstance): Registry {
  const existing = scopeRegistries.get(fastify)
  if (existing)
    return existing
  const inherited = fastify.hasDecorator('grammy')
    ? fastify.grammy
    : undefined
  const registry = new Registry(inherited instanceof Registry
    ? inherited
    : undefined)
  fastify.decorate('grammy', registry)
  scopeRegistries.set(fastify, registry)
  return registry
}
