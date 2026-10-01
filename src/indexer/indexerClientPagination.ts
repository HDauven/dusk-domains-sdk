import { isRecord } from './indexerClientGuards'

export type IndexerPageParams = { limit?: number; cursor?: string }
export type IndexerPage<T, K extends string> = { [P in K]: T[] } & { nextCursor: string | null }
export const INDEXER_COMPLETE_SET_CAP = 10_000

export function pageQuery(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(Object.entries(params).flatMap(([key, value]) => value === undefined ? [] : [[key, String(value)]]))
}

export function parsePage<T, K extends string>(payload: unknown, field: K, guard: (value: unknown) => value is T, label: string): IndexerPage<T, K> {
  // Older indexers returned arrays; allow a staged server/client rollout.
  const items = Array.isArray(payload) ? payload : isRecord(payload) ? payload[field] : undefined
  const nextCursor = Array.isArray(payload) ? null : isRecord(payload) ? payload.nextCursor : undefined
  if (!Array.isArray(items) || (!Array.isArray(payload) && items.length > 200) || !items.every(guard)
    || !(nextCursor === null || (typeof nextCursor === 'string' && nextCursor.length > 0 && nextCursor.length <= 4096))) {
    throw new Error(`Dusk Domains indexer returned an invalid ${label} response.`)
  }
  return { [field]: items, nextCursor } as IndexerPage<T, K>
}

export async function collectPages<T>(read: (params: IndexerPageParams) => Promise<{ items: T[]; nextCursor: string | null }>, maxItems = INDEXER_COMPLETE_SET_CAP): Promise<T[]> {
  if (!Number.isSafeInteger(maxItems) || maxItems < 1 || maxItems > INDEXER_COMPLETE_SET_CAP) {
    throw new Error(`Complete indexer reads require a cap between 1 and ${INDEXER_COMPLETE_SET_CAP}.`)
  }
  const items: T[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await read({ limit: Math.min(200, maxItems - items.length), cursor })
    const total = items.length + page.items.length
    if (total > maxItems || (page.nextCursor && total >= maxItems)) {
      throw new Error(`Complete indexer read exceeded its ${maxItems} item cap.`)
    }
    items.push(...page.items)
    if (!page.nextCursor) return items
    if (!page.items.length || seen.has(page.nextCursor)) throw new Error('Indexer pagination did not advance.')
    seen.add(page.nextCursor)
    cursor = page.nextCursor
  } while (cursor)
  return items
}
