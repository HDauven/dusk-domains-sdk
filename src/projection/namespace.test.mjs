import { expect, it } from 'vitest'
import { createProjectionState, applyProjectionEvent } from './state.mjs'

const expiresAt = '2040-01-01T00:00:00Z'
const root = 'root', child = 'child', leaf = 'leaf'
const transfer = (node, dataCleared = false) => ({ type: 'name_owner_changed', node, actor: 'buyer', previousOwner: 'seller', owner: 'buyer', manager: 'manager', resolver: '', expiresAt, dataCleared })
function namespace() {
  const state = createProjectionState()
  applyProjectionEvent(state, { type: 'name_registered', node: root, label: 'alice', owner: 'seller', actor: 'seller', expiresAt, graceEndsAt: expiresAt })
  for (const [node, parentNode, name] of [[child, root, 'docs.alice.dusk'], [leaf, child, 'api.docs.alice.dusk']]) {
    applyProjectionEvent(state, { type: 'subname_created', node, parentNode, name, parentName: name.split('.').slice(1).join('.'), label: name.split('.')[0], owner: 'seller', manager: 'seller', resolver: '', expiresAt, parentExpiresAt: expiresAt, expiryPolicy: 'inherits_parent', createdAt: expiresAt })
    applyProjectionEvent(state, { type: 'record_changed', node, controller: 'seller', record: { key: 'website', value: 'https://old', type: 'text' } })
    applyProjectionEvent(state, { type: 'primary_name_changed', node, controller: 'seller', endpoint: { type: 'moonlight_address', value: node }, name, previousName: null, updatedAt: expiresAt })
  }
  return state
}
it('projects subname authorities in every index without a hex lifecycle row', () => {
  const state = namespace()
  applyProjectionEvent(state, transfer(child))
  expect(state.namesByNode.has(child)).toBe(false)
  for (const row of [state.subnamesByNode.get(child), state.subnamesByParent.get(root)[0], state.subnamesByCanonical.get('docs.alice.dusk')]) {
    expect(row).toMatchObject({ owner: 'buyer', manager: 'manager', name: 'docs.alice.dusk' })
  }
  expect(state.activityByNode.get(child)[0].name).toBe('docs.alice.dusk')
  expect(state.recordsByNode.get(child)).toHaveLength(1)
})
it('clears only a taken-back node identity and leaves ordinary transfers untouched', () => {
  const state = namespace()
  applyProjectionEvent(state, transfer(root))
  expect(state.subnamesByNode.get(child).owner).toBe('seller')
  expect(state.recordsByNode.get(child)).toHaveLength(1)
  applyProjectionEvent(state, transfer(child, true))
  expect(state.recordsByNode.has(child)).toBe(false)
  expect(state.recordsByNodeKey.has(`${child}\u0000website`)).toBe(false)
  expect(state.reverseKeysByNode.has(child)).toBe(false)
  expect(state.reverseByEndpoint.size).toBe(1)
  expect(state.recordsByNode.get(leaf)).toHaveLength(1)
  expect(state.subnamesByNode.get(leaf).owner).toBe('seller')
})
it('removes active descendants and identity using explicit removal events', () => {
  const state = namespace()
  applyProjectionEvent(state, { type: 'subname_removed', node: child, parentNode: root, name: 'docs.alice.dusk', actor: 'buyer', removedAt: expiresAt })
  expect(state.subnamesByNode.size).toBe(0)
  expect(state.subnamesByParent.size).toBe(0)
  expect(state.recordsByNode.size).toBe(0)
  expect(state.reverseByEndpoint.size).toBe(0)
})

it.each(['domain_fixed_sale_filled', 'domain_offer_accepted', 'domain_auction_settled'])('remembers the seller after %s for post-purchase take-back', type => {
  const state = namespace()
  applyProjectionEvent(state, transfer(root))
  applyProjectionEvent(state, { type, saleId: 1, auctionId: 1, node: root, sellerAuthority: 'seller', buyerAuthority: 'buyer', winnerAuthority: 'buyer', domainExpired: false })
  expect(state.namesByNode.get(root).namespacePurchase).toEqual({ seller: 'seller', buyer: 'buyer' })
  applyProjectionEvent(state, { ...transfer(root), owner: 'next-owner' })
  expect(state.namesByNode.get(root).namespacePurchase).toBeNull()
})

it('retains the accepted-offer seller when the marketplace event precedes the core transfer', () => {
  const state = namespace()
  applyProjectionEvent(state, { type:'domain_offer_accepted', node:root, sellerAuthority:'seller', buyerAuthority:'buyer' })
  applyProjectionEvent(state, transfer(root))
  expect(state.namesByNode.get(root).namespacePurchase).toEqual({seller:'seller',buyer:'buyer'})
  applyProjectionEvent(state, {type:'name_registered',node:root,label:'alice',owner:'buyer',actor:'buyer',expiresAt,graceEndsAt:expiresAt})
  expect(state.namesByNode.get(root).namespacePurchase).toBeNull()
})


it.each([false, true])('projects root transfer reset %s without changing descendants', dataCleared => {
  const state = namespace()
  applyProjectionEvent(state, { type: 'record_changed', node: root, controller: 'seller', record: { key: 'website', value: 'https://seller', type: 'text' } })
  applyProjectionEvent(state, { type: 'primary_name_changed', node: root, controller: 'seller', endpoint: { type: 'moonlight_address', value: root }, name: 'alice.dusk', previousName: null, updatedAt: expiresAt })
  const children = structuredClone([...state.subnamesByNode])
  applyProjectionEvent(state, transfer(root, dataCleared))
  expect(state.namesByNode.get(root)).toMatchObject({ owner: 'buyer', manager: 'manager' })
  expect(state.recordsByNode.has(root)).toBe(!dataCleared)
  expect(state.recordsByNodeKey.has(`${root}\u0000website`)).toBe(!dataCleared)
  expect(state.reverseKeysByNode.has(root)).toBe(!dataCleared)
  expect(state.reverseByEndpoint.size).toBe(dataCleared ? 2 : 3)
  expect([...state.subnamesByNode]).toEqual(children)
  expect(state.recordsByNode.get(child)).toHaveLength(1)
  expect(state.recordsByNode.get(leaf)).toHaveLength(1)
})
