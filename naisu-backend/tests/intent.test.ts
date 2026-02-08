/**
 * Intent Service Tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { intentService } from '../src/services/intent.service'

describe('Intent Service', () => {
  it('should create an intent', async () => {
    const intent = await intentService.createIntent({
      userAddress: '0x' + 'a'.repeat(64),
      inputToken: 'USDC',
      inputAmount: '1000000000',
      inputAmountRaw: '1000000000',
      minApy: '750',
      deadline: 3600,
    })
    
    expect(intent).toBeDefined()
    expect(intent.inputToken).toBe('USDC')
    expect(intent.status).toBe('open')
  })
  
  it('should get intent by ID', async () => {
    const intent = await intentService.createIntent({
      userAddress: '0x' + 'b'.repeat(64),
      inputToken: 'SUI',
      inputAmount: '1000000000',
      inputAmountRaw: '1000000000',
      minApy: '500',
      deadline: 3600,
    })
    
    const fetched = await intentService.getIntentById(intent.id)
    
    expect(fetched).toBeDefined()
    expect(fetched?.id).toBe(intent.id)
  })
  
  it('should list intents', async () => {
    const result = await intentService.listIntents({
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
    
    expect(result.intents).toBeArray()
    expect(result.page).toBe(1)
  })
})
