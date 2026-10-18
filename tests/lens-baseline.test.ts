/**
 * Without a lens, the client answers, fails and reads exactly as the last SDK before the lens. Point
 * SDK_BASELINE at a checkout of that SDK (fedc2d24, with its dependencies installed) to compare; the
 * comparison is skipped without one.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { FrozenClient } from '../src/frozen/client.ts'
import { bytes, id } from './helpers.ts'
import { nameKey } from '../src/frozen/bytes.ts'
import { child, endpoint, lensWorld, ref, released, store, unadmitted, type LensWorld } from './lens-world.ts'

const baseline = process.env.SDK_BASELINE
type Client = Pick<FrozenClient, 'getName' | 'verifyPrimary' | 'previewRegistration' | 'discover' | 'locate' | 'quoteRenewal' |
  'registrationPlacement' | 'prepareRegistration' | 'store' | 'directory' | 'verifyContract'>
const outcome = (run: Promise<unknown>) =>
  run.then((value) => ({ value }), (error: Error) => ({ error: { class: error?.constructor?.name, message: error.message } }))
const reads = (w: LensWorld): Record<string, (c: Client) => Promise<unknown>> => ({
  'getName hinted': (c) => c.getName('child.example.dusk', w.newest),
  'getName unhinted': (c) => c.getName('child.example.dusk'),
  'getName absent': (c) => c.getName('absent.dusk'),
  'getName unadmitted hint': (c) => c.getName('child.example.dusk', unadmitted),
  'getName malformed hint': (c) => c.getName('child.example.dusk', 'not a contract'),
  'getName invalid name': (c) => c.getName('Not A Name'),
  'verifyPrimary hinted': (c) => c.verifyPrimary(endpoint, w.newest),
  'verifyPrimary unhinted': (c) => c.verifyPrimary(endpoint),
  'verifyPrimary none': (c) => c.verifyPrimary(bytes(13, 96)),
  'verifyPrimary invalid endpoint': (c) => c.verifyPrimary(bytes(13, 95)),
  'previewRegistration unseen': (c) => c.previewRegistration({ label: 'fresh', years: 1, actor: bytes(10) }),
  'previewRegistration released': (c) => c.previewRegistration({ label: 'gone', years: 1, actor: bytes(10) }, store(0)),
  'previewRegistration registered': (c) => c.previewRegistration({ label: 'example', years: 1, actor: bytes(10) }),
  discover: (c) => c.discover(),
  'locate records': (c) => c.locate(w.newest, child.root, 'read_records', child),
  quoteRenewal: (c) => c.quoteRenewal(w.newest, { name: ref, years: 1 }),
  registrationPlacement: (c) => c.registrationPlacement(nameKey('fresh.dusk').root),
  prepareRegistration: (c) => c.prepareRegistration({ actor: bytes(10), label: 'fresh', years: 1, secret: bytes(33), commitHeight: 100n }),
  'store read_records': (c) => c.store(w.newest).read_records(child),
  'directory config': (c) => c.directory.config(),
})

describe.skipIf(!baseline)('without a lens, as the SDK before it', () => {
  it.each([1, 4, 64])('answers, fails and reads as the baseline at %i stores, also through a refused store', async (n) => {
    const { FrozenClient: Base } = (await import(`${baseline}/src/frozen/client.ts`)) as { FrozenClient: new (...args: unknown[]) => Client }
    expect(Base).not.toBe(FrozenClient)
    // Exactly the last SDK before the lens.
    expect(execFileSync('git', ['-C', baseline!, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).toBe(
      'fedc2d2421f5beaa77d7806551fc3c45b5c7faaa',
    )
    let compared = 0
    for (const refusedStore of [false, true]) {
      const w = await lensWorld(n, n, { lens: false })
      released(w, 'gone', 0)
      if (refusedStore) w.chain.replies.set('40.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
      const run = async (make: () => Client, read: (c: Client) => Promise<unknown>) => {
        const c = make()
        w.log.length = 0
        await c.verifyContract('directory', id(1))
        const result = await outcome(read(c))
        return { result, log: [...w.log] }
      }
      for (const [name, read] of Object.entries(reads(w))) {
        const ours = await run(() => new FrozenClient(w.release, { transport: w.transport, heightReuseMs: 0 }), read)
        const theirs = await run(() => new Base(w.release, { transport: w.transport, heightReuseMs: 0 }), read)
        expect(ours, `${name}${refusedStore ? ' (refused store)' : ''}`).toEqual(theirs)
        expect(ours.log.length).toBeGreaterThanOrEqual(2)
        compared += ours.log.length
      }
    }
    expect(compared).toBeGreaterThan(200)
  })
})
