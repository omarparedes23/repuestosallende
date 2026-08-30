import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processSunatOutbox } from '@/lib/facturacion/outbox'
import { GET } from './route'

vi.mock('@/lib/facturacion/outbox', () => ({
  processSunatOutbox: vi.fn(),
}))

const worker = vi.mocked(processSunatOutbox)

describe('GET /api/internal/sunat-outbox', () => {
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret-for-test'
  })

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
  })

  it('rechaza una llamada sin el secreto de Vercel Cron', async () => {
    const response = await GET(new Request('http://localhost/api/internal/sunat-outbox'))

    expect(response.status).toBe(401)
    expect(worker).not.toHaveBeenCalled()
  })

  it('procesa la outbox cuando Vercel envía el CRON_SECRET correcto', async () => {
    worker.mockResolvedValue({ claimed: 1, processed: 1 })

    const response = await GET(new Request('http://localhost/api/internal/sunat-outbox', {
      headers: { authorization: 'Bearer cron-secret-for-test' },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ claimed: 1, processed: 1 })
    expect(worker).toHaveBeenCalledWith(10)
  })
})
