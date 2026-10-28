import type { PollingOptions } from 'grammy'
import type { ManagedContext, ManagedController } from './managed'

// Replaced by the polling implementation task; not a completed mode.
export function createPollingController(_context: ManagedContext, _options?: PollingOptions): ManagedController {
  return {
    start: async () => {},
    stop: async () => {},
  }
}
