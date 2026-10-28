import { access, writeFile } from 'node:fs/promises'

// Share the registry and ownership state when an application mixes import/require.
await access(new URL('../dist/index.cjs', import.meta.url))
await writeFile(new URL('../dist/index.js', import.meta.url), `import core from './index.cjs'
export const fastifyGrammy = core.fastifyGrammy
`)

// Both runtime formats must augment one application map and one Fastify property.
// Type-only imports also support consumers using Node16 module resolution.
await access(new URL('../dist/index.d.ts', import.meta.url))
await writeFile(new URL('../dist/index.d.cts', import.meta.url), `import type { FastifyGrammy } from './index.js' with { 'resolution-mode': 'import' }
export type * from './index.js' with { 'resolution-mode': 'import' }
declare const fastifyGrammy: FastifyGrammy
export { fastifyGrammy }
`)
