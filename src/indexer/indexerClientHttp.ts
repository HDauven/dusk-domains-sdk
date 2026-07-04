import { isRecord } from './indexerClientGuards'

export async function getJson(fetcher: typeof fetch, url: string) {
  const response = await fetcher(url, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    const detail = await responseErrorDetail(response)
    throw new Error(`Dusk Domains indexer request failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}.`)
  }
  return await response.json() as unknown
}

export function endpointUrl(baseUrl: string, path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params)
  const suffix = query.toString()
  return suffix ? `${baseUrl}/${path}?${suffix}` : `${baseUrl}/${path}`
}

export function normalizeBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  if (!normalized) throw new Error('Dusk Domains indexer base URL is required.')
  return normalized
}

async function responseErrorDetail(response: Response) {
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      return errorDetailFromPayload(await response.json())
    }

    const text = (await response.text()).trim()
    return truncateErrorDetail(text)
  } catch {
    return ''
  }
}

function errorDetailFromPayload(payload: unknown) {
  if (isRecord(payload)) {
    if (typeof payload.message === 'string') return truncateErrorDetail(payload.message)
    if (typeof payload.error === 'string') return truncateErrorDetail(payload.error)
    if (typeof payload.code === 'string') return truncateErrorDetail(payload.code)
  }

  return ''
}

function truncateErrorDetail(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized
}
