export const SECONDS_PER_DAY = 86_400
export const DUSK_APPROX_BLOCK_TIME_SECONDS = 10
export const BLOCKS_PER_DAY: number = Math.floor(SECONDS_PER_DAY / DUSK_APPROX_BLOCK_TIME_SECONDS)
export const REGISTRATION_YEAR_BLOCKS = 365 * BLOCKS_PER_DAY
export const DEFAULT_GRACE_PERIOD_BLOCKS = 30 * BLOCKS_PER_DAY

export type RegistrationLifecycleStatus = 'active' | 'grace' | 'expired'

export type RegistrationLifecycle = {
  expiresAt: number
  graceEndsAt: number
}

export function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function createRegistrationLifecycle(options: {
  startsAt: number
  years: number
  gracePeriodBlocks?: number
}): RegistrationLifecycle {
  const years = Math.trunc(options.years)

  if (years < 1 || years > 10) {
    throw new Error('Registration duration must be between 1 and 10 years.')
  }

  const gracePeriodBlocks = options.gracePeriodBlocks ?? DEFAULT_GRACE_PERIOD_BLOCKS
  const expiresAt = options.startsAt + years * REGISTRATION_YEAR_BLOCKS

  return {
    expiresAt,
    graceEndsAt: expiresAt + gracePeriodBlocks,
  }
}

export function renewRegistrationLifecycle(options: {
  currentExpiresAt: number
  now: number
  years: number
  gracePeriodBlocks?: number
}): RegistrationLifecycle {
  return createRegistrationLifecycle({
    startsAt: Math.max(options.currentExpiresAt, options.now),
    years: options.years,
    gracePeriodBlocks: options.gracePeriodBlocks,
  })
}

export function registrationLifecycleStatus(
  lifecycle: RegistrationLifecycle,
  now: number,
): RegistrationLifecycleStatus {
  if (now < lifecycle.expiresAt) return 'active'
  if (now < lifecycle.graceEndsAt) return 'grace'
  return 'expired'
}
