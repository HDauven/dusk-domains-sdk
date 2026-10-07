/** Frozen projection HTTP client. Indexer data is advisory; writes use canonical contract reads. @module */
import {
  contractId,
  equalBytes,
  fromHex,
  hex,
  nameKey,
} from '../frozen/bytes.ts'
import { parseJson, lux, u64 } from '../frozen/json.ts'
import { wireValue } from '../frozen/wire.ts'
import { object, type ReleaseManifest } from '../frozen/manifest.ts'
import type { NameKey, CommitmentKey, TypedPrincipal } from '../frozen/types.ts'
import { indexerEventCatalog } from './events/indexerEventCatalog.ts'
import type { EventTopic } from './events/indexerEventCatalog.ts'
import type {
  IndexerResponse,
  IndexerPage,
  IndexerPageParams,
  IndexedName,
  IndexedNameState,
  IndexedRecords,
  IndexedChildren,
  IndexedPrimary,
  IndexedCommitment,
  IndexedMove,
  IndexedImport,
  IndexedOrder,
  IndexedRefund,
  IndexedReferral,
  IndexedPolicy,
  IndexedTransaction,
  IndexedEvent,
  IndexerHealth,
  IndexedVault,
  IndexedDirectory,
  IndexedRenewalSchedule,
  IndexedHome,
  IndexedCooldowns,
} from './types.ts'
export interface DuskDomainsIndexerClientOptions {
  baseUrl: string
  chainId: string
  directory: string
  fetch?: typeof fetch
  timeoutMs?: number
}
export class IndexerHttpError extends Error {
  constructor(readonly status: number) {
    super(`Indexer HTTP ${status}`)
  }
}
export class IndexerResponseError extends Error {
  constructor(readonly code: string) {
    super(`Invalid indexer response: ${code}`)
  }
}
function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new IndexerResponseError(code)
}
function text(value: unknown): string {
  assert(typeof value === 'string' && value.length > 0, 'text')
  return value
}
function bool(value: unknown): boolean {
  assert(typeof value === 'boolean', 'boolean')
  return value
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => same(v, b[i]))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = object(a),
      y = object(b)
    return (
      Object.keys(x).length === Object.keys(y).length &&
      Object.keys(x).every((k) => same(x[k], y[k]))
    )
  }
  return a === b
}
function page<T>(
  value: unknown,
  decode: (row: unknown) => T,
  limit: number,
): IndexerPage<T> {
  const o = object(value)
  assert(Array.isArray(o.items) && o.items.length <= limit, 'page_size')
  const nextCursor = o.nextCursor === null ? null : text(o.nextCursor)
  assert(nextCursor === null || o.items.length > 0, 'empty_continuation')
  return { items: o.items.map(decode), nextCursor }
}
export class DuskDomainsIndexerClient {
  readonly baseUrl: string
  readonly chainId: string
  readonly directory: string
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number
  constructor(options: DuskDomainsIndexerClientOptions) {
    const url = new URL(options.baseUrl)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid indexer URL')
    if (!/^dusk:[\w-]+$/u.test(options.chainId))
      throw new Error('Invalid indexer chain')
    this.baseUrl = url.href.replace(/\/$/u, '')
    this.chainId = options.chainId
    this.directory = contractId(options.directory)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? 10000
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1)
      throw new RangeError('Invalid indexer timeout')
  }
  private async get<T>(
    path: string,
    query: Record<string, string | undefined>,
    decode: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<IndexerResponse<T>> {
    const url = new URL(`${this.baseUrl}/v1/${path}`)
    for (const [k, v] of Object.entries(query))
      if (v !== undefined) url.searchParams.set(k, v)
    const controller = new AbortController(),
      abort = (): void => controller.abort(signal?.reason)
    if (signal?.aborted) abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(
      () => controller.abort(new Error('Indexer request timeout')),
      this.timeoutMs,
    )
    try {
      const response = await this.fetcher(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      if (!response.ok) throw new IndexerHttpError(response.status)
      const envelope = object(parseJson(await response.text()))
      assert(
        envelope.apiVersion === 1 || envelope.apiVersion === 1n,
        'api_version',
      )
      assert(
        envelope.chainId === this.chainId &&
          contractId(text(envelope.directory)) === this.directory,
        'deployment',
      )
      const s = object(envelope.snapshot),
        snapshot = { height: u64(s.height), blockHash: text(s.blockHash) }
      assert(
        !query.blockHash || snapshot.blockHash === query.blockHash,
        'snapshot',
      )
      return {
        apiVersion: 1,
        chainId: this.chainId,
        directory: this.directory,
        snapshot,
        data: decode(envelope.data),
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
  private query(store: string, key: NameKey): Record<string, string> {
    wireValue('NameKey', key)
    return {
      store: contractId(store),
      root: hex(key.root),
      node: hex(key.node),
    }
  }
  private named<T>(
    path: string,
    store: string,
    key: NameKey,
    type: string,
    signal?: AbortSignal,
    extra: Record<string, string> = {},
  ): Promise<IndexerResponse<{ store: string; key: NameKey; value: T }>> {
    const query = this.query(store, key)
    return this.get(
      path,
      { ...query, ...extra },
      (v) => {
        const o = object(v),
          k = wireValue('NameKey', o.key)
        assert(
          contractId(text(o.store)) === query.store && same(key, k),
          'name_request',
        )
        const value = wireValue(type, o.value) as T
        const located = objectOrNull(value)
        if (located?.Forwarded)
          assert(
            equalBytes(
              (located.Forwarded as { root: number[] }).root,
              key.root,
            ),
            'forward_root',
          )
        if (path === 'name' && located?.Local)
          assert(
            same((located.Local as { name: { key: NameKey } }).name.key, key),
            'name_key',
          )
        return { store: query.store, key: k, value }
      },
      signal,
    )
  }
  getHealth(signal?: AbortSignal): Promise<IndexerResponse<IndexerHealth>> {
    return this.get(
      'health',
      {},
      (v) => {
        const o = object(v)
        return {
          complete: bool(o.complete),
          finalizedHeight: u64(o.finalizedHeight),
          lagBlocks: u64(o.lagBlocks),
        }
      },
      signal,
    )
  }
  getNameState(
    store: string,
    key: NameKey,
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedNameState>> {
    return this.named('name', store, key, 'Located<NameView>', signal)
  }
  searchName(
    store: string,
    canonical: string,
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedNameState>> {
    return this.getNameState(store, nameKey(canonical), signal)
  }
  getRecords(
    store: string,
    key: NameKey,
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedRecords>> {
    return this.named('records', store, key, 'Located<RecordsView>', signal)
  }
  getSubnames(
    store: string,
    key: NameKey,
    options: { start?: number[]; limit?: number; signal?: AbortSignal } = {},
  ): Promise<IndexerResponse<IndexedChildren>> {
    const limit = options.limit ?? 16
    if (!Number.isInteger(limit) || limit < 1 || limit > 16)
      throw new RangeError('Invalid child limit')
    return this.named(
      'children',
      store,
      key,
      'Located<Children>',
      options.signal,
      {
        limit: String(limit),
        ...(options.start
          ? { start: hex(wireValue('Node', options.start)) }
          : {}),
      },
    )
  }
  getCooldowns(
    store: string,
    key: NameKey,
    initiator: number[],
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedCooldowns>> {
    return this.named(
      'cooldowns',
      store,
      key,
      'Located<MoveCooldowns>',
      signal,
      { initiator: hex(wireValue('Authority', initiator)) },
    )
  }
  getHome(
    store: string,
    root: number[],
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedHome>> {
    const target = contractId(store),
      node = wireValue('Node', root)
    return this.get(
      'home',
      { store: target, root: hex(node) },
      (v) => {
        const o = object(v),
          r = wireValue('Node', o.root),
          value = wireValue('Home', o.value)
        assert(
          contractId(text(o.store)) === target && equalBytes(r, node),
          'home_request',
        )
        if (typeof value === 'object' && 'Forwarded' in value)
          assert(equalBytes(value.Forwarded.root, root), 'forward_root')
        return { store: target, root: r, value }
      },
      signal,
    )
  }
  getNamesPage(
    params: IndexerPageParams & { owner?: string; store?: string } = {},
  ): Promise<IndexerResponse<IndexerPage<IndexedName>>> {
    const limit = pageLimit(params),
      owner = params.owner ? hex(fromHex(params.owner, 32)) : undefined,
      store = params.store ? contractId(params.store) : undefined
    return this.get(
      'names',
      { ...pageQuery(params, limit), owner, store },
      (value) =>
        page(
          value,
          (v) => {
            const o = object(v),
              name = wireValue('Name', o.name),
              id = contractId(text(o.store))
            assert(
              (!store || id === store) && (!owner || hex(name.owner) === owner),
              'names_filter',
            )
            return { store: id, name }
          },
          limit,
        ),
      params.signal,
    )
  }
  getPrimary(
    store: string,
    endpoint: number[],
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedPrimary>> {
    const id = contractId(store),
      e = wireValue('Endpoint', endpoint)
    return this.get(
      'primary',
      { store: id, endpoint: hex(e) },
      (v) => {
        const o = object(v),
          endpoint = wireValue('Endpoint', o.endpoint),
          value = wireValue('Option<PrimaryView>', o.value)
        assert(
          contractId(text(o.store)) === id &&
            equalBytes(endpoint, e) &&
            (!value || equalBytes(value.primary.endpoint, e)),
          'primary_request',
        )
        return { store: id, endpoint, value }
      },
      signal,
    )
  }
  getCommitment(
    store: string,
    key: CommitmentKey,
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedCommitment>> {
    const id = contractId(store),
      k = wireValue('CommitmentKey', key)
    return this.get(
      'commitment',
      { store: id, actor: hex(k.actor), hash: hex(k.hash) },
      (v) => {
        const o = object(v),
          key = wireValue('CommitmentKey', o.key),
          value = wireValue('Option<Commitment>', o.value)
        assert(
          contractId(text(o.store)) === id &&
            same(key, k) &&
            (!value || same(value.key, k)),
          'commitment_request',
        )
        return { store: id, key, value }
      },
      signal,
    )
  }
  private movement<T>(
    path: string,
    type: string,
    store: string,
    id: number[],
    signal?: AbortSignal,
  ): Promise<IndexerResponse<{ store: string; id: number[]; value: T }>> {
    const target = contractId(store),
      digest = wireValue('Digest', id)
    return this.get(
      path,
      { store: target, id: hex(digest) },
      (v) => {
        const o = object(v),
          id = wireValue('Digest', o.id),
          value = wireValue(type, o.value) as T
        assert(
          contractId(text(o.store)) === target && equalBytes(id, digest),
          'move_request',
        )
        const body = objectOrNull(value)
        if (body) {
          const ticket =
            path === 'import'
              ? body.ticket
              : (objectOrNull(body.Preparing)?.ticket ??
                objectOrNull(body.Finalizing)?.ticket)
          if (ticket)
            assert(equalBytes(object(ticket).id as number[], digest), 'move_id')
          else
            assert(
              !!body.Forwarded &&
                equalBytes(object(body.Forwarded).move_id as number[], digest),
              'move_id',
            )
        }
        return { store: target, id, value }
      },
      signal,
    )
  }
  getMove(
    store: string,
    id: number[],
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedMove>> {
    return this.movement('move', 'Option<MoveStatus>', store, id, signal)
  }
  getImport(
    store: string,
    id: number[],
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedImport>> {
    return this.movement('import', 'Option<ImportStatus>', store, id, signal)
  }
  getDirectory(
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedDirectory>> {
    return this.get(
      'directory',
      {},
      (v) => wireValue('DirectoryConfig', v),
      signal,
    )
  }
  getRenewalSchedule(
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedRenewalSchedule>> {
    return this.get(
      'renewal',
      {},
      (v) => wireValue('RenewalSchedule', v),
      signal,
    )
  }
  getPolicy(
    policy: string,
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedPolicy>> {
    const id = contractId(policy)
    return this.get(
      'policy',
      { policy: id },
      (v) => {
        const o = object(v)
        assert(contractId(text(o.policy)) === id, 'policy_request')
        return { policy: id, config: wireValue('PolicyConfig', o.config) }
      },
      signal,
    )
  }
  getVault(signal?: AbortSignal): Promise<IndexerResponse<IndexedVault>> {
    return this.get(
      'vault',
      {},
      (v) => {
        const o = object(v),
          reserved = u64(o.reservedBeneficiaries)
        assert(reserved <= 0xffffffffn, 'beneficiary_count')
        const value = {
          protocolLux: lux(o.protocolLux),
          liabilityLux: lux(o.liabilityLux),
          accountedLux: lux(o.accountedLux),
          reservedBeneficiaries: Number(reserved),
          sourceVersion: u64(o.sourceVersion),
        }
        assert(
          BigInt(value.protocolLux) + BigInt(value.liabilityLux) ===
            BigInt(value.accountedLux),
          'vault_accounting',
        )
        return value
      },
      signal,
    )
  }
  getReferralState(
    beneficiary: TypedPrincipal,
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedReferral>> {
    const p = wireValue('TypedPrincipal', beneficiary)
    return this.get(
      'referral',
      { kind: p.kind, bytes: hex(p.bytes) },
      (v) => {
        const o = object(v),
          beneficiary = wireValue('TypedPrincipal', o.beneficiary),
          value = wireValue('Option<ReferralRow>', o.value)
        assert(
          same(beneficiary, p) && (!value || same(value.beneficiary, p)),
          'referral_request',
        )
        return { beneficiary, value }
      },
      signal,
    )
  }
  getOrdersPage(
    market: string,
    params: IndexerPageParams = {},
  ): Promise<IndexerResponse<IndexerPage<IndexedOrder>>> {
    const target = contractId(market),
      limit = pageLimit(params)
    return this.get(
      'orders',
      { ...pageQuery(params, limit), market: target },
      (v) =>
        page(
          v,
          (raw) => {
            const o = object(raw)
            assert(contractId(text(o.market)) === target, 'order_market')
            const order = wireValue('Order', o.order)
            assert(
              contractId(order.terms.directory) === this.directory,
              'order_directory',
            )
            return { market: target, order }
          },
          limit,
        ),
      params.signal,
    )
  }
  getRefund(
    market: string,
    authority: number[],
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedRefund>> {
    const id = contractId(market),
      p = wireValue('Authority', authority)
    return this.get(
      'refund',
      { market: id, authority: hex(p) },
      (v) => {
        const o = object(v),
          authority = wireValue('Authority', o.authority),
          value = o.value === null ? null : wireValue('Refund', o.value)
        assert(
          contractId(text(o.market)) === id &&
            equalBytes(authority, p) &&
            (!value || equalBytes(value.authority, p)),
          'refund_request',
        )
        return { market: id, authority, value }
      },
      signal,
    )
  }
  getTransaction(
    id: string,
    signal?: AbortSignal,
  ): Promise<IndexerResponse<IndexedTransaction | null>> {
    text(id)
    return this.get(
      'transaction',
      { id },
      (v) => {
        if (v === null) return null
        const o = object(v)
        assert(o.id === id, 'transaction_request')
        return {
          id,
          height: u64(o.height),
          blockHash: text(o.blockHash),
          success: bool(o.success),
        }
      },
      signal,
    )
  }
  getEventsPage(
    params: IndexerPageParams & {
      transactionId?: string
      emitter?: string
    } = {},
  ): Promise<IndexerResponse<IndexerPage<IndexedEvent>>> {
    const emitter = params.emitter ? contractId(params.emitter) : undefined,
      limit = pageLimit(params)
    return this.get(
      'events',
      {
        ...pageQuery(params, limit),
        transactionId: params.transactionId,
        emitter,
      },
      (v) =>
        page(
          v,
          (raw) => {
            const o = object(raw),
              e = object(o.event),
              topic = text(e.topic) as EventTopic
            assert(
              Object.hasOwn(indexerEventCatalog, topic) &&
                !['operation_begin', 'operation_end'].includes(topic),
              'event_topic',
            )
            const who = contractId(text(e.emitter)),
              transactionId = text(o.transactionId),
              ordinal = u64(e.ordinal)
            assert(
              (!emitter || who === emitter) &&
                (!params.transactionId ||
                  transactionId === params.transactionId) &&
                e.reverted !== true &&
                ordinal <= BigInt(Number.MAX_SAFE_INTEGER),
              'event_request',
            )
            return {
              transactionId,
              event: {
                emitter: who,
                topic,
                height: u64(e.height),
                ordinal: Number(ordinal),
                data: wireValue(indexerEventCatalog[topic].type, e.data),
              },
            }
          },
          limit,
        ),
      params.signal,
    )
  }
}
function objectOrNull(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? object(value)
    : null
}
function pageLimit(params: IndexerPageParams): number {
  const limit = params.limit ?? 50
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new RangeError('Invalid page limit')
  if (params.cursor !== undefined && !params.cursor)
    throw new RangeError('Invalid cursor')
  return limit
}
function pageQuery(
  params: IndexerPageParams,
  limit: number,
): Record<string, string | undefined> {
  return {
    cursor: params.cursor,
    limit: String(limit),
    blockHash: params.blockHash,
  }
}
export function createDuskDomainsIndexerClient(
  options: DuskDomainsIndexerClientOptions,
): DuskDomainsIndexerClient {
  return new DuskDomainsIndexerClient(options)
}
export function createIndexerClientFromManifest(
  manifest: ReleaseManifest,
  options: Pick<DuskDomainsIndexerClientOptions, 'fetch' | 'timeoutMs'> = {},
): DuskDomainsIndexerClient {
  const directory = manifest.contracts.find(
    (c) => c.role === 'directory',
  )?.contractId
  if (!directory) throw new Error('Missing directory')
  return createDuskDomainsIndexerClient({
    ...options,
    baseUrl: manifest.indexerUrl,
    chainId: manifest.chainId,
    directory,
  })
}
/** Complete enumeration pins the first block hash; inconsistent/reorged pages fail explicitly. */
export async function collectIndexerPages<T>(
  load: (params: IndexerPageParams) => Promise<IndexerResponse<IndexerPage<T>>>,
  options: { maxItems?: number; signal?: AbortSignal } = {},
): Promise<T[]> {
  const max = options.maxItems ?? 10000
  if (!Number.isSafeInteger(max) || max < 1)
    throw new RangeError('Invalid item bound')
  const items: T[] = [],
    seen = new Set<string>()
  let cursor: string | undefined,
    snapshot: IndexerResponse<unknown>['snapshot'] | undefined
  for (;;) {
    options.signal?.throwIfAborted()
    const response = await load({
      cursor,
      blockHash: snapshot?.blockHash,
      signal: options.signal,
      limit: Math.min(100, max - items.length),
    })
    if (
      snapshot &&
      (snapshot.blockHash !== response.snapshot.blockHash ||
        snapshot.height !== response.snapshot.height)
    )
      throw new IndexerResponseError('pagination_snapshot')
    snapshot = response.snapshot
    items.push(...response.data.items)
    if (items.length > max) throw new IndexerResponseError('item_bound')
    const next = response.data.nextCursor
    if (next === null) return items
    if (seen.has(next) || !response.data.items.length || items.length === max)
      throw new IndexerResponseError('pagination_progress')
    seen.add(next)
    cursor = next
  }
}
