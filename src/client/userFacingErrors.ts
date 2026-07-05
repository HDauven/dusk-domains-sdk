const defaultErrorMessage = 'The request could not be completed. Refresh and try again.'

export function userFacingErrorMessage(error: unknown, fallback: string = defaultErrorMessage): string {
  return userFacingMessageFromText(error instanceof Error ? error.message : String(error), fallback)
}

export function userFacingMessageFromText(message: string | undefined, fallback: string = defaultErrorMessage): string {
  const trimmed = String(message ?? '').trim()
  if (!trimmed) return ''
  if (isReadOnlyWalletMessage(trimmed)) return 'This wallet can preview domains but cannot submit transactions.'
  if (isInsufficientBalanceMessage(trimmed)) return 'This wallet does not have enough DUSK to complete the transaction.'
  if (isWalletLockedMessage(trimmed)) return 'Connect or unlock your wallet to continue.'
  if (isRevealTooEarlyMessage(trimmed)) return 'Your reservation is still settling. Try again after a few more blocks.'
  if (isRejectedWalletMessage(trimmed)) return 'The wallet request was rejected.'
  if (isNameDataUnavailableMessage(trimmed)) return 'Domain data is not reachable right now. Refresh and try again.'
  if (isTechnicalErrorMessage(trimmed)) return fallback
  return trimmed
}

export function isReadOnlyWalletMessage(message: string | undefined): boolean {
  return /local wallet is read-only|local dev wallet cannot submit/i.test(String(message ?? ''))
}

export function isRevealTooEarlyMessage(message: string | undefined): boolean {
  return /reveal too early/i.test(String(message ?? ''))
}

export function isTechnicalErrorMessage(message: string | undefined): boolean {
  return /32-byte|DuskDS|contract calls?|Invalid input|public_sender|runtime|payload|data-driver|0x[a-f0-9]{24,}/iu.test(String(message ?? ''))
}

export function isWalletLockedMessage(message: string | undefined): boolean {
  return /wallet.*locked|locked.*wallet|site is not connected|not connected|unauthori[sz]ed/i.test(String(message ?? ''))
}

function isInsufficientBalanceMessage(message: string): boolean {
  return /value spent larger than account holds|insufficient|not enough/i.test(message)
}

export function isRejectedWalletMessage(message: string | undefined): boolean {
  return /reject|denied|cancel/i.test(String(message ?? ''))
}

function isNameDataUnavailableMessage(message: string): boolean {
  return /indexer|failed to fetch|networkerror|connection refused|econnrefused|http 5\d\d|http 404/i.test(message)
}
