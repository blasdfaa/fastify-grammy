import type { FastifyInstance } from 'fastify'
import type { FastifyGrammyBots, FastifyGrammyName, FastifyGrammyRegistry, FastifyGrammyStatus, RuntimeBot } from './types'
import { BotNotFoundError, NameAlreadyRegisteredError } from './errors'

export interface Entry {
  bot: RuntimeBot
  status: FastifyGrammyStatus
}

export class Registry implements FastifyGrammyRegistry {
  private readonly entries = new Map<string, Entry>()
  private readonly children = new Set<Registry>()

  constructor(private readonly parent?: Registry) {
    parent?.children.add(this)
  }

  find(name: string): Entry {
    const entry = this.entries.get(name) ?? this.parent?.lookup(name)
    if (!entry)
      throw new BotNotFoundError(name)
    return entry
  }

  private lookup(name: string): Entry | undefined {
    return this.entries.get(name) ?? this.parent?.lookup(name)
  }

  private containsInSubtree(name: string): boolean {
    if (this.entries.has(name))
      return true
    for (const child of this.children) {
      if (child.containsInSubtree(name))
        return true
    }
    return false
  }

  add(name: string, entry: Entry): void {
    if (this.lookup(name) || this.containsInSubtree(name))
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

interface ScopeRegistry {
  registry: Registry
  exposed: boolean
}
const scopeRegistries = new WeakMap<FastifyInstance, ScopeRegistry>()

function ensureRegistry(fastify: FastifyInstance): ScopeRegistry {
  const existing = scopeRegistries.get(fastify)
  if (existing)
    return existing
  // Allocate the complete scope chain before linking a child. An ancestor may
  // receive its first bot later; its live store must already be connected.
  const parent = Object.hasOwn(fastify, 'server')
    ? undefined
    : ensureRegistry(Object.getPrototypeOf(fastify)).registry
  const scope = {
    registry: new Registry(parent),
    exposed: false,
  }
  scopeRegistries.set(fastify, scope)
  return scope
}

export function registryFor(fastify: FastifyInstance): Registry {
  const scope = ensureRegistry(fastify)
  if (!scope.exposed) {
    // Private ancestor stores do not expose a decorator until that exact scope
    // registers a bot. Inherited decorators do not imply local exposure.
    fastify.decorate('grammy', scope.registry)
    scope.exposed = true
  }
  return scope.registry
}
