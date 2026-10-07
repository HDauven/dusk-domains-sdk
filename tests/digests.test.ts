import { it, expect } from 'vitest'
import {
  hex,
  namehash,
  hash,
  authority,
  commitmentHash,
} from '../src/frozen/bytes.ts'
import {
  canonicalBytes,
  recordsDigest,
  moveManifestDigest,
} from '../src/frozen/digests.ts'
import { bytes } from './helpers.ts'
import type { MoveTicket, ExportRow } from '../src/frozen/types.ts'
it('matches protocol frozen_wire.rs derivation vectors', () => {
  const root = namehash('example.dusk')
  expect(hex(root)).toBe(
    'c22c0382c415688f74626049c8edbffdca5db46ec602666e39c54df6c8c093ea',
  )
  expect(hex(authority({ kind: 'Moonlight', bytes: bytes(7, 96) }))).toBe(
    '2427acbb4d59395fb6bb8621905c4e3540a4c98e4e3f3c90b2fa62ac0fdc045c',
  )
  expect(hex(commitmentHash(bytes(3), 'example', bytes(8)))).toBe(
    '85a10ce017576b1113d81dd8098cb523287b2647bdb6156408b805386e19c29b',
  )
  expect(
    hex(
      recordsDigest([
        {
          key: 'url',
          value: [97, 98, 99],
          ttl_seconds: 3600n,
          updated_at: 55n,
        },
      ]),
    ),
  ).toBe('80ada60870e39aa019da0073a0c72127bb1ac6529af0377b01c03b31d773e9e1')
  expect(
    hex(
      hash(
        'duskds:quote:v1',
        canonicalBytes('QuoteRequest', {
          version: 1,
          directory: bytes(1),
          store: bytes(2),
          node: root,
          label: 'example',
          actor: bytes(3),
          years: 1,
          height: 18446744073709551615n,
          previous_generation: 0n,
          previous_grace_end: null,
          policy_version: 18446744073709551615n,
        }),
      ),
    ),
  ).toBe('ddcbdd662030bb8aba212e462b2bde9373397f4d29ebfd53640a141b0d632160')
  expect(
    hex(
      hash(
        'duskds:action:v1',
        bytes(1),
        canonicalBytes('ProposalId', { operator_epoch: 7n, nonce: 9n }),
        canonicalBytes('Action', {
          SetRenewal: {
            expected_version: 1n,
            annual_lux: ['1', '2', '3', '4', '5'],
            referral_bps: 1000,
          },
        }),
      ),
    ),
  ).toBe('a51a923d376366aa6f6190f553bc01c2c246827f4e7ed29fc7e7c272b74961de')
})
it('matches the locked move-manifest golden and excludes provisional lifecycle', () => {
  const ref = {
    key: { root: bytes(4), node: bytes(4) },
    incarnation: { generation: 7n, serial: 1n },
  }
  const ticket: MoveTicket = {
    id: bytes(0),
    source: bytes(2),
    destination: bytes(3),
    root: ref,
    initiator: bytes(5),
    source_revision: 5n,
    counters: {
      generation: 7n,
      next_serial: 2n,
      next_epoch: 3n,
      next_custody: 4n,
      revision: 5n,
    },
    row_count: 1,
    primary_count: 0,
    manifest: bytes(0),
    created_at: 1n,
    expires_at: 8641n,
  }
  const row: ExportRow = {
    index: 0,
    name: {
      key: ref.key,
      label: 'example',
      incarnation: ref.incarnation,
      owner: bytes(5),
      manager: bytes(6),
      expires_at: 100n,
      grace_end: 200n,
      referrer: null,
      subname: null,
      records: null,
      custody: null,
    },
    primary: null,
  }
  expect(hex(moveManifestDigest(ticket, [row]))).toBe(
    '2391968d7608bc79e272fa2e985e382b518a89863738a6f0f5d7b7794630a159',
  )
  row.name.expires_at = 300n
  row.name.grace_end = 400n
  expect(hex(moveManifestDigest(ticket, [row]))).toBe(
    '2391968d7608bc79e272fa2e985e382b518a89863738a6f0f5d7b7794630a159',
  )
})
