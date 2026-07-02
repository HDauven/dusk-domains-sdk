export type IndexerConfirmationOptions = {
  description: string
  check: () => Promise<boolean>
  attempts?: number
  delayMs?: number
  wait?: (delayMs: number) => Promise<void>
}

export type IndexerConfirmationResult = {
  confirmed: boolean
  attempts: number
  description: string
  error: string | null
}

export type IndexerConfirmationAndRefreshOptions = IndexerConfirmationOptions & {
  refresh: () => Promise<boolean>
}

export type IndexerConfirmationAndRefreshResult = IndexerConfirmationResult & {
  indexerConfirmed: boolean
  refreshed: boolean
}

export async function waitForIndexerConfirmation(options: IndexerConfirmationOptions): Promise<IndexerConfirmationResult> {
  const attempts = Math.max(1, options.attempts ?? 5)
  const delayMs = Math.max(0, options.delayMs ?? 750)
  const wait = options.wait ?? sleep
  let lastError: string | null = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (await options.check()) {
        return {
          confirmed: true,
          attempts: attempt,
          description: options.description,
          error: null,
        }
      }
      lastError = null
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    if (attempt < attempts && delayMs > 0) {
      await wait(delayMs)
    }
  }

  return {
    confirmed: false,
    attempts,
    description: options.description,
    error: lastError,
  }
}

export async function waitForConfirmedIndexerRefresh(
  options: IndexerConfirmationAndRefreshOptions,
): Promise<IndexerConfirmationAndRefreshResult> {
  const confirmation = await waitForIndexerConfirmation(options)

  if (!confirmation.confirmed) {
    return {
      ...confirmation,
      indexerConfirmed: false,
      refreshed: false,
    }
  }

  try {
    const refreshed = await options.refresh()
    return {
      ...confirmation,
      indexerConfirmed: true,
      confirmed: refreshed,
      refreshed,
      error: refreshed ? null : confirmation.error,
    }
  } catch (error) {
    return {
      ...confirmation,
      indexerConfirmed: true,
      confirmed: false,
      refreshed: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs))
}
