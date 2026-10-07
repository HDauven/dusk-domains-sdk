import { expect, it, vi } from 'vitest'
import {
  createDuskDomainsIndexerClient,
  createIndexerClientFromManifest,
  collectIndexerPages,
  type DuskDomainsIndexerClient,
} from '../src/indexer/client.ts'
import { stringifyJson } from '../src/frozen/json.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { fixtures, sample, id, bytes, release } from './helpers.ts'
import { nameKey } from '../src/frozen/bytes.ts'
import type { IndexerResponse, IndexerPage } from '../src/indexer/types.ts'
const key = nameKey('example.dusk')
const rows = [
  ...Object.values(fixtures()),
  ...Object.values(fixtures('market-v1')),
]
const golden = (type: string): any =>
  wireValue(type, rows.find((r) => r.type === type)!.json)
const envelope = <T>(data: T): IndexerResponse<T> => ({
  apiVersion: 1,
  chainId: 'dusk:1',
  directory: id(1),
  snapshot: { height: 9007199254740993n, blockHash: 'head' },
  data,
})
function setup(data: unknown, change: Record<string, unknown> = {}) {
  const urls: URL[] = []
  const client = createDuskDomainsIndexerClient({
    baseUrl: 'https://indexer.invalid/base/',
    chainId: 'dusk:1',
    directory: id(1),
    fetch: async (input) => {
      urls.push(new URL(String(input)))
      return new Response(stringifyJson({ ...envelope(data), ...change }))
    },
  })
  return { client, urls }
}
const named = (value: unknown) => ({ store: id(4), key, value })
const cases: [
  string,
  unknown,
  (c: DuskDomainsIndexerClient) => Promise<unknown>,
][] = [
  [
    'health',
    { complete: true, finalizedHeight: 10n, lagBlocks: 0n },
    (c) => c.getHealth(),
  ],
  ['name', named('Absent'), (c) => c.getNameState(id(4), key)],
  ['name', named('Absent'), (c) => c.searchName(id(4), 'example.dusk')],
  [
    'records',
    named({ Local: { pointer: null, records: [] } }),
    (c) => c.getRecords(id(4), key),
  ],
  [
    'children',
    named({ Local: { rows: [], next: null } }),
    (c) => c.getSubnames(id(4), key),
  ],
  [
    'cooldowns',
    named({ Local: sample('MoveCooldowns') }),
    (c) => c.getCooldowns(id(4), key, bytes(8)),
  ],
  [
    'home',
    { store: id(4), root: key.root, value: 'Local' },
    (c) => c.getHome(id(4), key.root),
  ],
  [
    'names',
    { items: [{ store: id(4), name: sample('Name') }], nextCursor: null },
    (c) => c.getNamesPage(),
  ],
  [
    'primary',
    { store: id(4), endpoint: bytes(8, 96), value: null },
    (c) => c.getPrimary(id(4), bytes(8, 96)),
  ],
  [
    'commitment',
    { store: id(4), key: sample('CommitmentKey'), value: sample('Commitment') },
    (c) => c.getCommitment(id(4), sample('CommitmentKey')),
  ],
  [
    'move',
    {
      store: id(4),
      id: bytes(7),
      value: sample('MoveStatus', 'MoveStatus::Preparing'),
    },
    (c) => c.getMove(id(4), bytes(7)),
  ],
  [
    'import',
    { store: id(4), id: bytes(7), value: sample('ImportStatus') },
    (c) => c.getImport(id(4), bytes(7)),
  ],
  ['directory', sample('DirectoryConfig'), (c) => c.getDirectory()],
  ['renewal', sample('RenewalSchedule'), (c) => c.getRenewalSchedule()],
  [
    'policy',
    { policy: id(3), config: sample('PolicyConfig') },
    (c) => c.getPolicy(id(3)),
  ],
  [
    'vault',
    {
      protocolLux: '100',
      liabilityLux: '23',
      accountedLux: '123',
      reservedBeneficiaries: 1,
      sourceVersion: 1n,
    },
    (c) => c.getVault(),
  ],
  [
    'referral',
    {
      beneficiary: sample('ReferralRow').beneficiary,
      value: sample('ReferralRow'),
    },
    (c) => c.getReferralState(sample('ReferralRow').beneficiary),
  ],
  [
    'refund',
    {
      market: id(6),
      authority: bytes(7),
      value: { authority: bytes(7), amount_lux: '18446744073709551615' },
    },
    (c) => c.getRefund(id(6), bytes(7)),
  ],
  [
    'transaction',
    { id: 'tx/a?b', height: 100n, blockHash: 'old', success: true },
    (c) => c.getTransaction('tx/a?b'),
  ],
]
for (const [route, data, run] of cases)
  it(`decodes ${route} projection type and binds request`, async () => {
    const { client, urls } = setup(data)
    const result = (await run(client)) as IndexerResponse<unknown>
    expect(result.data).toEqual(data)
    expect(result.snapshot.height).toBe(9007199254740993n)
    expect(urls[0].pathname).toBe(`/base/v1/${route}`)
    if (route === 'transaction')
      expect(urls[0].searchParams.get('id')).toBe('tx/a?b')
  })
it('decodes orders/refunds with marketplace scope and the frozen directory', async () => {
  const order = golden('Order')
  order.terms.directory = bytes(1)
  const data = { items: [{ market: id(6), order }], nextCursor: null },
    { client } = setup(data)
  expect((await client.getOrdersPage(id(6))).data).toEqual(data)
})
it('decodes committed protocol effects with no activity copy', async () => {
  const event = {
    topic: 'commitment_created',
    emitter: id(4),
    ordinal: 5,
    height: 30n,
    data: golden('Event<CommitmentCreated>'),
  }
  const data = { items: [{ transactionId: 'tx', event }], nextCursor: null }
  const { client } = setup(data)
  expect(
    (await client.getEventsPage({ transactionId: 'tx', emitter: id(4) })).data,
  ).toEqual(data)
})
it.each([
  { apiVersion: 2 },
  { chainId: 'dusk:2' },
  { directory: id(2) },
  { snapshot: { height: -1, blockHash: 'x' } },
  { snapshot: { height: '100', blockHash: 'x' } },
])('rejects envelope mismatch %#', async (change) => {
  const { client } = setup(named('Absent'), change)
  await expect(client.getNameState(id(4), key)).rejects.toThrow()
})
it.each([
  { store: id(8) },
  { key: nameKey('other.dusk') },
  {
    value: {
      Local: {
        name: sample('Name'),
        active: true,
        renewable: true,
        counters: null,
        move_pending: null,
      },
    },
  },
])('rejects a name response bound to another request %#', async (change) => {
  const { client } = setup({ ...named('Absent'), ...change })
  await expect(client.getNameState(id(4), key)).rejects.toThrow()
})
it('checks owner filters and preserves absent versus request failure', async () => {
  const { client } = setup({
    items: [{ store: id(4), name: sample('Name') }],
    nextCursor: null,
  })
  await expect(client.getNamesPage({ owner: id(99) })).rejects.toThrow('filter')
  const bad = createDuskDomainsIndexerClient({
    baseUrl: 'https://indexer.invalid',
    chainId: 'dusk:1',
    directory: id(1),
    fetch: async () => new Response('{}', { status: 404 }),
  })
  await expect(bad.getNameState(id(4), key)).rejects.toThrow('404')
})
it.each([
  'file:///tmp',
  'https://a:b@indexer.invalid',
  'https://indexer.invalid?redirect=x',
  'https://indexer.invalid#fragment',
])('rejects invalid base URL %s', (baseUrl) =>
  expect(() =>
    createDuskDomainsIndexerClient({
      baseUrl,
      chainId: 'dusk:1',
      directory: id(1),
    }),
  ).toThrow(),
)
it.each([0, 101, 1.5, NaN])(
  'rejects invalid page limit %s before HTTP',
  (limit) => {
    const { client, urls } = setup(null)
    expect(() => client.getNamesPage({ limit })).toThrow()
    expect(urls).toEqual([])
  },
)
it('pins complete pagination to one snapshot and detects cursor cycles/truncation/reorgs', async () => {
  const load = vi.fn(async ({ cursor, blockHash }) => {
    expect(blockHash).toBe(cursor ? 'head' : undefined)
    return envelope({
      items: [cursor ? 2 : 1],
      nextCursor: cursor ? null : 'next',
    })
  })
  expect(await collectIndexerPages(load)).toEqual([1, 2])
  await expect(
    collectIndexerPages(async () =>
      envelope({ items: [1], nextCursor: 'same' }),
    ),
  ).rejects.toThrow('progress')
  await expect(
    collectIndexerPages(
      async () => envelope({ items: [1], nextCursor: 'next' }),
      { maxItems: 1 },
    ),
  ).rejects.toThrow('progress')
  await expect(
    collectIndexerPages(async ({ cursor }) => ({
      ...envelope({ items: [1], nextCursor: cursor ? null : 'next' }),
      snapshot: { height: 1n, blockHash: cursor ? 'fork' : 'head' },
    })),
  ).rejects.toThrow('snapshot')
})
it('rejects oversized pages, empty continuation and wrong snapshot', async () => {
  const name = { store: id(4), name: sample('Name') }
  await expect(
    setup({ items: [name, name], nextCursor: null }).client.getNamesPage({
      limit: 1,
    }),
  ).rejects.toThrow('page_size')
  await expect(
    setup({ items: [], nextCursor: 'next' }).client.getNamesPage(),
  ).rejects.toThrow('continuation')
  await expect(
    setup({ items: [], nextCursor: null }).client.getNamesPage({
      blockHash: 'different',
    }),
  ).rejects.toThrow('snapshot')
})
it('aborts pending requests on deadline and caller cancellation', async () => {
  const fetcher: typeof fetch = async (_, options) =>
    new Promise((_resolve, reject) => {
      if (options?.signal?.aborted) reject(options.signal.reason)
      else
        options?.signal?.addEventListener('abort', () =>
          reject(options.signal?.reason),
        )
    })
  const client = createDuskDomainsIndexerClient({
    baseUrl: 'https://indexer.invalid',
    chainId: 'dusk:1',
    directory: id(1),
    timeoutMs: 5,
    fetch: fetcher,
  })
  await expect(client.getHealth()).rejects.toThrow('timeout')
  const signal = AbortSignal.abort(new Error('cancelled'))
  await expect(client.getHealth(signal)).rejects.toThrow('cancelled')
})
it('uses manifest routing metadata', async () => {
  const client = createIndexerClientFromManifest((await release()).manifest)
  expect(client.baseUrl).toBe('https://indexer.invalid')
  expect(client.directory).toBe(id(1))
})
it.each([0, 17, 1.5])(
  'uses the frozen 16-row children page bound: %s',
  (limit) => {
    expect(() => setup(null).client.getSubnames(id(4), key, { limit })).toThrow(
      'child limit',
    )
  },
)
