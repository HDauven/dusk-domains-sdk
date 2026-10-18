/**
 * The renewal price the SDK computes against the real store. `fixtures/renewal-exactness.json.gz` holds
 * what protocol ab905e64's own code answers for 254 states: the store's `get_name` (the page's name), its
 * production `quote_renewal` entrypoint at every year count, and the lens's own `renewal_inputs`
 * (`fixtures/README.md`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { FrozenClient } from '../src/frozen/client.ts'
import { hex, nameKey } from '../src/frozen/bytes.ts'
import { parseJson } from '../src/frozen/json.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { PRICED_STORES, pageRenewalQuote, renewalInputs, type RenewalInputs } from '../src/frozen/lens.ts'
import { id } from './helpers.ts'
import { lensWorld } from './lens-world.ts'
import type { Located, NameKey, NameView, RenewalSchedule } from '../src/frozen/types.ts'

const V1_STORE = 'ab7c6e22b4bda3707cee67e584b0070b158821bf404d0da37c1b6c69f84094b2'
const GRACE = 259_200n
type Result = [bigint, string, string, bigint, bigint] | string
interface Case {
  note: string
  view: Located<NameView>
  key: NameKey
  spelling: string
  height: bigint
  schedule: RenewalSchedule
  inputs: RenewalInputs | null
  results: Result[]
}
function load(text: string): { years: number[]; cases: Case[] } {
  const f = parseJson(text) as { format: string; years: number[]; schedules: unknown[]; views: unknown[]; cases: Record<string, any>[] }
  expect(f.format).toBe('dusk-domains/renewal-exactness/v1')
  const schedules = f.schedules.map((s) => wireValue('RenewalSchedule', s))
  const views = f.views.map((v) => wireValue('Located<NameView>', v))
  return {
    years: f.years.map(Number),
    cases: f.cases.map((c) => {
      const view = views[Number(c.view)]
      const local = typeof view === 'object' && 'Local' in view ? view.Local : undefined
      // The page of a name no store holds is for the name the note gives.
      const spelling = local ? spellingOf(local) : 'nobody.dusk'
      return {
        note: c.note, view, key: local?.name.key ?? nameKey(spelling), spelling, height: BigInt(c.height),
        schedule: schedules[Number(c.schedule)], inputs: c.inputs === null ? null : (wireValue('RenewalInputs', c.inputs) as RenewalInputs),
        results: c.results.map((r: unknown) =>
          Array.isArray(r) ? [BigInt(r[0]), String(r[1]), String(r[2]), BigInt(r[3]), BigInt(r[4])] : String(r)),
      }
    }),
  }
}
const spellingOf = (v: NameView) => (v.name.subname ? `${v.name.label}.parent.dusk` : `${v.name.label}.dusk`)
const text = gunzipSync(readFileSync(new URL('fixtures/renewal-exactness.json.gz', import.meta.url))).toString()
const fixture = load(text)
const local = (c: Case) => (typeof c.view === 'object' && 'Local' in c.view ? c.view.Local : undefined)
/** Why the SDK may leave a quote the store gives to a direct read: what the page cannot show. */
const reason = (c: Case) => {
  const v = local(c)
  if (v?.move_pending) return 'a move pending, which may be finalizing'
  if (v && v.name.grace_end !== v.name.expires_at + GRACE) return 'a grace end off the grace period'
  return undefined
}

/** Every case's quotes, as the SDK computes them, against the store's. */
function check({ years, cases }: { years: number[]; cases: Case[] }) {
  const tally = { computed: 0, quoted: 0, refused: 0, direct: {} as Record<string, number> }
  for (const c of cases) {
    const v = local(c),
      root = v && hex(c.key.root) === hex(c.key.node)
    // The SDK holds a lens page to the inputs its name gives: the lens's own are those.
    if (root) expect(renewalInputs(v, c.schedule, c.height), c.note).toEqual(c.inputs)
    else expect(c.inputs, c.note).toBeNull()
    const page = { height: c.height, key: c.key, value: c.view, renewal: c.inputs }
    years.forEach((y, i) => {
      const store = c.results[i],
        sdk = pageRenewalQuote(page, y, V1_STORE)
      const at = `${c.note} at ${c.height}, ${y} years`
      if (Array.isArray(store)) tally.quoted++
      else tally.refused++
      if (sdk) {
        // Computed: the store's quote exactly.
        expect(store, at).toEqual([sdk.schedule_version, sdk.total_lux, sdk.referral_lux, sdk.new_expiry, sdk.new_grace_end])
        tally.computed++
        // A store of other code is never priced.
        expect(pageRenewalQuote(page, y, 'ee'.repeat(32)), at).toBeUndefined()
        expect(pageRenewalQuote(page, y, undefined), at).toBeUndefined()
      } else if (Array.isArray(store)) {
        // A quote left to a direct read: only for what the page cannot show.
        const why = reason(c)
        expect(why, at).toBeDefined()
        tally.direct[why!] = (tally.direct[why!] ?? 0) + 1
      }
    })
  }
  return tally
}

describe('the renewal price computed from a page', () => {
  it('is the store\'s quote wherever the SDK computes one, and never one the store refuses', () => {
    expect(createHash('sha256').update(text).digest('hex')).toBe('30e5c4e2ffe70cefe1f18a32b659e4ed7716b2a3600343dc33f07da9c6bfa951')
    expect(fixture.cases).toHaveLength(254)
    // 14: a move preparing at two heights, 7 years each; 28: the off-period grace end at three heights.
    expect(check(fixture)).toEqual({
      computed: 1124, quoted: 1166, refused: 2390,
      direct: { 'a move pending, which may be finalizing': 14, 'a grace end off the grace period': 28 },
    })
    expect([...PRICED_STORES]).toEqual([V1_STORE])
  })

  it('covers every tier, lifecycle point, year count and refusal the store has', () => {
    const notes = new Set(fixture.cases.map((c) => c.note))
    for (const label of ['a', 'ab', 'abc', 'abcd', 'abcde', 'rehearsal1018'])
      for (const years of [1, 10]) for (const referred of ['', ', referred']) expect(notes).toContain(`${label} for ${years} years${referred}`)
    for (const note of ['a subname', 'a move preparing', 'a move past its end', 'a move finalizing', 'in custody', 'renewed for 3 years in its grace',
      're-registered after its release', 'never registered', 'a grace end off the grace period', 'heights at the end of u64'])
      expect(notes).toContain(note)
    const answers = new Set(fixture.cases.flatMap((c) => c.results.map((r) => (Array.isArray(r) ? 'quote' : r))))
    expect([...answers].sort()).toEqual(['Absent', 'Expired', 'InvalidArgument', 'MovePending', 'Overflow', 'quote'])
    // Active, in grace and past it.
    const statuses = new Set(fixture.cases.map((c) => {
      const v = local(c)
      return !v ? 'absent' : c.height < v.name.expires_at ? 'active' : c.height < v.name.grace_end ? 'grace' : 'released'
    }))
    expect([...statuses].sort()).toEqual(['absent', 'active', 'grace', 'released'])
    expect(fixture.years).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 255])
  })

  it('is what a client shows for a lens page of each state, and what it quotes directly where it cannot', async () => {
    const w = await lensWorld(1, 1, { storeCode: V1_STORE })
    const newest = w.newest
    let current: Case | undefined
    const { read } = w.transport
    // The store answers quote_renewal as the real one did for this state.
    w.transport.read = async (target, fn, data) => {
      if (fn !== 'quote_renewal' || !current) return read(target, fn, data)
      w.log.push(`${target.slice(0, 2)}.${fn}`)
      const years = Number((parseJson(new TextDecoder().decode(data)) as { years: number }).years)
      const r = current.results[fixture.years.indexOf(years)]
      if (r === 'Absent') return new TextEncoder().encode('"Absent"')
      if (typeof r === 'string') throw new Error(`Contract read failed (${target}.quote_renewal): ${r}`)
      return new TextEncoder().encode(
        `{"Local":{"schedule_version":${r[0]},"total_lux":"${r[1]}","referral_lux":"${r[2]}","new_expiry":${r[3]},"new_grace_end":${r[4]}}}`,
      )
    }
    let computed = 0,
      direct = 0
    for (const c of fixture.cases) {
      current = c
      const v = local(c)
      w.chain.height = c.height
      w.chain.schedule = c.schedule
      w.chain.homes = new Map(v || c.note === 'never registered' ? (v ? [[`${newest}:${hex(c.key.root)}`, 'Local']] : []) : [])
      w.chain.names = new Map(v ? [[`${newest}:${hex(c.key.node)}`, v]] : [])
      w.chain.records = new Map()
      // The lens page carries the lens's own renewal inputs.
      w.chain.lensReply = (fn, reply) => {
        if (fn === 'name_page' && reply.Ok) reply.Ok.renewal = c.inputs
        return reply
      }
      w.fallbacks.length = 0
      const client = new FrozenClient(w.release, { transport: w.transport, heightReuseMs: 0, onLensFallback: (f) => void w.fallbacks.push(f) })
      await client.verifyContract('directory', id(1))
      const page = await client.namePage(c.spelling, newest)
      expect(w.fallbacks, c.note).toEqual([])
      expect(page.renewal, c.note).toEqual(c.inputs)
      for (const [i, y] of fixture.years.entries()) {
        w.log.length = 0
        const shown = await client.previewRenewal(page, y).then((value) => ({ value }), (error: Error) => ({ error: error.message }))
        const store = c.results[i],
          at = `${c.note} at ${c.height}, ${y} years`
        if (Array.isArray(store))
          expect(shown, at).toEqual({ value: { store: newest, forwards: [], height: page.height, value: { Local: {
            schedule_version: store[0], total_lux: store[1], referral_lux: store[2], new_expiry: store[3], new_grace_end: store[4],
          } } } })
        else if (store === 'Absent') expect(shown, at).toMatchObject({ value: { value: 'Absent' } })
        else expect(shown, at).toEqual({ error: expect.stringContaining(`: ${store}`) })
        const read = w.log.includes(`${newest.slice(0, 2)}.quote_renewal`)
        expect(read, at).toBe(pageRenewalQuote(page, y, V1_STORE) === undefined)
        if (read) direct++
        else computed++
      }
    }
    expect({ computed, direct }).toEqual({ computed: 1124, direct: 254 * 14 - 1124 })
  }, 120_000)
})
