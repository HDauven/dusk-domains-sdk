import { namehashHex } from '../core/namehash'
import { validateName } from '../core/namePolicy'
import { validateRecordValue, type ResolverRecord } from '../core/records'
import { createRecentChangeWarnings } from './indexerWarnings'
import type {
  ForwardResolutionEndpoint,
  ForwardResolutionError,
  ForwardResolutionInput,
  ForwardResolutionResponse,
  IndexedName,
  NameLifecycleStatus,
  ResolverHealth,
} from './indexerTypes'

const DEFAULT_CACHE_TTL_SECONDS = 300

export function createForwardResolutionResponse(input: ForwardResolutionInput): ForwardResolutionResponse {
  const now = input.now ?? new Date()
  const validation = validateName(input.name)

  if (!validation.ok) {
    return emptyResponse(input.name, now, {
      code: 'missing_name',
      message: validation.issues.map((issue) => issue.text).join(' ') || 'Name is invalid.',
    })
  }

  const records = input.records ?? []
  const errors = validateRecords(records)
  const resolverId = input.resolverId ?? null
  const lifecycleStatus = getLifecycleStatus(input.expiresAt ?? null, now)

  if (!resolverId) {
    errors.push({ code: 'missing_resolver', message: `${validation.name.canonical} does not define a resolver.` })
  }

  if (resolverId && input.resolverHealth === 'invalid') {
    errors.push({ code: 'invalid_resolver', message: `${validation.name.canonical} resolver is invalid.` })
  }

  if (lifecycleStatus === 'expired') {
    errors.push({ code: 'expired_name', message: `${validation.name.canonical} has expired.` })
  }

  const ttlSeconds = Math.min(
    ...records.map((record) => record.ttlSeconds).filter((ttlSeconds) => ttlSeconds > 0),
    DEFAULT_CACHE_TTL_SECONDS,
  )

  const resolverHealth: ResolverHealth = !resolverId
    ? 'missing'
    : input.resolverHealth ?? (errors.some((error) => error.code === 'invalid_record') ? 'invalid' : 'ok')

  return {
    canonicalName: validation.name.canonical,
    node: namehashHex(validation.name.canonical),
    records,
    resolver: {
      resolverId,
      health: resolverHealth,
    },
    expiry: {
      status: lifecycleStatus,
      expiresAt: input.expiresAt ?? null,
    },
    cache: {
      asOf: now.toISOString(),
      ttlSeconds,
      staleAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    },
    warnings: createRecentChangeWarnings(input.activity ?? [], {
      now,
      windowSeconds: input.warningWindowSeconds,
    }),
    verificationStatus: errors.length === 0 ? 'forward_resolved' : 'unverified',
    errors,
  }
}

export function createForwardResolutionEndpoint(options: {
  now?: () => Date
  initialNames?: IndexedName[]
} = {}): ForwardResolutionEndpoint {
  const now = options.now ?? (() => new Date())
  const names = new Map<string, IndexedName>()

  for (const name of options.initialNames ?? []) {
    const validation = validateName(name.canonicalName)
    if (validation.ok) names.set(validation.name.canonical, { ...name, canonicalName: validation.name.canonical })
  }

  function upsertName(name: string, value: Omit<IndexedName, 'canonicalName'>) {
    const validation = validateName(name)

    if (!validation.ok) {
      return createForwardResolutionResponse({
        name,
        now: now(),
      })
    }

    const indexed = {
      canonicalName: validation.name.canonical,
      records: value.records,
      resolverId: value.resolverId,
      resolverHealth: value.resolverHealth,
      expiresAt: value.expiresAt,
      activity: value.activity ?? names.get(validation.name.canonical)?.activity ?? [],
    }
    names.set(indexed.canonicalName, indexed)
    return resolveIndexedName(indexed.canonicalName)
  }

  function upsertRecord(name: string, record: ResolverRecord) {
    const validation = validateName(name)

    if (!validation.ok) {
      return createForwardResolutionResponse({
        name,
        now: now(),
      })
    }

    const canonicalName = validation.name.canonical
    const current = names.get(canonicalName) ?? {
      canonicalName,
      records: [],
      resolverId: null,
      resolverHealth: 'missing' satisfies ResolverHealth,
      expiresAt: null,
    }

    const next = {
      ...current,
      records: [
        record,
        ...current.records.filter((candidate) => candidate.key !== record.key),
      ],
      activity: current.activity,
    }
    names.set(canonicalName, next)
    return resolveIndexedName(canonicalName)
  }

  async function resolveForward(name: string) {
    return resolveIndexedName(name)
  }

  async function handleRequest(request: Request) {
    const url = new URL(request.url)
    const rawName = url.searchParams.get('name') ?? decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '')
    const response = resolveIndexedName(rawName)
    return Response.json(response, {
      status: response.errors.some((error) => error.code === 'missing_name') ? 400 : 200,
      headers: {
        'cache-control': `public, max-age=${response.cache.ttlSeconds}`,
      },
    })
  }

  function resolveIndexedName(name: string) {
    const validation = validateName(name)

    if (!validation.ok) {
      return createForwardResolutionResponse({
        name,
        now: now(),
      })
    }

    const indexed = names.get(validation.name.canonical)

    if (!indexed) {
      return createForwardResolutionResponse({
        name: validation.name.canonical,
        resolverId: null,
        resolverHealth: 'missing',
        expiresAt: null,
        records: [],
        now: now(),
      })
    }

    return createForwardResolutionResponse({
      name: indexed.canonicalName,
      records: indexed.records,
      resolverId: indexed.resolverId,
      resolverHealth: indexed.resolverHealth,
      expiresAt: indexed.expiresAt,
      activity: indexed.activity ?? [],
      now: now(),
    })
  }

  return {
    upsertName,
    upsertRecord,
    resolveForward,
    handleRequest,
  }
}

function emptyResponse(name: string, now: Date, error: ForwardResolutionError): ForwardResolutionResponse {
  return {
    canonicalName: name,
    node: '0x',
    records: [],
    resolver: {
      resolverId: null,
      health: 'missing',
    },
    expiry: {
      status: 'missing',
      expiresAt: null,
    },
    cache: {
      asOf: now.toISOString(),
      ttlSeconds: 0,
      staleAt: now.toISOString(),
    },
    warnings: [],
    verificationStatus: 'unverified',
    errors: [error],
  }
}

function validateRecords(records: ResolverRecord[]) {
  return records.flatMap((record): ForwardResolutionError[] => {
    const errors = validateRecordValue(record.key, record.value)

    return errors.map((message) => ({
      code: 'invalid_record',
      message: `${record.key}: ${message}`,
    }))
  })
}

function getLifecycleStatus(expiresAt: string | null, now: Date): NameLifecycleStatus {
  if (!expiresAt) return 'active'
  return new Date(expiresAt).getTime() <= now.getTime() ? 'expired' : 'active'
}
