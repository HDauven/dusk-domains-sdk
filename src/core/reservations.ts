export const PENDING_NAME_RESERVATIONS_STORAGE_KEY = 'dusk-names:pending-reservations:v1'

export type PendingNameReservation = {
  name: string
  node: string
  commitment: string
  secret: string
  controller: string
  ownerAddress: string
  chainId: string
  durationYears: number
  committedBlockHeight: number | null
  committedTxId: string | null
  createdAt: string
  updatedAt: string
}

export type PendingNameReservationFilter = {
  chainId?: string
  controller?: string
}

export type PendingNameReservationKey = {
  chainId: string
  controller: string
  commitment?: string
  node?: string
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function listPendingNameReservations(
  filter: PendingNameReservationFilter = {},
  storage?: StorageLike | null,
): PendingNameReservation[] {
  const reservations = readPendingNameReservations(storage)
  return reservations
    .filter((reservation) => {
      if (filter.chainId && reservation.chainId !== filter.chainId) return false
      if (filter.controller && normalizeController(reservation.controller) !== normalizeController(filter.controller)) return false
      return true
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
}

export function upsertPendingNameReservation(
  reservation: PendingNameReservation,
  storage?: StorageLike | null,
): PendingNameReservation[] {
  const normalized = normalizePendingNameReservation(reservation)
  if (!normalized) return []

  const reservations = readPendingNameReservations(storage)
  const next = [
    normalized,
    ...reservations.filter((current) => !sameReservationSlot(current, normalized)),
  ]

  writePendingNameReservations(next, storage)
  return listPendingNameReservations({}, storage)
}

export function updatePendingNameReservationBlock(
  key: PendingNameReservationKey,
  update: {
    committedBlockHeight: number | null
    committedTxId?: string | null
    updatedAt?: string
  },
  storage?: StorageLike | null,
): PendingNameReservation[] {
  const reservations = readPendingNameReservations(storage)
  let updated = false
  const next = reservations.map((reservation) => {
    if (!matchesReservationKey(reservation, key)) return reservation
    updated = true
    return {
      ...reservation,
      committedBlockHeight: update.committedBlockHeight,
      committedTxId: update.committedTxId ?? reservation.committedTxId,
      updatedAt: update.updatedAt ?? new Date().toISOString(),
    }
  })

  if (updated) writePendingNameReservations(next, storage)
  return listPendingNameReservations({}, storage)
}

export function removePendingNameReservation(
  key: PendingNameReservationKey,
  storage?: StorageLike | null,
): PendingNameReservation[] {
  const reservations = readPendingNameReservations(storage)
  const next = reservations.filter((reservation) => !matchesReservationKey(reservation, key))

  if (next.length !== reservations.length) {
    writePendingNameReservations(next, storage)
  }

  return listPendingNameReservations({}, storage)
}

function readPendingNameReservations(storage?: StorageLike | null) {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return []

  try {
    const raw = resolvedStorage.getItem(PENDING_NAME_RESERVATIONS_STORAGE_KEY)
    if (!raw) return []
    const payload = JSON.parse(raw) as unknown
    if (!Array.isArray(payload)) return []
    return payload
      .map(normalizePendingNameReservation)
      .filter((reservation): reservation is PendingNameReservation => reservation !== null)
  } catch {
    return []
  }
}

function writePendingNameReservations(
  reservations: PendingNameReservation[],
  storage?: StorageLike | null,
) {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return

  try {
    resolvedStorage.setItem(PENDING_NAME_RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations))
  } catch {
    // Local reservation recovery is best-effort; the transaction remains canonical.
  }
}

function normalizePendingNameReservation(value: unknown): PendingNameReservation | null {
  if (!isRecord(value)) return null

  const name = stringField(value.name)
  const node = stringField(value.node)
  const commitment = stringField(value.commitment)
  const secret = stringField(value.secret)
  const controller = stringField(value.controller)
  const ownerAddress = stringField(value.ownerAddress)
  const chainId = stringField(value.chainId)
  const createdAt = stringField(value.createdAt)
  const updatedAt = stringField(value.updatedAt)
  const durationYears = numberField(value.durationYears)
  const committedBlockHeight = nullableNumberField(value.committedBlockHeight)
  const committedTxId = nullableStringField(value.committedTxId)

  if (!name || !node || !commitment || !secret || !controller || !ownerAddress || !chainId || !createdAt || !updatedAt) {
    return null
  }
  if (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 10) return null
  if (!isValidIsoDate(createdAt) || !isValidIsoDate(updatedAt)) return null

  return {
    name,
    node,
    commitment,
    secret,
    controller,
    ownerAddress,
    chainId,
    durationYears,
    committedBlockHeight,
    committedTxId,
    createdAt,
    updatedAt,
  }
}

function sameReservationSlot(left: PendingNameReservation, right: PendingNameReservation) {
  if (left.chainId !== right.chainId) return false
  if (normalizeController(left.controller) !== normalizeController(right.controller)) return false
  return left.commitment === right.commitment || left.node === right.node
}

function matchesReservationKey(reservation: PendingNameReservation, key: PendingNameReservationKey) {
  if (reservation.chainId !== key.chainId) return false
  if (normalizeController(reservation.controller) !== normalizeController(key.controller)) return false
  if (key.commitment && reservation.commitment === key.commitment) return true
  if (key.node && reservation.node === key.node) return true
  return false
}

function resolveStorage(storage?: StorageLike | null) {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function normalizeController(value: string) {
  return value.trim().toLowerCase()
}

function stringField(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : ''
}

function nullableStringField(value: unknown) {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value : null
}

function numberField(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

function nullableNumberField(value: unknown) {
  if (value === null || value === undefined) return null
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function isValidIsoDate(value: string) {
  return Number.isFinite(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
