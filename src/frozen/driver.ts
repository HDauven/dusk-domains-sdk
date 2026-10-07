/** WASM data-driver adapter with lossless JSON decoding. @module */
import { parseJson } from './json.ts'
export interface DataDriver {
  encodeInput(functionName: string, json: string): Uint8Array
  decodeInput(functionName: string, bytes: Uint8Array): unknown
  decodeOutput(functionName: string, bytes: Uint8Array): unknown
  decodeEvent(topic: string, bytes: Uint8Array): unknown
  schema(): unknown
  version(): string
}
type Ffi = (...args: number[]) => number
interface DriverExports {
  memory: WebAssembly.Memory
  alloc: Ffi
  dealloc: Ffi
  [key: string]: WebAssembly.Memory | Ffi
}
/** Instantiate already verified bytes. The release loader verifies hashes before calling this. */
export async function loadDataDriver(bytes: Uint8Array): Promise<DataDriver> {
  const { instance } = await WebAssembly.instantiate(new Uint8Array(bytes), {
    env: {},
  })
  const ex = instance.exports as unknown as DriverExports
  for (const key of [
    'alloc',
    'dealloc',
    'encode_input_fn',
    'decode_input_fn',
    'decode_output_fn',
    'decode_event',
    'get_last_error',
    'get_schema',
    'get_version',
  ]) {
    if (typeof ex[key] !== 'function')
      throw new Error(`Invalid data driver: missing ${key}`)
  }
  if (!(ex.memory instanceof WebAssembly.Memory))
    throw new Error('Invalid data driver memory')
  const encoder = new TextEncoder(),
    decoder = new TextDecoder('utf-8', { fatal: true })
  function invoke(name: string, inputs: Uint8Array[] = []): Uint8Array {
    const allocated: [number, number][] = []
    try {
      const args: number[] = []
      for (const input of inputs) {
        const ptr = ex.alloc(input.length)
        allocated.push([ptr, input.length])
        new Uint8Array(ex.memory.buffer, ptr, input.length).set(input)
        args.push(ptr, input.length)
      }
      // Schemas can exceed 64 KiB; the contract's wire envelopes remain bounded separately.
      const size = 2 * 1024 * 1024,
        out = ex.alloc(size)
      allocated.push([out, size])
      const code = (ex[name] as Ffi)(...args, out, size)
      if (code !== 0) {
        ;(ex.get_last_error as Ffi)(out, size)
        const len = new DataView(ex.memory.buffer).getUint32(out, true)
        if (len > size - 4) throw new Error('Malformed driver error')
        throw new Error(
          decoder.decode(new Uint8Array(ex.memory.buffer, out + 4, len)),
        )
      }
      const len = new DataView(ex.memory.buffer).getUint32(out, true)
      if (len > size - 4) throw new Error('Malformed driver output')
      return new Uint8Array(ex.memory.buffer, out + 4, len).slice()
    } finally {
      for (const [ptr, len] of allocated.reverse()) ex.dealloc(ptr, len)
    }
  }
  const decode = (entry: string, name: string, data: Uint8Array): unknown => {
    if (data.length > 32768)
      throw new Error('Wire envelope exceeds 32768 bytes')
    return parseJson(
      decoder.decode(invoke(entry, [encoder.encode(name), data])),
    )
  }
  if (typeof ex.init === 'function') ex.init()
  const driver: DataDriver = {
    encodeInput(name, json) {
      if (encoder.encode(json).length > 32768 * 8)
        throw new Error('JSON envelope too large')
      const result = invoke('encode_input_fn', [
        encoder.encode(name),
        encoder.encode(json),
      ])
      if (result.length > 32768)
        throw new Error('Wire envelope exceeds 32768 bytes')
      return result
    },
    decodeInput: (name, data) => decode('decode_input_fn', name, data),
    decodeOutput: (name, data) => decode('decode_output_fn', name, data),
    decodeEvent: (name, data) => decode('decode_event', name, data),
    schema: () => parseJson(decoder.decode(invoke('get_schema'))),
    version: () => decoder.decode(invoke('get_version')),
  }
  if (driver.version() !== '1.0.0')
    throw new Error('Unsupported frozen driver version')
  return driver
}
