/**
 * With batching off, the client answers, fails and reads exactly as 0.4.1: the same results, the same
 * transport calls in the same order, and over HTTP the same requests. Point SDK_041_BASELINE at a checkout
 * of 0.4.1 (a3d3a9d) with its dependencies installed to compare; the comparison is skipped without one.
 */
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { FrozenClient, type ClientOptions } from '../src/frozen/client.ts'
import { bytes, id } from './helpers.ts'
import { nameKey } from '../src/frozen/bytes.ts'
import { child, endpoint, lensWorld, ref, released, store, unadmitted, type LensWorld } from './lens-world.ts'
import { fakeNode } from './multicall-world.ts'

const baseline = process.env.SDK_041_BASELINE
type Client = Pick<FrozenClient, 'getName' | 'resolve' | 'namePage' | 'pricing' | 'bootstrap' | 'verifyPrimary' | 'previewRegistration' |
  'discover' | 'locate' | 'quoteRenewal' | 'registrationPlacement' | 'prepareRegistration' | 'store' | 'directory' | 'verifyContract'>
const outcome = (run: Promise<unknown>) =>
  run.then((value) => ({ value }), (error: Error) => ({ error: { class: error?.constructor?.name, message: error.message } }))
const reads = (w: LensWorld): Record<string, (c: Client) => Promise<unknown>> => ({
  'getName hinted': (c) => c.getName('child.example.dusk', w.newest),
  'getName unhinted': (c) => c.getName('child.example.dusk'),
  'getName absent': (c) => c.getName('absent.dusk'),
  'getName unadmitted hint': (c) => c.getName('child.example.dusk', unadmitted),
  'getName invalid name': (c) => c.getName('Not A Name'),
  'resolve records': (c) => c.resolve('child.example.dusk', ['moonlight_address', 'avatar'], w.newest),
  'namePage subname': (c) => c.namePage('child.example.dusk', w.newest),
  'namePage absent': (c) => c.namePage('absent.dusk'),
  pricing: (c) => c.pricing(),
  bootstrap: (c) => c.bootstrap(),
  'verifyPrimary hinted': (c) => c.verifyPrimary(endpoint, w.newest),
  'verifyPrimary none': (c) => c.verifyPrimary(bytes(13, 96)),
  'previewRegistration unseen': (c) => c.previewRegistration({ label: 'fresh', years: 1, actor: bytes(10) }),
  'previewRegistration released': (c) => c.previewRegistration({ label: 'gone', years: 1, actor: bytes(10) }, store(0)),
  discover: (c) => c.discover(),
  'locate records': (c) => c.locate(w.newest, child.root, 'read_records', child),
  quoteRenewal: (c) => c.quoteRenewal(w.newest, { name: ref, years: 1 }),
  registrationPlacement: (c) => c.registrationPlacement(nameKey('fresh.dusk').root),
  prepareRegistration: (c) => c.prepareRegistration({ actor: bytes(10), label: 'fresh', years: 1, secret: bytes(33), commitHeight: 100n }),
  'store read_records': (c) => c.store(w.newest).read_records(child),
  'directory config': (c) => c.directory.config(),
  'directory registration_context': (c) => c.directory.registration_context(),
  'directory members': (c) => c.directory.members({ kind: 'Store', start: 0, limit: 16 }),
})

describe.skipIf(!baseline)('with batching off, as 0.4.1', () => {
  it.each([1, 4, 64])('answers, fails and reads as 0.4.1 at %i stores, with and without a lens and through a refused store', async (n) => {
    const { FrozenClient: Base } = (await import(`${baseline}/src/frozen/client.ts`)) as { FrozenClient: new (...args: unknown[]) => Client }
    expect(Base).not.toBe(FrozenClient)
    expect(execFileSync('git', ['-C', baseline!, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).toBe('a3d3a9d3c20c35f6d86ad8660a36970295efe1ef')
    let compared = 0
    for (const lens of [true, false])
      for (const refusedStore of [false, true]) {
        const w = await lensWorld(n, n, { lens })
        released(w, 'gone', 0)
        if (refusedStore) w.chain.replies.set('40.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
        for (const [name, read] of Object.entries(reads(w))) {
          const label = `${name}${lens ? '' : ', no lens'}${refusedStore ? ', refused store' : ''}`
          // A custom transport, and over HTTP through the default one.
          for (const http of [false, true]) {
            const run = async (make: (options: ClientOptions) => Client) => {
              const node = fakeNode(w.transport, { height: () => w.chain.height })
              const options: ClientOptions = http ? { fetch: node.fetch, heightReuseMs: 0 } : { transport: w.transport, heightReuseMs: 0 }
              const c = make(options)
              await c.verifyContract('directory', id(1))
              w.log.length = 0
              node.requests.length = 0
              const result = await outcome(read(c))
              return { result, log: [...w.log], requests: node.requests.map((r) => `${r.kind}:${r.fn ?? ''}:${r.status}`) }
            }
            const ours = await run((o) => new FrozenClient(w.release, { ...o, multicall: false }))
            const theirs = await run((o) => new Base(w.release, o))
            expect(ours, `${label}${http ? ' over HTTP' : ''}`).toEqual(theirs)
            // Not given `multicall`, a custom transport reads one query at a time, as before.
            if (!http) expect(await run((o) => new FrozenClient(w.release, o)), label).toEqual(theirs)
            compared += ours.log.length
          }
        }
      }
    expect(compared).toBeGreaterThan(400)
  })
})
