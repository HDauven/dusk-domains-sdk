import { it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import {
  validateEthereumAddress,
  validateBitcoinAddress,
} from '../src/chain-addresses.ts'
const root = new URL('../', import.meta.url)
it('npm and JSR expose the same entrypoints with platform-appropriate runtime files', () => {
  const npm = JSON.parse(
      readFileSync(new URL('package.json', root), 'utf8'),
    ),
    jsr = JSON.parse(readFileSync(new URL('jsr.json', root), 'utf8'))
  expect(npm.version).toBe('0.3.2')
  expect(jsr.version).toBe(npm.version)
  expect(Object.keys(npm.exports).sort()).toEqual(
    Object.keys(jsr.exports).sort(),
  )
  for (const [key, path] of Object.entries(jsr.exports)) {
    const compiled = (path as string)
      .replace('./src/', './dist/')
      .replace(/\.ts$/u, '')
    expect(npm.exports[key]).toEqual({
      types: `${compiled}.d.ts`,
      import:
        key === './event-catalog'
          ? (path as string).replace(/\.ts$/u, '.mjs')
          : `${compiled}.js`,
    })
    expect(existsSync(new URL(path as string, root))).toBe(true)
  }
  expect(npm.main).toBe('./dist/index.js')
  expect(npm.types).toBe('./dist/index.d.ts')
  expect(npm.files).toContain('dist')
  expect(jsr.exports['./chain-addresses']).toBeDefined()
  expect(jsr.exports['./internal']).toBeUndefined()
})
it('retains independent chain-address validators', () => {
  expect(
    validateEthereumAddress('0x0000000000000000000000000000000000000000'),
  ).toEqual([])
  expect(validateBitcoinAddress('invalid')).toHaveLength(1)
})
