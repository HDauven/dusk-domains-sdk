import { namehashHex } from './namehash'
import { validateName } from './namePolicy'

export const MAX_TAKE_BACK_SUBNAMES = 256

export type SubnameExpiryPolicy = 'inherits_parent' | 'fixed_before_parent'
export type SubnameStatus = 'active' | 'expired'

export type SubnameState = {
  parentName: string
  parentNode: string
  label: string
  name: string
  node: string
  owner: string
  manager: string
  resolver: string
  expiresAt: number
  parentExpiresAt: number
  expiryPolicy: SubnameExpiryPolicy
  createdAt: number
  status: SubnameStatus
}

export type CreateSubnameOptions = {
  parentName: string
  label: string
  owner: string
  manager: string
  resolver: string
  parentExpiresAt: number
  requestedExpiresAt?: number | null
  createdAt?: number
}

export function createSubnameState(options: CreateSubnameOptions): SubnameState {
  const parent = validateName(options.parentName)

  if (!parent.ok) {
    throw new Error(parent.issues.map((issue) => issue.text).join(' ') || 'Invalid parent name.')
  }

  const label = normalizeSubnameLabel(options.label)
  const name = `${label}.${parent.name.canonical}`
  const validation = validateName(name)

  if (!validation.ok) {
    throw new Error(validation.issues.map((issue) => issue.text).join(' ') || 'Invalid subname.')
  }

  const expiresAt = resolveSubnameExpiresAt({
    parentExpiresAt: options.parentExpiresAt,
    requestedExpiresAt: options.requestedExpiresAt,
  })

  return {
    parentName: parent.name.canonical,
    parentNode: namehashHex(parent.name.canonical),
    label,
    name: validation.name.canonical,
    node: namehashHex(validation.name.canonical),
    owner: options.owner,
    manager: options.manager,
    resolver: options.resolver,
    expiresAt,
    parentExpiresAt: options.parentExpiresAt,
    expiryPolicy: options.requestedExpiresAt ? 'fixed_before_parent' : 'inherits_parent',
    createdAt: options.createdAt ?? Math.floor(Date.now() / 1000),
    status: 'active',
  }
}

export function normalizeSubnameLabel(value: string): string {
  return value.trim().toLowerCase()
}

export function resolveSubnameExpiresAt(options: {
  parentExpiresAt: number
  requestedExpiresAt?: number | null
}): number {
  const requested = options.requestedExpiresAt ?? options.parentExpiresAt
  if (!Number.isFinite(requested) || requested <= 0) throw new Error('Subname expiry must be a valid Unix timestamp.')
  if (!Number.isFinite(options.parentExpiresAt) || options.parentExpiresAt <= 0) {
    throw new Error('Parent expiry must be a valid Unix timestamp.')
  }
  return Math.min(requested, options.parentExpiresAt)
}

export function subnameExpiryDescription(policy: SubnameExpiryPolicy): string {
  if (policy === 'inherits_parent') return 'Inherits parent expiry'
  return 'Fixed and capped by parent expiry'
}
