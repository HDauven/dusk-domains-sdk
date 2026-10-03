import { DUSK_DOMAINS_PLACEHOLDER_CONTRACT_ID } from './callContracts'
import type { DuskConnectAppLike, DuskDomainCallMetadata, DuskDomainContractMap } from './callTypes'
import { toDuskDomainWireArgs } from './callWireArgs'

// A deployment is a contract pool (ADR 0002 in dusk-domains-protocol): names live in the registry
// that created them, and only the newest registry creates new ones. Core calls without an explicit
// contractId go to the registry the router names for them.

type PoolTarget =
  | { kind: 'name'; node: string }
  | { kind: 'registration'; node: string }
  | { kind: 'new_name' }
  | { kind: 'primary'; endpointType: string; endpointValue: string }

// Registries never lose a name, so a located registry stays correct for the router's lifetime.
const MAX_LOCATED_REGISTRIES = 256
let locatedRegistries = new WeakMap<DuskConnectAppLike, Map<string, string>>()
const routedRegistries = new WeakMap<DuskDomainCallMetadata, { cache: Map<string, string>; key: string; registry: string }>()

function registryCache(app: DuskConnectAppLike, contracts: DuskDomainContractMap, node: string) {
  const router = poolRouter(contracts)
  if (!router || !app.chainId) return null
  let cache = locatedRegistries.get(app)
  if (!cache) {
    cache = new Map()
    locatedRegistries.set(app, cache)
  }
  return { cache, key: `${app.chainId}:${router.toLowerCase()}:${node.toLowerCase()}` }
}

export async function withRoutedDuskDomainCall<T>(
  app: DuskConnectAppLike,
  call: DuskDomainCallMetadata,
  contracts: DuskDomainContractMap,
  operation: (routed: DuskDomainCallMetadata) => Promise<T>,
): Promise<T> {
  const chainId = app.chainId
  const routed = await routeDuskDomainCall(app, call, contracts)
  const entry = routedRegistries.get(routed)
  try {
    if (app.chainId !== chainId) throw new Error('Dusk Domains chain changed during registry routing.')
    const result = await operation(routed)
    if (entry) {
      entry.cache.delete(entry.key)
      entry.cache.set(entry.key, entry.registry)
      if (entry.cache.size > MAX_LOCATED_REGISTRIES) entry.cache.delete(entry.cache.keys().next().value!)
    }
    return result
  } catch (error) {
    if (entry) entry.cache.delete(entry.key)
    throw error
  }
}

const nameCalls = new Set([
  'renew_runtime',
  'update_authorities_runtime',
  'escrow_fixed_sale_runtime',
  'escrow_auction_runtime',
  'accept_marketplace_offer_runtime',
  'set_record_sender_runtime',
  'clear_record_sender_runtime',
  'mutate_records_sender_runtime',
  'set_primary_name_runtime',
  'move_records_runtime',
  'prune_subname_runtime',
  'remove_subname_runtime',
  'take_back_subnames_runtime',
  'get_name',
  'registration_premium',
  'read_record',
  'record_slot',
])

export async function routeDuskDomainCall(
  app: DuskConnectAppLike,
  call: DuskDomainCallMetadata,
  contracts: DuskDomainContractMap,
): Promise<DuskDomainCallMetadata> {
  if (call.contract !== 'core' || call.contractId !== undefined || !poolRouter(contracts)) return call
  const target = poolTarget(call)
  if (!target) return call

  const chainId = app.chainId
  const cacheEntry = target.kind === 'name' || target.kind === 'registration'
    ? registryCache(app, contracts, target.node) : null
  const located = target.kind === 'name' || target.kind === 'registration'
    ? await locateNameRegistry(app, contracts, target.node) : null
  const registry = target.kind === 'new_name'
    ? await activeRegistry(app, contracts)
    : target.kind === 'primary'
      ? await readRegistry(app, contracts, {
        contract: 'router',
        functionName: 'locate_primary',
        kind: 'read',
        args: { endpointType: target.endpointType, endpointValue: target.endpointValue },
      })
      : located ?? (target.kind === 'registration' ? await activeRegistry(app, contracts) : null)
  if (app.chainId !== chainId) throw new Error('Dusk Domains chain changed during registry routing.')
  if (!registry) return call
  const routed = { ...call, contractId: registry }
  if (located && (target.kind === 'name' || target.kind === 'registration')) {
    if (cacheEntry) routedRegistries.set(routed, { ...cacheEntry, registry })
  }
  return routed
}

/**
 * The registry a registration must use from its commit onward: the one that already holds the name
 * (a released name comes back in its own registry), otherwise the router's active registry.
 */
export async function registrationRegistry(
  app: DuskConnectAppLike,
  contracts: DuskDomainContractMap,
  node: string,
): Promise<string | null> {
  if (!poolRouter(contracts)) return null
  return await locateNameRegistry(app, contracts, node) ?? await activeRegistry(app, contracts)
}

export async function locateNameRegistry(
  app: DuskConnectAppLike,
  contracts: DuskDomainContractMap,
  node: string,
): Promise<string | null> {
  const router = poolRouter(contracts)
  if (!router) return null
  const entry = registryCache(app, contracts, node)
  const cached = entry?.cache.get(entry.key)
  if (cached) return cached
  const registry = await readRegistry(app, contracts, {
    contract: 'router',
    functionName: 'locate_name',
    kind: 'read',
    args: { node },
  })
  return registry
}

async function activeRegistry(app: DuskConnectAppLike, contracts: DuskDomainContractMap) {
  const registry = await readRegistry(app, contracts, {
    contract: 'router',
    functionName: 'active_registry',
    kind: 'read',
    args: undefined,
  })
  if (!registry) throw new Error('Dusk Domains has no registry taking new names. The operator must add one.')
  return registry
}

async function readRegistry(
  app: DuskConnectAppLike,
  contracts: DuskDomainContractMap,
  call: DuskDomainCallMetadata,
): Promise<string | null> {
  const router = contracts.router
  if (!router) return null
  const output = await app.readContract({
    contract: router,
    functionName: call.functionName,
    args: toDuskDomainWireArgs(call),
  })
  return contractIdFromOutput(output)
}

function poolTarget(call: DuskDomainCallMetadata): PoolTarget | null {
  const args = (call.args ?? {}) as Record<string, unknown>
  if (call.functionName === 'pending_commitment' && typeof args.node === 'string') {
    return { kind: 'registration', node: args.node }
  }
  if (call.functionName === 'commit_runtime' || call.functionName === 'pending_commitment') return { kind: 'new_name' }
  if (call.functionName === 'complete_registration_runtime' && typeof args.node === 'string') {
    return { kind: 'registration', node: args.node }
  }
  if (call.functionName === 'create_subname_runtime' && typeof args.parentNode === 'string') {
    return { kind: 'name', node: args.parentNode }
  }
  if (nameCalls.has(call.functionName) && typeof args.node === 'string') return { kind: 'name', node: args.node }
  if (
    (call.functionName === 'read_primary_name' || call.functionName === 'clear_primary_name_runtime')
    && typeof args.endpointType === 'string'
    && typeof args.endpointValue === 'string'
  ) {
    return { kind: 'primary', endpointType: args.endpointType, endpointValue: args.endpointValue }
  }
  return null
}

// Router lookups return Option<[u8; 32]>: null, 32 bytes, or hex, possibly inside a driver envelope.
export function contractIdFromOutput(value: unknown): string | null {
  const output = value && typeof value === 'object' && !Array.isArray(value) && 'output' in value
    ? (value as { output: unknown }).output
    : value
  if (output == null) return null
  if (typeof output === 'string') {
    const hex = output.toLowerCase().replace(/^0x/u, '')
    if (!/^[0-9a-f]{64}$/u.test(hex) || /^0{64}$/u.test(hex)) throw new Error('Dusk Domains router returned a malformed contract ID.')
    return `0x${hex}`
  }
  if (Array.isArray(output) && output.length === 32) {
    const bytes = Array.from(output)
    if (bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255) && bytes.some((byte) => byte !== 0)) {
      return `0x${bytes.map((byte: number) => byte.toString(16).padStart(2, '0')).join('')}`
    }
  }
  throw new Error('Dusk Domains router returned a malformed contract ID.')
}

function poolRouter(contracts: DuskDomainContractMap): string | null {
  const router = contracts.router?.contractId
  return router && router !== DUSK_DOMAINS_PLACEHOLDER_CONTRACT_ID ? router : null
}

/** Forgets located registries. Tests use it; apps never need to. */
export function clearDuskDomainRegistryCache() {
  locatedRegistries = new WeakMap()
}
