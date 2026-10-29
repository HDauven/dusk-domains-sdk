/**
 * TypeScript SDK and integration helpers for Dusk Domains, the `.dusk` name service.
 *
 * Import the root for the client and the core API: `createClientFromManifest` and
 * `FrozenClient` for verified reads, the frozen wire types, lossless JSON, helpers for
 * names, commitments, pricing and records, the write builders and the indexer client.
 * `./writes`, `./marketplace`, `./indexer` and `./names` are narrower imports of parts of it;
 * `./connect-app`, `./projection`, `./event-catalog`, `./chain-addresses`, `./lens-reader`,
 * `./accounts`, `./call-facts` and `./releases` hold the rest.
 *
 * @module
 */
export * from './frozen/types.ts'
export * from './frozen/bytes.ts'
export {
  parseJson,
  stringifyJson,
  lux,
  U64_MAX,
  type JsonValue,
} from './frozen/json.ts'
export * from './frozen/wire.ts'
export * from './frozen/driver.ts'
export * from './frozen/manifest.ts'
export * from './frozen/transport.ts'
export * from './frozen/client.ts'
export * from './frozen/controllers.ts'
export * from './frozen/calls.ts'
export * from './frozen/builders.ts'
export * from './frozen/actions.ts'
export * from './frozen/gas.ts'
export * from './core/names.ts'
export * from './core/name-status.ts'
export * from './core/lifecycle.ts'
export * from './core/commitment.ts'
export * from './core/pricing.ts'
export * from './core/principal.ts'
export * from './core/records.ts'
export * from './core/reservations.ts'
export * from './core/primary.ts'
export * from './runtime/config.ts'
export * from './writes/balance.ts'
export * from './writes/transactions.ts'
export * from './indexer.ts'
