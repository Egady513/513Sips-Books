/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'
import { decideGate, type AuthStatus } from './gate.ts'

const allowed = ['contact@513sips.com']

for (const status of ['loading', 'signed-in', 'signed-out'] as AuthStatus[]) {
  test(`login requirement off shows the app while ${status}`, () => {
    assert.equal(decideGate({ requireLogin: false, status, email: null, allowed }), 'show-app')
  })
}

test('login requirement on waits while the session is loading', () => {
  assert.equal(decideGate({ requireLogin: true, status: 'loading', email: null, allowed }), 'loading')
})

test('login requirement on shows sign-in when signed out', () => {
  assert.equal(decideGate({ requireLogin: true, status: 'signed-out', email: null, allowed }), 'show-login')
})

test('login requirement on shows the app for an allowed account', () => {
  assert.equal(decideGate({
    requireLogin: true,
    status: 'signed-in',
    email: 'contact@513sips.com',
    allowed,
  }), 'show-app')
})

test('login requirement on rejects an account not on the list', () => {
  assert.equal(decideGate({
    requireLogin: true,
    status: 'signed-in',
    email: 'other@example.com',
    allowed,
  }), 'not-allowed')
})

test('login requirement on compares allowed accounts without case sensitivity', () => {
  assert.equal(decideGate({
    requireLogin: true,
    status: 'signed-in',
    email: 'CONTACT@513SIPS.COM',
    allowed,
  }), 'show-app')
})
