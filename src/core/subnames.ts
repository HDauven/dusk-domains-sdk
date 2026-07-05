import { namehashHex } from './namehash'
import { validateName } from './namePolicy'

export type SubnameExpiryPolicy = 'inherits_parent' | 'fixed_before_parent'
export type SubnameRevocationPolicy = 'parent_revocable' | 'locked'
export type SubnameStatus = 'active' | 'revoked' | 'expired'

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
  revocationPolicy: SubnameRevocationPolicy
  createdAt: number
  status: SubnameStatus
  revokedAt: number | null
}

export type CreateSubnameOptions = {
  parentName: string
  label: string
  owner: string
  manager: string
  resolver: string
  parentExpiresAt: number
  requestedExpiresAt?: number | null
  revocationPolicy?: SubnameRevocationPolicy
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
    revocationPolicy: options.revocationPolicy ?? 'parent_revocable',
    createdAt: options.createdAt ?? Math.floor(Date.now() / 1000),
    status: 'active',
    revokedAt: null,
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

export function canParentRevokeSubname(subname: Pick<SubnameState, 'revocationPolicy' | 'status'>): boolean {
  return subname.revocationPolicy === 'parent_revocable' && subname.status === 'active'
}

export function revokeSubname(subname: SubnameState, revokedAt: number): SubnameState {
  if (!canParentRevokeSubname(subname)) {
    throw new Error('This subname is locked against parent revocation.')
  }

  return {
    ...subname,
    status: 'revoked',
    revokedAt,
  }
}

export function subnameExpiryDescription(policy: SubnameExpiryPolicy): string {
  if (policy === 'inherits_parent') return 'Inherits parent expiry'
  return 'Fixed and capped by parent expiry'
}

export function subnameRevocationDescription(policy: SubnameRevocationPolicy): string {
  if (policy === 'parent_revocable') return 'Parent can revoke'
  return 'Locked after creation'
}
