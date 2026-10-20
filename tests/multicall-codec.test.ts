/**
 * The multicall envelope and reply, encoded and decoded by hand: against the multicall's golden vectors,
 * its released data driver (`multicall-driver.wasm.gz`, v0.1.0) on random envelopes and replies, and a
 * reply the deployed contract returned on testnet, whose inner replies the frozen drivers decode.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import {
  ARGBUF_LEN, MAX_CALLS, MULTICALL_CONTRACT_ID, callBytes, decodeAggregate, encodeAggregate, envelopeLength, replyLength,
  type MulticallCall, type MulticallResult,
} from '../src/frozen/multicall.ts'
import { MULTICALL_CONTRACT_ID as exported } from '../src/index.ts'
import { loadDataDriver } from '../src/frozen/driver.ts'
import { hex } from '../src/frozen/bytes.ts'
import { cut, decodeCalls, encodeReply } from './multicall-world.ts'
import { blake2b } from '@noble/hashes/blake2.js'

const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url))
const unhex = (s: string) => Uint8Array.from(Buffer.from(s, 'hex'))
const vectors = JSON.parse(fixture('multicall-vectors.json').toString()) as {
  fn: string; kind: string; json: any; rkyv: string
}[]
/** The released driver, run directly: it needs no version string the SDK's loader checks. */
async function releasedDriver() {
  const bytes = gunzipSync(fixture('multicall-driver.wasm.gz'))
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('d2ed9e7b89d81f12b877f787a7830b90405357c82c9c28f75f0e048530e91462')
  const { instance } = await WebAssembly.instantiate(bytes, { env: {} })
  const d = instance.exports as any
  d.init?.()
  const run = (exported: (...a: number[]) => number, name: string, input: Uint8Array) => {
    const put = (b: Uint8Array) => {
      const ptr = d.alloc(b.length)
      new Uint8Array(d.memory.buffer, ptr, b.length).set(b)
      return [ptr, b.length]
    }
    const args = [...put(new TextEncoder().encode(name)), ...put(input)], out = d.alloc(1 << 20)
    const code = exported(...args, out, 1 << 20)
    if (code !== 0) d.get_last_error(out, 1 << 20)
    const length = new DataView(d.memory.buffer).getUint32(out, true)
    const result = new Uint8Array(d.memory.buffer, out + 4, length).slice()
    d.dealloc(args[0], args[1])
    d.dealloc(args[2], args[3])
    d.dealloc(out, 1 << 20)
    if (code !== 0) throw new Error(new TextDecoder().decode(result))
    return result
  }
  return {
    encode: (calls: MulticallCall[]) => run(d.encode_input_fn, 'aggregate', new TextEncoder().encode(JSON.stringify(calls.map((c) => ({
      contract: hex(c.contract), fn_name: c.fnName, fn_args: hex(c.args), gas_limit: c.gasLimit.toString(),
    }))))),
    decodeReply: (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(run(d.decode_output_fn, 'aggregate', bytes))),
  }
}
const asJson = (a: { height: bigint; results: MulticallResult[] }) => ({
  height: a.height.toString(),
  results: a.results.map((r) => ('Ok' in r ? { Ok: hex(r.Ok) } : { Err: r.Err })),
})
let seed = 20261020
const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n)
const randomBytes = (n: number) => Uint8Array.from({ length: n }, () => rand(256))
const names = ['a', 'home', 'account', 'get_name', 'members', 'interface_version', 'quote_registration', 'x'.repeat(63), 'é', 'ab_cdefg']

describe('the envelope', () => {
  it('ships the deployed v0.1.0 contract ID, which its Wasm, nonce 0 and owner derive', () => {
    expect(MULTICALL_CONTRACT_ID).toBe('93de287b7d349d678a0038fe7772e8960e1a84a1b5da2d0b1f62f532616ce1d4')
    expect(exported).toBe(MULTICALL_CONTRACT_ID)
    const wasm = gunzipSync(fixture('multicall.wasm.gz'))
    expect(createHash('sha256').update(wasm).digest('hex')).toBe('65f77a27c5bf6c7bf78797071dadca102ca3a67e5112c42af0242660e03693d9')
    // BLAKE2b-256(Wasm ‖ nonce as 8 bytes LE ‖ owner bytes), with the owner's public key as the bytes.
    const owner = unhex('8e548653792008458763f12b00e3f04758d5f11abfe206ba6df0c8306a59778139b5419e1b588240d06cef5e09a582c1012894cea66f0ca419788aa0c0f7dfc4afe1c5976eeebd20ebaa0abadadb22079ce0b3ca67fd43d76346741ce42f509b')
    const derive = (nonce: number) => {
      const n = new Uint8Array(8)
      new DataView(n.buffer).setBigUint64(0, BigInt(nonce), true)
      return hex(blake2b(new Uint8Array([...wasm, ...n, ...owner]), { dkLen: 32 }))
    }
    expect(derive(0)).toBe(MULTICALL_CONTRACT_ID)
    expect(derive(1)).not.toBe(MULTICALL_CONTRACT_ID)
  })
  it('equals every golden input vector byte for byte, and its length is predicted', () => {
    expect(createHash('sha256').update(fixture('multicall-vectors.json')).digest('hex')).toBe('4702792c42749f0dce98200e5b3cb968262f134c47fb870c92fef75db43f318b')
    const inputs = vectors.filter((v) => v.fn === 'aggregate' && v.kind === 'input')
    expect(inputs).toHaveLength(2)
    for (const v of inputs) {
      const calls = v.json.map((c: any) => ({ contract: unhex(c.contract), fnName: c.fn_name, args: unhex(c.fn_args), gasLimit: BigInt(c.gas_limit) }))
      expect(hex(encodeAggregate(calls))).toBe(v.rkyv)
      expect(envelopeLength(calls.length, calls.reduce((n: number, c: MulticallCall) => n + callBytes(c.fnName, c.args), 0))).toBe(v.rkyv.length / 2)
      expect(decodeCalls(unhex(v.rkyv)).map((c) => ({ ...c, args: hex(c.args) }))).toEqual(
        calls.map((c: MulticallCall) => ({ contract: hex(c.contract), fn: c.fnName, args: hex(c.args), gasLimit: c.gasLimit })),
      )
    }
  })
  it('equals the released driver on random envelopes: names inline and out of line, empty and long arguments, every gas', async () => {
    const driver = await releasedDriver()
    for (let round = 0; round < 300; round++) {
      const calls = Array.from({ length: rand(round < 250 ? 12 : 60) }, () => ({
        contract: randomBytes(32), fnName: names[rand(names.length)], args: randomBytes(rand(4) === 0 ? rand(700) : rand(40)),
        gasLimit: [0n, 1n, 80_000_000n, 1_114_000_000n, (1n << 64n) - 1n, BigInt(rand(1 << 30))][rand(6)],
      }))
      const mine = encodeAggregate(calls)
      expect(hex(mine), `round ${round}`).toBe(hex(driver.encode(calls)))
      expect(envelopeLength(calls.length, calls.reduce((n, c) => n + callBytes(c.fnName, c.args), 0))).toBe(mine.length)
    }
  })
  it('takes 256 calls and an envelope of exactly 64 KiB, and refuses a 257th call, a byte more, or a bad field', () => {
    const call = (args = 0, fnName = 'home'): MulticallCall => ({ contract: new Uint8Array(32).fill(1), fnName, args: new Uint8Array(args), gasLimit: 0n })
    expect(decodeCalls(encodeAggregate(Array(MAX_CALLS).fill(call())))).toHaveLength(256)
    expect(() => encodeAggregate(Array(MAX_CALLS + 1).fill(call()))).toThrow('at most 256 calls')
    // One call: 8 bytes of root, 56 of slot, so an inline name leaves 65,472 bytes of argument.
    expect(encodeAggregate([call(65_472)])).toHaveLength(ARGBUF_LEN)
    expect(() => encodeAggregate([call(65_473)])).toThrow('at most 65536 bytes')
    // A name of 8 bytes or more sits outside the slot.
    expect(encodeAggregate([call(65_464, 'get_name')])).toHaveLength(ARGBUF_LEN)
    expect(() => encodeAggregate([call(65_465, 'get_name')])).toThrow('at most 65536 bytes')
    expect(() => encodeAggregate([{ ...call(), contract: new Uint8Array(31) }])).toThrow('32 bytes')
    expect(() => encodeAggregate([{ ...call(), gasLimit: -1n }])).toThrow('u64')
    expect(() => encodeAggregate([{ ...call(), gasLimit: 1n << 64n }])).toThrow('u64')
    expect(hex(encodeAggregate([]))).toBe('0000000000000000')
  })
})

describe('the reply', () => {
  it('decodes the golden output vector, an empty Ok included', () => {
    const v = vectors.find((x) => x.fn === 'aggregate' && x.kind === 'output')!
    expect(asJson(decodeAggregate(unhex(v.rkyv), 6))).toEqual(v.json)
    expect(hex(encodeReply(123456n, decodeAggregate(unhex(v.rkyv), 6).results))).toBe(v.rkyv)
  })
  it('decodes random replies as the released driver does, and their length is predicted', async () => {
    const driver = await releasedDriver()
    const messages = ['', 'boom', 'exactly', 'eightchr', 'DuskDS:v1:InvalidArgument', 'é'.repeat(100), 'x'.repeat(200)]
    for (let round = 0; round < 300; round++) {
      const results: MulticallResult[] = Array.from({ length: rand(round < 250 ? 10 : 80) }, () => {
        const k = rand(6)
        if (k <= 1) return { Ok: randomBytes(rand(3) === 0 ? 0 : rand(400)) }
        if (k === 2) return { Err: { Panic: messages[rand(messages.length)] } }
        return { Err: (['OutOfGas', 'DoesNotExist', 'Unknown'] as const)[rand(3)] }
      })
      const height = BigInt(rand(1 << 30)) * BigInt(rand(1 << 20))
      const reply = encodeReply(height, results)
      const out = results.reduce((n, r) => n + ('Ok' in r ? r.Ok.length : typeof r.Err === 'object' && new TextEncoder().encode(r.Err.Panic).length > 7 ? new TextEncoder().encode(r.Err.Panic).length : 0), 0)
      expect(replyLength(results.length, out)).toBe(reply.length)
      const decoded = decodeAggregate(reply, results.length)
      expect(asJson(decoded), `round ${round}`).toEqual(driver.decodeReply(reply))
      expect(decoded.height).toBe(height)
    }
  })
  it('refuses a reply that is not exactly such an archive', () => {
    const good = encodeReply(5n, [{ Ok: Uint8Array.from([1, 2, 3]) }, { Err: { Panic: 'DuskDS:v1:InvalidArgument' } }, { Err: 'OutOfGas' }])
    expect(decodeAggregate(good, 3).results).toHaveLength(3)
    const broken = (change: (b: Uint8Array, v: DataView) => void, length = good.length) => {
      const b = new Uint8Array(length)
      b.set(good.subarray(0, Math.min(length, good.length)))
      change(b, new DataView(b.buffer))
      return b
    }
    const root = good.length - 16
    const cases: [string, Uint8Array, number?][] = [
      ['another count', good, 2],
      ['empty', new Uint8Array(), 0],
      ['truncated', good.subarray(8), 3],
      ['not a multiple of 8', broken(() => {}, good.length + 4), 3],
      ['results past the root', broken((_, v) => v.setInt32(root + 8, 8, true)), 3],
      ['results before the start', broken((_, v) => v.setInt32(root + 8, -root - 16, true)), 3],
      ['misaligned results', broken((_, v) => v.setInt32(root + 8, v.getInt32(root + 8, true) + 1, true)), 3],
      ['a result tag of 2', broken((b) => (b[decodeSlot(good, 0)] = 2)), 3],
      ['an error tag of 4', broken((b) => (b[decodeSlot(good, 2) + 4] = 4)), 3],
      ['an Ok pointing past its data', broken((_, v) => v.setUint32(decodeSlot(good, 0) + 8, 4096, true)), 3],
      ['an Ok pointing before the buffer', broken((_, v) => v.setInt32(decodeSlot(good, 0) + 4, -4096, true)), 3],
      ['a panic message that is not UTF-8', broken((b) => b.fill(0xff, 3, 3 + 25)), 3],
      ['an inline panic longer than its slot', broken((b) => (b[decodeSlot(good, 1) + 15] = 9)), 3],
      ['a reply past 64 KiB', new Uint8Array(ARGBUF_LEN + 8), 0],
    ]
    for (const [label, bytes, n] of cases) expect(() => decodeAggregate(bytes, n ?? 3), label).toThrow(/multicall/)
    // A panic over the contract's 200 bytes is not one it writes.
    expect(() => decodeAggregate(encodeReply(1n, [{ Err: { Panic: 'x'.repeat(201) } }]), 1)).toThrow('Malformed')
    expect(decodeAggregate(encodeReply(1n, [{ Err: { Panic: cut('é'.repeat(150)) } }]), 1).results[0]).toEqual({ Err: { Panic: 'é'.repeat(100) } })
  })
  it('takes out-of-line bytes only where rkyv writes them: never aliased, out of order, overlapping or with a gap, as the released driver refuses them', async () => {
    const driver = await releasedDriver()
    const results: MulticallResult[] = [
      { Ok: Uint8Array.from([0x41, 0x41, 0x41]) }, { Ok: Uint8Array.from([0x42, 0x42, 0x42, 0x42, 0x42]) },
      { Err: { Panic: 'DuskDS:v1:InvalidArgument' } }, { Ok: new Uint8Array() },
    ]
    const good = encodeReply(7n, results)
    expect(asJson(decodeAggregate(good, 4))).toEqual(driver.decodeReply(good))
    // Out of line: [0,3) and [3,8) the Oks, [8,33) the panic, the empty Ok at 33; the results at 36.
    const slot = (i: number) => decodeSlot(good, i)
    const changed = (change: (v: DataView) => void) => {
      const b = good.slice()
      change(new DataView(b.buffer))
      return b
    }
    const ok = (v: DataView, i: number, start: number, length?: number) => {
      v.setInt32(slot(i) + 4, start - (slot(i) + 4), true)
      if (length !== undefined) v.setUint32(slot(i) + 8, length, true)
    }
    const panic = (v: DataView, i: number, start: number) => v.setInt32(slot(i) + 12, start - (slot(i) + 8), true)
    // What the released driver refuses too: one result's bytes claimed again, or claimed out of order.
    const refusedByDriver: [string, Uint8Array][] = [
      ['the second Ok aliasing the first', changed((v) => ok(v, 1, 0, 3))],
      ['the second Ok overlapping the first', changed((v) => ok(v, 1, 2))],
      ['the two Oks swapped', changed((v) => (ok(v, 0, 3, 5), ok(v, 1, 0, 3)))],
      ['the panic aliasing an Ok', changed((v) => panic(v, 2, 0))],
      ['the panic overlapping the second Ok', changed((v) => panic(v, 2, 6))],
    ]
    // What rkyv never writes, though a validator may let it pass: a gap, or bytes in the padding before the results.
    const notWritten: [string, Uint8Array][] = [
      ['a gap before the second Ok', changed((v) => ok(v, 1, 4, 4))],
      ['the empty Ok inside the padding', changed((v) => ok(v, 3, 34, 0))],
      ['the empty Ok at the results', changed((v) => ok(v, 3, 36, 0))],
    ]
    for (const [label, bytes] of [...refusedByDriver, ...notWritten])
      expect(() => decodeAggregate(bytes, 4), label).toThrow('Malformed multicall reply')
    for (const [label, bytes] of refusedByDriver) expect(() => driver.decodeReply(bytes), label).toThrow()
    // A short panic written out of line is valid to a validator, but not what rkyv writes for 7 bytes or fewer.
    const short = encodeReply(7n, [{ Err: { Panic: 'eightchr' } }])
    const shortSlot = decodeSlot(short, 0)
    const outOfLine = short.slice()
    new DataView(outOfLine.buffer).setUint32(shortSlot + 8, 7, true)
    expect(() => decodeAggregate(outOfLine, 1)).toThrow('Malformed multicall reply')
    // 256 results each claiming the same bytes copy nothing: the first claim refuses the reply.
    const many = encodeReply(9n, Array.from({ length: 256 }, () => ({ Ok: new Uint8Array(200) })))
    const aliased = many.slice(), view = new DataView(aliased.buffer)
    for (let i = 1; i < 256; i++) view.setInt32(decodeSlot(many, i) + 4, 0 - (decodeSlot(many, i) + 4), true)
    expect(() => decodeAggregate(aliased, 256)).toThrow('Malformed multicall reply')
    expect(() => driver.decodeReply(aliased)).toThrow()
  })
  it('keeps a panic message\'s leading U+FEFF, inline and out of line, as the released driver does', async () => {
    const driver = await releasedDriver()
    for (const message of ['\uFEFFab', '\uFEFFDuskDS:v1:NotFound']) {
      const reply = encodeReply(9n, [{ Err: { Panic: message } }, { Ok: Uint8Array.from([1]) }])
      expect(decodeAggregate(reply, 2).results[0], JSON.stringify(message)).toEqual({ Err: { Panic: message } })
      expect(driver.decodeReply(reply).results[0], JSON.stringify(message)).toEqual({ Err: { Panic: message } })
    }
  })
  it('decodes what the deployed multicall answered on testnet, each inner reply as the direct read at that block', async () => {
    const live = JSON.parse(gunzipSync(fixture('multicall-testnet.json.gz')).toString())
    expect(live.multicall).toBe(MULTICALL_CONTRACT_ID)
    const calls = live.calls.map((c: any) => ({ contract: unhex(c.contract), fnName: c.fn, args: unhex(c.args), gasLimit: BigInt(c.gasLimit) }))
    expect(hex(encodeAggregate(calls))).toBe(live.envelope)
    const { height, results } = decodeAggregate(unhex(live.reply), calls.length)
    expect(height).toBe(BigInt(live.height))
    const seen: Record<string, unknown> = {}
    live.calls.forEach((c: any, i: number) => {
      const r = results[i]
      // Each Ok is byte for byte the direct read's reply at the same block; each failure a generic HTTP 500 there.
      if (c.direct.ok !== undefined) expect('Ok' in r && hex(r.Ok), c.label).toBe(c.direct.ok)
      else expect(c.direct, c.label).toEqual({ status: 500, body: '{"error":"Internal server error"}' })
      seen[c.label] = 'Ok' in r ? r.Ok.length : r.Err
    })
    expect(seen).toMatchObject({
      'directory.members limit 0': { Panic: 'DuskDS:v1:InvalidArgument' },
      'store.no_such_fn': 'Unknown',
      'missing contract': 'DoesNotExist',
    })
    // The frozen drivers decode the batched bytes: the directory's config and members, the store's name.
    const directory = await loadDataDriver(gunzipSync(fixture('directory.wasm.gz'))),
      store = await loadDataDriver(gunzipSync(fixture('store.wasm.gz')))
    const at = (label: string) => results[live.calls.findIndex((c: any) => c.label === label)] as { Ok: Uint8Array }
    expect((directory.decodeOutput('config', at('directory.config').Ok) as any).binding.network).toBe(2)
    expect((directory.decodeOutput('members', at('directory.members stores').Ok) as any).rows).toHaveLength(1)
    expect((store.decodeOutput('get_name', at('store.get_name rehearsal1018.dusk').Ok) as any).Local.name.label).toBe('rehearsal1018')
  })
})
/** The offset of result `i`'s slot in a reply `encodeReply` wrote. */
function decodeSlot(reply: Uint8Array, i: number): number {
  const v = new DataView(reply.buffer, reply.byteOffset), root = reply.length - 16
  return root + 8 + v.getInt32(root + 8, true) + 16 * i
}
