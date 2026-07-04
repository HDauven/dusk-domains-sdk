import type { BrowserWriteProofLog } from './writeProofTypes'

export async function captureBrowserWriteProofLog(
  captureUrl: string | undefined,
  log: BrowserWriteProofLog,
  fetcher: typeof fetch = globalThis.fetch,
) {
  const url = captureUrl?.trim()
  if (!url || typeof fetcher !== 'function') return false

  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(log),
      keepalive: true,
    })
    return response.ok
  } catch {
    return false
  }
}
