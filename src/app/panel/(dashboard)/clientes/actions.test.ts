import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { consultarDocumento } from './actions'
import * as sessionModule from '@/lib/session'

const mockFetch = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('clientes actions — consultarDocumento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('APISPERU_TOKEN', 'token-de-prueba')
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
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

  it('consulta el RUC con sesión válida y retorna nombre y dirección', async () => {
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: {} as never,
      user: { id: 'user-1' } as never,
      perfil: {
        id: 'user-1',
        empresa_id: 'empresa-1',
        rol: 'administrador',
        activo: true,
      } as never,
      sucursalId: 'sucursal-1',
    } as never)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ruc: '20131312955',
        razonSocial: 'ACME SAC',
        direccion: 'AV. PRUEBA 123',
        estado: 'ACTIVO',
        condicion: 'HABIDO',
      }),
    } as Response)

    const resultado = await consultarDocumento('RUC', '20131312955')

    expect(resultado).toEqual({
      data: { nombre: 'ACME SAC', direccion: 'AV. PRUEBA 123' },
      error: null,
    })
  })

  it('propaga el error del servicio cuando la consulta falla', async () => {
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: {} as never,
      user: { id: 'user-1' } as never,
      perfil: {
        id: 'user-1',
        empresa_id: 'empresa-1',
        rol: 'vendedor',
        activo: true,
      } as never,
      sucursalId: 'sucursal-1',
    } as never)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: false, message: 'Documento no encontrado' }),
    } as Response)

    const resultado = await consultarDocumento('DNI', '12345678')

    expect(resultado).toEqual({ data: null, error: 'Documento no encontrado' })
  })
})
