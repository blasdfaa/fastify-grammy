import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const scratch = await mkdtemp(join(tmpdir(), 'fastify-grammy-consumer-'))
const npmCli = [
  join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
].find(path => existsSync(path))
assert(npmCli, 'The consumer checks require npm alongside the active Node.js installation')
let passed = false

function run(command, args, cwd = scratch) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, CI: 'true' },
  })
  if (result.error || result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout ?? ''}${result.stderr ?? ''}`, { cause: result.error })
  return result.stdout
}

try {
  const [packed] = JSON.parse(run(process.execPath, [
    npmCli,
    'pack',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    scratch,
  ], root))
  const paths = new Set(packed.files.map(file => file.path))
  for (const path of [
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.d.cts',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'docs/migration-0.2.0.md',
  ])
    assert(paths.has(path), `Tarball is missing ${path}`)
  assert(!packed.files.some(file => /^(?:src|test|scripts)\//.test(file.path)), 'Tarball includes private source/test tools')

  await writeFile(join(scratch, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      'fastify': '5.12.7',
      'fastify-grammy': `file:${join(scratch, packed.filename)}`,
    },
    devDependencies: {
      '@types/node': '22.20.5',
      'typescript': '6.0.3',
    },
  }, null, 2))
  // Install scripts stay enabled: a consumer must never require the author's hook tooling.
  run(process.execPath, [
    npmCli,
    'install',
    '--ignore-scripts=false',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
  ])
  const installed = JSON.parse(await readFile(join(scratch, 'node_modules/fastify-grammy/package.json'), 'utf8'))
  for (const hook of ['preinstall', 'install', 'postinstall'])
    assert(!installed.scripts?.[hook], `Published package has a consumer ${hook} hook`)

  await cp(join(root, 'scripts/consumers'), join(scratch, 'fixtures'), { recursive: true })
  run(process.execPath, ['fixtures/runtime.mjs'])
  run(process.execPath, ['fixtures/runtime.cjs'])
  run(process.execPath, ['fixtures/runtime-mixed.mjs'])

  const scenarios = {
    esm: ['esm.mts'],
    commonjs: ['commonjs.cts'],
    mixed: ['esm.mts', 'commonjs.cts', 'mixed.mts'],
    sessionDefault: ['session-default.mts'],
    unaugmented: ['unaugmented.mts'],
  }
  let example = 0
  for (const document of ['README.md', 'docs/migration-0.2.0.md']) {
    const markdown = await readFile(join(scratch, 'node_modules/fastify-grammy', document), 'utf8')
    for (const [, source] of markdown.matchAll(/```ts\r?\n([\s\S]*?)```/g)) {
      const name = `documentation${++example}`
      const file = `${name}.mts`
      await writeFile(join(scratch, 'fixtures', file), source)
      scenarios[name] = [file]
    }
  }
  assert(example >= 3, 'Expected standalone TypeScript examples in the README and migration guide')
  for (const module of ['NodeNext', 'Node16']) {
    for (const [name, files] of Object.entries(scenarios)) {
      const config = `tsconfig.${module}.${name}.json`
      await writeFile(join(scratch, config), JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          target: 'ES2022',
          module,
          moduleResolution: module,
          esModuleInterop: true,
          types: ['node'],
          rootDir: '.',
        },
        files: files.map(file => `fixtures/${file}`),
      }, null, 2))
      run(process.execPath, ['node_modules/typescript/bin/tsc', '--project', config])
    }
  }
  passed = true
  console.log(`Clean tarball install, ESM/CJS runtime, and ${Object.keys(scenarios).length * 2} strict consumer type scenarios passed.`)
}
finally {
  if (passed)
    await rm(scratch, { recursive: true, force: true })
  else console.error(`Consumer failure retained at ${scratch}`)
}
