/**
 * The entries as apps bundle them with code splitting, as Vite 8 does with Rolldown: each app shape
 * below is one bundle, and every chunk loads only what it statically imports. The SDK is bundled as
 * JSR's npm package ships it, with no "sideEffects" flag; @noble keeps its own. Where the curve
 * (@noble/curves) and BLAKE2b (@noble/hashes) land is pinned: a page that shows names never loads
 * the curve, and one that checks names never loads hashing.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { rolldown, type OutputChunk } from 'rolldown'

const root = new URL('../', import.meta.url).pathname
const entries = JSON.parse(readFileSync(new URL('jsr.json', `file://${root}`), 'utf8')).exports as Record<string, string>
/** The chunks one bundle of `code` gives, minified. */
async function chunks(code: string): Promise<OutputChunk[]> {
  const bundle = await rolldown({
    input: 'app',
    cwd: root,
    logLevel: 'silent',
    plugins: [
      {
        name: 'app',
        async resolveId(id, importer) {
          if (id === 'app') return id
          const entry = id.startsWith('@duskdomains/sdk/') && entries[`./${id.slice('@duskdomains/sdk/'.length)}`]
          if (entry) return { id: `${root}${entry.slice(2)}`, moduleSideEffects: true }
          const resolved = await this.resolve(id, importer, { skipSelf: true })
          return resolved && resolved.id.startsWith(`${root}src/`) ? { ...resolved, moduleSideEffects: true } : resolved
        },
        load: (id) => (id === 'app' ? code : null),
      },
    ],
  })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  return output.filter((o): o is OutputChunk => o.type === 'chunk')
}
/** What loading `chunk` loads: it and every chunk it imports statically, transitively. */
function loads(all: OutputChunk[], chunk: OutputChunk) {
  const seen = new Set<OutputChunk>(),
    next = [chunk]
  while (next.length) {
    const c = next.pop()!
    if (seen.has(c)) continue
    seen.add(c)
    next.push(...c.imports.map((name) => all.find((o) => o.fileName === name)!))
  }
  const modules = [...seen].flatMap((c) => Object.entries(c.modules).filter(([, m]) => m.renderedLength > 0).map(([id]) => id))
  return {
    curve: modules.some((id) => id.includes('/@noble/curves/')),
    blake2b: modules.some((id) => /\/@noble\/hashes\/(?:blake2|_blake)\.js$/u.test(id)),
    bytes: [...seen].reduce((n, c) => n + c.code.length, 0),
  }
}
const lazy = (all: OutputChunk[], entry: string) => all.find((c) => c.isDynamicEntry && c.facadeModuleId === `${root}src/${entry}.ts`)!
const app = (all: OutputChunk[]) => all.find((c) => c.isEntry)!

describe('in an app that splits code', () => {
  it('./names checks names without hashing, while ./lens-reader loads it lazily', async () => {
    const all = await chunks(`import { asDuskName, closeDuskName, isDuskName, nameProblem, nameToShow, toDuskName } from '@duskdomains/sdk/names'
export const rules = [asDuskName, closeDuskName, isDuskName, nameProblem, nameToShow, toDuskName]
export const reader = () => import('@duskdomains/sdk/lens-reader')`)
    const page = loads(all, app(all))
    expect(page).toMatchObject({ curve: false, blake2b: false })
    expect(page.bytes).toBeLessThan(4_000)
    expect(loads(all, lazy(all, 'lens-reader'))).toMatchObject({ curve: false, blake2b: true })
  })

  it('./lens-reader never loads the curve that ./accounts loads, both lazily', async () => {
    const all = await chunks(`export const reader = () => import('@duskdomains/sdk/lens-reader')
export const accounts = () => import('@duskdomains/sdk/accounts')`)
    expect(loads(all, app(all))).toMatchObject({ curve: false, blake2b: false })
    expect(loads(all, lazy(all, 'lens-reader'))).toMatchObject({ curve: false, blake2b: true })
    expect(loads(all, lazy(all, 'accounts'))).toMatchObject({ curve: true, blake2b: false })
  })

  it('./call-facts is one chunk for a service worker, with BLAKE2b and without the curve', async () => {
    const all = await chunks(`import { nameCall, revealsReservation } from '@duskdomains/sdk/call-facts'
import { contractRole } from '@duskdomains/sdk/releases'
export const facts = [nameCall, revealsReservation, contractRole]`)
    expect(all.map((c) => [c.imports, c.dynamicImports])).toEqual([[[], []]])
    expect(loads(all, all[0])).toMatchObject({ curve: false, blake2b: true })
  })
})
