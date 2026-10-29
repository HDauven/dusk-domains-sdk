/**
 * The light entries run where an app cannot load the rest of the SDK, such as an extension's service
 * worker: importing one reaches only these modules, from the sources' own imports, and nothing it
 * reaches uses the DOM or storage, imports at run time or awaits at the top level. `./names` hashes
 * nothing; `./accounts` adds the curve its key check needs, and no reader: an app passes its own.
 */
import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const src = new URL('../src/', import.meta.url)
/** The modules an import of `entry` evaluates: its value imports and re-exports, followed. */
function reached(entry: string): string[] {
  const seen = new Set<string>(),
    next = [entry]
  while (next.length) {
    const at = next.pop()!
    if (seen.has(at)) continue
    seen.add(at)
    if (at.startsWith('@')) continue
    const code = readFileSync(new URL(at, src), 'utf8')
    for (const [, from] of code.matchAll(/^(?:import|export)\s+(?!type\b)[^'"]*?from\s+'([^']+)'/gmu))
      next.push(from.startsWith('.') ? new URL(from, new URL(at, src)).pathname.slice(src.pathname.length) : from)
  }
  return [...seen].sort()
}
const code = (module: string) =>
  readFileSync(new URL(module, src), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '')

it.each([
  ['names.ts', ['core/name-rules.ts', 'core/names.ts', 'names.ts']],
  ['call-facts.ts', ['@noble/hashes/blake2.js', 'call-facts.ts', 'core/base58.ts', 'core/call-facts.ts', 'core/name-rules.ts', 'core/releases.ts', 'frozen/bytes.ts']],
  ['releases.ts', ['core/releases.ts', 'releases.ts']],
  ['accounts.ts', ['@noble/curves/bls12-381.js', 'accounts.ts', 'core/accounts.ts', 'core/base58.ts', 'core/endpoint.ts', 'core/key-shape.ts']],
])('./%s reaches only its own few modules, safe in a service worker', (entry, modules) => {
  const all = reached(entry)
  expect(all).toEqual(modules)
  for (const module of all.filter((m) => !m.startsWith('@'))) {
    expect(code(module), module).not.toMatch(/\b(?:window|document|localStorage|sessionStorage|indexedDB)\b|\bimport\s*\(/u)
    expect(code(module), module).not.toMatch(/^(?:export\s+)?(?:const|let|var)\s[^\n]*=\s*await\b|^await\b/mu)
  }
})

it('./lens-reader reaches no curve: only ./accounts and the root load it', () => {
  const modules = reached('lens-reader.ts')
  expect(modules).toContain('frozen/lens-reader.ts')
  expect(modules.filter((m) => m.startsWith('@noble/curves') || ['core/endpoint.ts', 'core/principal.ts'].includes(m))).toEqual([])
})
