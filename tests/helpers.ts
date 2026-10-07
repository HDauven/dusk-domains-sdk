import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseJson } from '../src/frozen/json.ts'
import { loadDataDriver, type DataDriver } from '../src/frozen/driver.ts'
import { wireValue } from '../src/frozen/wire.ts'
import type {
  ContractRole,
  LoadedRelease,
  ReleaseContract,
} from '../src/frozen/manifest.ts'
import { methodCatalog } from '../src/frozen/catalog.ts'
import { indexerEventCatalog } from '../src/indexer/events/indexerEventCatalog.ts'
import type { WireTypes } from '../src/frozen/types.ts'
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
let cached: Promise<LoadedRelease> | undefined
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
      const c: ReleaseContract = {
        role,
        contractId: id(i + 1),
        dataDriver: { path: `${role}.wasm`, ...provenance[role] },
      }
      contracts.set(c.contractId, c)
      drivers.set(c.contractId, await loadDataDriver(driverBytes(role)))
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
