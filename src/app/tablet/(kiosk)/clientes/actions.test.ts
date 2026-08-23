import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { consultarDocumento } from './actions'
import * as sessionModule from '@/lib/session'

const mockFetch = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('tablet clientes actions — consultarDocumento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('APISPERU_TOKEN', 'token-de-prueba')
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('retorna No autenticado y no invoca el servicio sin sesión', async () => {
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: {} as never,
      user: null,
      perfil: null,
      sucursalId: null,
    } as never)

    const resultado = await consultarDocumento('RUC', '20131312955')

    expect(resultado).toEqual({ data: null, error: 'No autenticado' })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
