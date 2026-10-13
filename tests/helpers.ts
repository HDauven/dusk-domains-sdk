import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { loadDataDriver, type DataDriver } from '../src/frozen/driver.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { FrozenClient } from '../src/frozen/client.ts'
import { hex, nameKey } from '../src/frozen/bytes.ts'
import { initCommitment } from '../src/frozen/trust.ts'
import { launchPolicyConfig } from '../src/core/pricing.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'
import type {
  ContractRole,
  LoadedRelease,
  ReleaseContract,
} from '../src/frozen/manifest.ts'
import { methodCatalog } from '../src/frozen/catalog.ts'
import { indexerEventCatalog } from '../src/indexer/events/indexerEventCatalog.ts'
import type { Admission, Market, RegistrationQuote, WireTypes } from '../src/frozen/types.ts'
export const bytes = (n: number, length = 32): number[] => Array(length).fill(n)
export const id = (n: number): string =>
  n.toString(16).padStart(2, '0').repeat(32)
export interface Golden {
  type: string
  json: unknown
  rkyv: string
}
export function fixtures(name = 'frozen-v1'): Record<string, Golden> {
  const rows = parseJson(
    gunzipSync(
      readFileSync(new URL(`fixtures/${name}.json.gz`, import.meta.url)),
    ).toString(),
  ) as Record<string, Golden>
  if (name === 'market-v1')
    for (const [key, row] of Object.entries(rows)) {
      const [kind, method] = key.split(':')
      const spec = methodCatalog.marketplace.find((m) => m.name === method)
      row.type =
        kind === 'input'
          ? spec!.input
          : kind === 'output'
            ? spec!.output
            : kind === 'event'
              ? indexerEventCatalog[method as keyof typeof indexerEventCatalog]
                  .type
              : kind === 'custody'
                ? 'CustodyIntent'
                : kind === 'payment'
                  ? 'MarketPayment'
                  : kind === 'kind'
                    ? 'OrderKind'
                    : kind === 'status'
                      ? 'OrderStatus'
                      : kind === 'reason'
                        ? 'CloseReason'
                        : kind === 'order'
                          ? 'Order'
                          : 'Option<Order>'
    }
  return rows
}
export function sample<T extends keyof WireTypes>(
  type: T,
  key: string = type,
): WireTypes[T] {
  return wireValue(type, fixtures()[key].json)
}
export function driverBytes(role: ContractRole): Uint8Array {
  return gunzipSync(
    readFileSync(new URL(`fixtures/${role}.wasm.gz`, import.meta.url)),
  )
}
/** The test deployment's binding: directory 1, vault 2, network 1. */
export const testBinding = { directory: bytes(1), vault: bytes(2), network: 1 }
/** The release commitments the golden directory records (all 7s) carry, as hex. */
export const sevens = hex(bytes(7))
/** A policy's init commitment over its live `config` under the test binding, with `driver`. */
export function policyInitHash(driver: DataDriver, config: unknown): string {
  return initCommitment(driver, wireValue('InitPolicy', { binding: testBinding, config }))
}
let cached: Promise<LoadedRelease> | undefined
/**
 * The test release with the reviewed WASM drivers. Every contract carries the code and init
 * commitments a release does: the golden directory records' 7s, and for the policy its live
 * initialization with the golden config.
 */
export function release(): Promise<LoadedRelease> {
  return (cached ??= (async () => {
    const provenance = JSON.parse(
      readFileSync(new URL('fixtures/drivers.json', import.meta.url), 'utf8'),
    )
    const roles: ContractRole[] = [
        'directory',
        'vault',
        'policy',
        'store',
        'resolver',
        'marketplace',
      ],
      drivers = new Map<string, DataDriver>(),
      contracts = new Map<string, ReleaseContract>()
    for (const [i, role] of roles.entries()) {
      const driver = await loadDataDriver(driverBytes(role))
      const c: ReleaseContract = {
        role,
        contractId: id(i + 1),
        dataDriver: { path: `${role}.wasm`, ...provenance[role] },
        codeHash: sevens,
        initHash: role === 'policy' ? policyInitHash(driver, sample('PolicyConfig')) : sevens,
      }
      contracts.set(c.contractId, c)
      drivers.set(c.contractId, driver)
    }
    return {
      manifest: {
        chainId: 'dusk:1',
        network: 1,
        nodeUrl: 'https://node.invalid',
        indexerUrl: 'https://indexer.invalid',
        contracts: [...contracts.values()],
      },
      contracts,
      drivers,
      artifactBaseUrl: 'https://release.invalid/',
    }
  })())
}

/** Test transports answer in JSON; the reviewed WASM drivers decode rkyv and cannot encode outputs. */
export const jsonDriver: DataDriver = {
  encodeInput: (_, json) => new TextEncoder().encode(json),
  decodeInput: (_, b) => parseJson(new TextDecoder().decode(b)),
  decodeOutput: (_, b) => parseJson(new TextDecoder().decode(b)),
  decodeEvent: (_, b) => parseJson(new TextDecoder().decode(b)),
  version: () => '1.0.0',
  schema: () => ({}),
}
/**
 * The test release, with JSON drivers for clients that read from a test transport. Its policy's
 * init commitment is over the launch config, which the JSON transports answer.
 */
export async function jsonRelease(): Promise<LoadedRelease> {
  const original = await release()
  const contracts = new Map(
    [...original.contracts].map(([cid, c]) => [
      cid,
      c.role === 'policy' ? { ...c, initHash: policyInitHash(jsonDriver, launchPolicyConfig()) } : c,
    ]),
  )
  return {
    ...original,
    manifest: { ...structuredClone(original.manifest), contracts: [...contracts.values()] },
    contracts,
    drivers: new Map([...original.contracts.keys()].map((c) => [c, jsonDriver])),
  }
}
const roles: ContractRole[] = ['directory', 'store', 'resolver', 'vault', 'policy', 'marketplace']
const encodeJson = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
/**
 * The directory's rkyv record (`member` or `market` reply) of contract `id`: the golden row,
 * whose hashes are all 7s, with this ID and optionally other code and init hashes.
 */
export function directoryRecord(
  fn: 'member' | 'market',
  id: number[],
  { codeHash = bytes(7), initHash = bytes(7) } = {},
): Uint8Array {
  const record = Uint8Array.from(Buffer.from(fixtures()[fn === 'member' ? 'Option<Admission>' : 'Option<Market>'].rkyv, 'hex'))
  // After the option tag and its padding; a market's state and version precede its hashes.
  const code = fn === 'member' ? 42 : 58
  record.set(id, 8)
  record.set(codeHash, code)
  record.set(initHash, code + 32)
  return record
}
/**
 * A transport answering a client's verification reads for every contract of `r` as this
 * deployment (directory 1, vault 2, network 1) at `selection.height` (100 by default): JSON for
 * test JSON drivers, rkyv for the reviewed WASM drivers. The directory selects `selection` (the
 * release's policy at version 1 by default) and the policy answers the config its init
 * commitment covers. `reply` answers any other read.
 */
export function verificationTransport(
  r: LoadedRelease,
  reply: (target: string, fn: string, args: unknown) => unknown = (target, fn) => {
    throw new Error(`Unexpected test read ${target}.${fn}`)
  },
  selection: { policy?: number[]; version?: bigint; height?: bigint } = {},
): ReadTransport {
  return {
    currentBlockHeight: async () => selection.height ?? 100n,
    read: async (target, fn, data) => {
      const role = r.contracts.get(target)?.role
      const json = r.drivers.get(target) === jsonDriver
      const store = role === 'store',
        custody = role === 'store' || role === 'marketplace'
      if (fn === 'interface_version' && role)
        return json
          ? encodeJson({ kind: role[0].toUpperCase() + role.slice(1), version: 1, move_version: store ? 1 : 0, custody_version: custody ? 1 : 0 })
          : Uint8Array.from([roles.indexOf(role), 0, 1, 0, store ? 1 : 0, 0, custody ? 1 : 0, 0])
      if (fn === 'binding')
        return json
          ? encodeJson({ directory: bytes(1), vault: bytes(2), network: 1 })
          : Uint8Array.from([...bytes(1), ...bytes(2), 1])
      if (fn === 'order_api_version') return json ? encodeJson(1) : Uint8Array.from([1, 0])
      const args = (json ? parseJson(new TextDecoder().decode(data)) : r.drivers.get(target)?.decodeInput(fn, data)) as { id?: number[] }
      // The directory's own record of each contract it admitted.
      if ((fn === 'member' || fn === 'market') && role === 'directory')
        return json
          ? encodeJson({ ...sample(fn === 'member' ? 'Admission' : 'Market'), id: args.id, interface_version: 1 })
          : directoryRecord(fn, args.id!)
      if (fn === 'config' && role === 'policy')
        return json ? encodeJson(launchPolicyConfig()) : Uint8Array.from(Buffer.from(fixtures().PolicyConfig.rkyv, 'hex'))
      if (fn === 'registration_context' && role === 'directory' && json) {
        const policy = r.manifest.contracts.find((c) => c.role === 'policy')!.contractId
        return encodeJson({
          ...sample('RegistrationContext'),
          policy: selection.policy ?? Array.from(Buffer.from(policy, 'hex')),
          policy_version: selection.version ?? 1n,
        })
      }
      return encodeJson(reply(target, fn, args))
    },
  }
}
/** The directory's record of `r`'s contract, for verifying it without a directory read. */
export function evidence(c: ReleaseContract): Admission | Market | undefined {
  const id = Array.from({ length: 32 }, (_, i) => Number.parseInt(c.contractId.slice(i * 2, i * 2 + 2), 16))
  if (c.role === 'store' || c.role === 'resolver')
    return { ...sample('Admission'), id, interface_version: 1 }
  if (c.role === 'marketplace') return { ...sample('Market'), id, interface_version: 1 }
  return undefined
}
/** A client of `r` that verified every contract its release lists; sign through its `release`. */
export async function verifiedClient(r?: LoadedRelease): Promise<FrozenClient> {
  const reviewed = r ?? (await jsonRelease())
  const client = new FrozenClient(reviewed, { transport: verificationTransport(reviewed) })
  for (const c of reviewed.manifest.contracts)
    await client.verifyContract(c.role, c.contractId, evidence(c))
  return client
}
/** The release of a client that verified every contract `r` lists. */
export async function verifiedRelease(r?: LoadedRelease): Promise<LoadedRelease> {
  return (await verifiedClient(r)).release
}
/**
 * A client whose store answers `quote_registration` with `quote` at the quote's height, while the
 * directory selects the quote's policy and version: a quote a client accepts.
 */
export async function quotingClient(
  quote: RegistrationQuote,
  r?: LoadedRelease,
): Promise<FrozenClient> {
  const reviewed = r ?? (await jsonRelease())
  return new FrozenClient(reviewed, {
    transport: verificationTransport(reviewed, (target, fn) => {
      if (fn === 'quote_registration' && reviewed.contracts.get(target)?.role === 'store') return quote
      throw new Error(`Unexpected test read ${target}.${fn}`)
    }, { policy: quote.policy, version: quote.policy_version, height: quote.height }),
  })
}
export const quoteArgs = (quote: RegistrationQuote) => ({
  node: nameKey('example.dusk').node,
  label: 'example',
  years: 1,
  actor: bytes(1),
  expected_policy_version: quote.policy_version,
  expected_policy_config_version: quote.quote.config_version,
})
/**
 * Quote a registration as an integration does: the release's store answers `quote_registration`
 * with `quote`, and a client verifies the policy that priced it against `r` before returning it.
 */
export async function clientQuote(
  quote: RegistrationQuote,
  r?: LoadedRelease,
): Promise<RegistrationQuote> {
  const client = await quotingClient(quote, r),
    store = client.release.manifest.contracts.find((c) => c.role === 'store')!
  return client.quoteRegistration(store.contractId, quoteArgs(quote))
}
