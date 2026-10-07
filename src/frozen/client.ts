/** Canonical frozen-layer reads, admission discovery and monotone forwarding. @module */
import { contractId, equalBytes, fromHex, hex, nameKey } from './bytes.ts'
import { methodCatalog } from './catalog.ts'
import {
  methodDefinition,
  type Input,
  type Output,
  type Method,
} from './calls.ts'
import {
  loadReleaseManifest,
  fetchDriver,
  validateReleaseContract,
  type LoadedRelease,
  type ManifestOptions,
  type ContractRole,
  type ReleaseContract,
} from './manifest.ts'
import { stringifyJson, u64 } from './json.ts'
import { wireValue } from './wire.ts'
import { createHttpTransport, type ReadTransport } from './transport.ts'
import type { ReadMethods } from './read-types.ts'
import type {
  Admission,
  Contract,
  Forward,
  Located,
  NameKey,
  NameView,
  MemberKind,
  PrimaryView,
  RecordValue,
  RegistrationQuote,
  QuoteRegistration,
  RenewalQuote,
  StoreQuoteRenewalArgs,
  DirectoryConfig,
  Interface,
  Binding,
  EventTypes,
} from './types.ts'

export interface ClientOptions extends ManifestOptions {
  transport?: ReadTransport
  hopLimit?: number
  /** Supply release-reviewed metadata for a newly admitted implementation, never an unverified driver. */
  resolveContract?: (
    role: ContractRole,
    id: string,
    admission?: Admission,
  ) => Promise<ReleaseContract>
}
export type ReadApi<R extends ContractRole> = {
  [M in ReadMethods[R] & Method<R>]: (
    ...args: Input<R, M> extends null ? [] : [args: Input<R, M>]
  ) => Promise<Output<R, M>>
}
export interface Routed<T> {
  store: string
  value: Located<T>
  forwards: Forward[]
  height: bigint
}
export interface VerifiedPrimary {
  store: string
  primary: PrimaryView
  record: RecordValue
  height: bigint
}
export interface DirectoryState {
  height: bigint
  config: DirectoryConfig
  stores: Admission[]
  resolvers: Admission[]
}

export class FrozenClient {
  readonly release: LoadedRelease
  readonly transport: ReadTransport
  readonly directoryId: string
  readonly vaultId: string
  readonly directory: ReadApi<'directory'>
  readonly vault: ReadApi<'vault'>
  readonly hopLimit: number
  private readonly options: ClientOptions
  private stores: Admission[] = []
  private resolvers: Admission[] = []
  private verified = new Set<string>()
  constructor(release: LoadedRelease, options: ClientOptions = {}) {
    this.release = release
    this.options = options
    this.transport =
      options.transport ??
      createHttpTransport(release.manifest.nodeUrl, options.fetch)
    this.directoryId = release.manifest.contracts.find(
      (c) => c.role === 'directory',
    )!.contractId
    this.vaultId = release.manifest.contracts.find(
      (c) => c.role === 'vault',
    )!.contractId
    this.hopLimit = options.hopLimit ?? 63
    if (
      !Number.isInteger(this.hopLimit) ||
      this.hopLimit < 1 ||
      this.hopLimit > 63
    )
      throw new Error('hopLimit must be 1..63')
    this.directory = this.api('directory', this.directoryId)
    this.vault = this.api('vault', this.vaultId)
  }
  /** Fetch the block height on every public read; retry a sequence if the tip advances. */
  async snapshot<T>(operation: (height: bigint) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = u64(await this.transport.currentBlockHeight()),
        result = await operation(before)
      if (before === u64(await this.transport.currentBlockHeight()))
        return result
    }
    throw new Error('Chain tip changed during read; retry the snapshot')
  }
  private async raw<R extends ContractRole, M extends Method<R>>(
    role: R,
    id: string,
    method: M,
    args: Input<R, M>,
  ): Promise<Output<R, M>> {
    id = contractId(id)
    const descriptor = this.release.contracts.get(id),
      driver = this.release.drivers.get(id)
    if (!descriptor || descriptor.role !== role || !driver)
      throw new Error(`No verified ${role} driver for ${id}`)
    const spec = methodDefinition(role, method)
    if (spec.mode !== 'read') throw new Error('Write method used as a read')
    const input = driver.encodeInput(
      method,
      stringifyJson(wireValue(spec.input, args)),
    )
    const bytes = await this.transport.read(id, method, input)
    return wireValue(spec.output, driver.decodeOutput(method, bytes)) as Output<
      R,
      M
    >
  }
  /** The exact ABI read surface, with lossless typed output and automatic height acquisition. */
  async read<R extends ContractRole, M extends ReadMethods[R] & Method<R>>(
    role: R,
    id: string,
    method: M,
    args: Input<R, M>,
  ): Promise<Output<R, M>> {
    if (!this.verified.has(contractId(id))) await this.verifyContract(role, id)
    return this.snapshot(async () => {
      if (
        role === 'store' &&
        methodDefinition(role, method).output.startsWith('Located<')
      ) {
        const root = this.argumentRoot(args)
        return (
          await this.followRaw(
            id,
            root,
            method as Method<'store'>,
            args as never,
          )
        ).value as Output<R, M>
      }
      if (role === 'store' && method === 'home') {
        await this.storeAdmissions()
        return (await this.followHomeRaw(id, (args as { root: Contract }).root))
          .value as Output<R, M>
      }
      return this.raw(role, id, method, args)
    })
  }
  private api<R extends ContractRole>(role: R, id: string): ReadApi<R> {
    return Object.fromEntries(
      methodCatalog[role]
        .filter((m) => m.mode === 'read')
        .map((m) => [
          m.name,
          (args: unknown = null) =>
            this.read(
              role,
              id,
              m.name as ReadMethods[R] & Method<R>,
              args as never,
            ),
        ]),
    ) as unknown as ReadApi<R>
  }
  store(id: string): ReadApi<'store'> {
    return this.api('store', id)
  }
  resolver(id: string): ReadApi<'resolver'> {
    return this.api('resolver', id)
  }
  policy(id: string): ReadApi<'policy'> {
    return this.api('policy', id)
  }
  marketplace(id: string): ReadApi<'marketplace'> {
    return this.api('marketplace', id)
  }
  async verifyContract(
    role: ContractRole,
    id: string,
    admission?: Admission,
  ): Promise<void> {
    id = contractId(id)
    let c = this.release.contracts.get(id)
    if (!c) {
      if (!this.options.resolveContract)
        throw new Error(`Missing release artifact for admitted ${role} ${id}`)
      c = validateReleaseContract(
        await this.options.resolveContract(role, id, admission),
      )
      if (c.contractId !== id || c.role !== role)
        throw new Error('Resolved artifact does not match admission')
      const driver = await fetchDriver(
        c,
        this.release.artifactBaseUrl,
        this.options.fetch,
      )
      this.release.contracts.set(id, c)
      this.release.drivers.set(id, driver)
    }
    if (c.role !== role) throw new Error('Contract role mismatch')
    if (
      admission &&
      (admission.interface_version !== 1 ||
        (c.codeHash !== undefined && c.codeHash !== hex(admission.code_hash)))
    )
      throw new Error('Admission artifact/version mismatch')
    const iface = (await this.raw(
      role,
      id,
      'interface_version' as Method<typeof role>,
      null as never,
    )) as Interface
    if (
      iface.kind.toLowerCase() !== role ||
      iface.version !== 1 ||
      iface.move_version !== (role === 'store' ? 1 : 0) ||
      iface.custody_version !==
        (role === 'store' || role === 'marketplace' ? 1 : 0)
    )
      throw new Error('Unsupported frozen contract interface')
    const binding = (await this.raw(
      role,
      id,
      'binding' as Method<typeof role>,
      null as never,
    )) as Binding
    if (
      contractId(binding.directory) !== this.directoryId ||
      contractId(binding.vault) !== this.vaultId ||
      binding.network !== this.release.manifest.network
    )
      throw new Error('Contract deployment binding mismatch')
    if (
      role === 'marketplace' &&
      (await this.raw('marketplace', id, 'order_api_version', null)) !== 1
    )
      throw new Error('Unsupported marketplace order API')
    this.verified.add(id)
  }
  private async members(kind: MemberKind): Promise<Admission[]> {
    const rows: Admission[] = []
    let start = 0
    for (let page = 0; page < 4; page++) {
      const result = await this.raw('directory', this.directoryId, 'members', {
        kind,
        start,
        limit: 16,
      })
      for (const member of result.rows) {
        if (
          member.ordinal !== rows.length ||
          rows.some((r) => equalBytes(r.id, member.id))
        )
          throw new Error('Invalid directory admission order')
        rows.push(member)
      }
      if (result.next === null) return rows
      if (result.next <= start || result.next !== rows.length)
        throw new Error('Invalid admission cursor')
      start = result.next
    }
    throw new Error('Directory membership exceeds frozen bound')
  }
  async discover(): Promise<DirectoryState> {
    await this.verifyContract('directory', this.directoryId)
    return this.snapshot(async (height) => {
      const config = await this.raw(
        'directory',
        this.directoryId,
        'config',
        null,
      )
      const stores = await this.members('Store'),
        resolvers = await this.members('Resolver')
      if (
        stores.length !== config.store_count ||
        resolvers.length !== config.resolver_count
      )
        throw new Error('Directory member count mismatch')
      for (const a of stores)
        await this.verifyContract('store', contractId(a.id), a)
      for (const a of resolvers)
        await this.verifyContract('resolver', contractId(a.id), a)
      await this.verifyContract('vault', this.vaultId)
      await this.verifyContract(
        'policy',
        contractId(config.registration.policy),
      )
      if (config.preferred_marketplace)
        await this.verifyContract(
          'marketplace',
          contractId(config.preferred_marketplace),
        )
      this.stores = stores
      this.resolvers = resolvers
      return { height, config, stores, resolvers }
    })
  }
  /** Accept only already authenticated, committed directory effects from the projection. */
  async admitDirectoryEvent(
    topic: 'directory_initialized' | 'action_applied',
    event: EventTypes['directory_initialized'] | EventTypes['action_applied'],
  ): Promise<void> {
    if (event.version !== 1) throw new Error('Unsupported event version')
    if (topic === 'directory_initialized') {
      const body = (event as EventTypes['directory_initialized']).body
      for (const [role, a] of [
        ['store', body.args.initial_store],
        ['resolver', body.args.initial_resolver],
      ] as const)
        await this.verifyContract(role, contractId(a.id), a)
    } else {
      const body = (event as EventTypes['action_applied']).body
      if (body.admission) {
        const role =
          'AddStore' in body.action
            ? 'store'
            : 'AddResolver' in body.action
              ? 'resolver'
              : 'policy'
        await this.verifyContract(
          role,
          contractId(body.admission.id),
          body.admission,
        )
      }
    }
    // Membership caches are refreshed through directory reads before routing.
    this.stores = []
    this.resolvers = []
  }
  private argumentRoot(args: unknown): Contract {
    const a = args as {
      root?: Contract
      key?: NameKey
      name?: { key: NameKey }
      parent?: NameKey
    }
    const root = a.root ?? a.key?.root ?? a.name?.key.root ?? a.parent?.root
    if (!root) throw new Error('Located read has no root key')
    return root
  }
  private async storeAdmissions(): Promise<void> {
    this.stores = await this.members('Store')
    for (const row of this.stores)
      if (!this.verified.has(contractId(row.id)))
        await this.verifyContract('store', contractId(row.id), row)
  }
  private ordinal(id: string): number {
    const row = this.stores.find((a) => contractId(a.id) === contractId(id))
    if (!row) throw new Error('Unadmitted store')
    return row.ordinal
  }
  private checkForward(
    from: string,
    root: Contract,
    f: Forward,
    seen: Set<string>,
  ): string {
    const to = contractId(f.destination)
    if (
      !equalBytes(root, f.root) ||
      seen.has(to) ||
      f.destination_ordinal <= this.ordinal(from) ||
      this.ordinal(to) !== f.destination_ordinal
    )
      throw new Error('Non-monotone or invalid shard forwarding')
    return to
  }
  private async followHomeRaw(
    start: string,
    root: Contract,
  ): Promise<{
    store: string
    value: 'Absent' | 'Local' | { Staged: Contract }
    forwards: Forward[]
  }> {
    let store = contractId(start)
    const seen = new Set<string>(),
      forwards: Forward[] = []
    for (let hops = 0; hops <= this.hopLimit; hops++) {
      seen.add(store)
      this.ordinal(store)
      const value = await this.raw('store', store, 'home', { root })
      if (typeof value === 'object' && 'Forwarded' in value) {
        if (hops === this.hopLimit)
          throw new Error('Forwarding hop limit exceeded')
        const next = this.checkForward(store, root, value.Forwarded, seen)
        forwards.push(value.Forwarded)
        store = next
      } else return { store, value, forwards }
    }
    throw new Error('Forwarding hop limit exceeded')
  }
  private async followRaw(
    start: string,
    root: Contract,
    method: Method<'store'>,
    args: never,
  ): Promise<{ store: string; value: Located<unknown>; forwards: Forward[] }> {
    // A cached home is a hint. Every read revalidates it, including unknown descendants.
    await this.storeAdmissions()
    const home = await this.followHomeRaw(start, root)
    let store = home.store
    const forwards = [...home.forwards],
      seen = new Set([
        contractId(start),
        ...forwards.map((f) => contractId(f.destination)),
      ])
    for (let hops = forwards.length; hops <= this.hopLimit; hops++) {
      const value = (await this.raw(
        'store',
        store,
        method,
        args,
      )) as Located<unknown>
      if (typeof value === 'object' && 'Forwarded' in value) {
        if (hops === this.hopLimit)
          throw new Error('Forwarding hop limit exceeded')
        const next = this.checkForward(store, root, value.Forwarded, seen)
        seen.add(next)
        forwards.push(value.Forwarded)
        store = next
      } else return { store, value, forwards }
    }
    throw new Error('Forwarding hop limit exceeded')
  }
  async locate<T>(
    start: string,
    root: Contract,
    method: Method<'store'>,
    args: unknown,
  ): Promise<Routed<T>> {
    if (!methodDefinition('store', method).output.startsWith('Located<'))
      throw new Error('Expected a Located read')
    return this.snapshot(
      async (height) =>
        ({
          ...(await this.followRaw(start, root, method, args as never)),
          height,
        }) as Routed<T>,
    )
  }
  async getName(
    spelling: string,
    homeHint?: string,
  ): Promise<Routed<NameView>> {
    const key = nameKey(spelling)
    return this.snapshot(async (height) => {
      await this.storeAdmissions()
      if (homeHint) {
        const hinted = await this.followHomeRaw(homeHint, key.root)
        if (hinted.value === 'Local')
          return {
            ...(await this.followRaw(
              hinted.store,
              key.root,
              'get_name',
              key as never,
            )),
            forwards: hinted.forwards,
            height,
          } as Routed<NameView>
        // An unavailable forwarded destination throws; an absent hint permits discovery.
        if (hinted.forwards.length)
          return {
            store: hinted.store,
            value: 'Absent',
            forwards: hinted.forwards,
            height,
          }
      }
      for (const a of this.stores) {
        const home = await this.followHomeRaw(contractId(a.id), key.root)
        if (home.value === 'Local')
          return {
            ...(await this.followRaw(
              home.store,
              key.root,
              'get_name',
              key as never,
            )),
            forwards: home.forwards,
            height,
          } as Routed<NameView>
      }
      const allocation = await this.raw(
        'directory',
        this.directoryId,
        'allocation',
        null,
      )
      return {
        store: contractId(allocation.newest_store),
        value: 'Absent',
        forwards: [],
        height,
      }
    })
  }
  async quoteRegistration(
    store: string,
    args: QuoteRegistration,
  ): Promise<RegistrationQuote> {
    return this.store(store).quote_registration(args)
  }
  async quoteRenewal(
    store: string,
    args: StoreQuoteRenewalArgs,
  ): Promise<Routed<RenewalQuote>> {
    return this.locate(store, args.name.key.root, 'quote_renewal', args)
  }
  async verifyPrimary(endpoint: number[]): Promise<VerifiedPrimary | null> {
    return this.snapshot(async (height) => {
      await this.storeAdmissions()
      let found: VerifiedPrimary | null = null
      for (const a of this.stores) {
        const store = contractId(a.id),
          primary = await this.raw('store', store, 'read_primary', { endpoint })
        if (!primary) continue
        const name = await this.followRaw(
          store,
          primary.primary.name.key.root,
          'get_name',
          primary.primary.name.key as never,
        )
        if (
          name.store !== store ||
          typeof name.value !== 'object' ||
          !('Local' in name.value)
        )
          continue
        const view = name.value.Local as NameView,
          n = view.name,
          ref = primary.primary.name
        if (
          n.incarnation.generation !== ref.incarnation.generation ||
          n.incarnation.serial !== ref.incarnation.serial ||
          !view.active ||
          height >= n.expires_at
        )
          continue
        const record = await this.raw('store', store, 'resolve_record', {
          key: n.key,
          record_key: 'moonlight_address',
        })
        if (
          typeof record !== 'object' ||
          !('Local' in record) ||
          !record.Local ||
          !equalBytes(record.Local.value, endpoint)
        )
          continue
        if (!equalBytes(nameKey(primary.spelling).node, n.key.node))
          throw new Error('Primary spelling mismatch')
        if (found) throw new Error('Multiple verified pool primaries')
        found = { store, primary, record: record.Local, height }
      }
      return found
    })
  }
}
export async function createClientFromManifest(
  source: unknown,
  options: ClientOptions = {},
): Promise<FrozenClient> {
  const client = new FrozenClient(
    await loadReleaseManifest(source, options),
    options,
  )
  await client.discover()
  return client
}
