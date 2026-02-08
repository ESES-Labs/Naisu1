/**
 * Test Setup
 */
import { beforeAll, afterAll } from 'bun:test'
import { config } from '../src/config/env'

// Set test environment
process.env.NODE_ENV = 'test'

beforeAll(() => {
  console.log('Setting up test environment...')
})

afterAll(() => {
  console.log('Cleaning up test environment...')
})
