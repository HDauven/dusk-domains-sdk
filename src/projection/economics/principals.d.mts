import type { DuskPrincipal } from '../../core/principal'

export function arrayOfStrings(value: unknown): string[]
export function referralKey(referrer: unknown): string
export function normalizePrincipalKey(value: string): string
export function normalizePrincipal(value: unknown): DuskPrincipal | null
export function legacyPhoenixPrincipal(value: unknown): DuskPrincipal | null
export function principalKey(principal: DuskPrincipal | null): string | null
