import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

export default mergeConfig(base, {
  test: {
    include: ['e2e/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
