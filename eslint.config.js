import antfu from '@antfu/eslint-config'

export default antfu({
  pnpm: false,
  ignores: [
    '.agents/**',
    '.claude/**',
    'skills-lock.json',
    'dist/**',
    '**/node_modules/**',
  ],
})
