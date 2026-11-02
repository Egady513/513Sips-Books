/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'
import { isAllowedEmail, parseAllowedEmails } from './allowList.ts'

test('parseAllowedEmails uses the default when unset', () => {
  assert.deepEqual(parseAllowedEmails(undefined), ['contact@513sips.com'])
})

test('parseAllowedEmails uses the default for an empty string', () => {
  assert.deepEqual(parseAllowedEmails(''), ['contact@513sips.com'])
})

test('parseAllowedEmails uses the default for whitespace', () => {
  assert.deepEqual(parseAllowedEmails('   '), ['contact@513sips.com'])
})

test('parseAllowedEmails trims and lower-cases mixed-case input', () => {
  assert.deepEqual(parseAllowedEmails('  Contact@513Sips.COM  '), ['contact@513sips.com'])
})

test('parseAllowedEmails parses two addresses', () => {
  assert.deepEqual(
    parseAllowedEmails('contact@513sips.com, second@example.com'),
    ['contact@513sips.com', 'second@example.com'],
  )
})

test('isAllowedEmail compares addresses without case sensitivity', () => {
  assert.equal(isAllowedEmail('CONTACT@513SIPS.COM', ['contact@513sips.com']), true)
  assert.equal(isAllowedEmail('other@example.com', ['contact@513sips.com']), false)
})
