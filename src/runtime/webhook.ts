import type { ManagedContext, ManagedController } from './managed'

// Replaced by the webhook implementation task; not a completed mode.
export function createWebhookController(_context: ManagedContext, _options: { path: string, secretToken: string, prefix?: string }): ManagedController {
  return {
    start: async () => {},
    stop: async () => {},
  }
}
