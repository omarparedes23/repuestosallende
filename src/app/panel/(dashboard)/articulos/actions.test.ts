import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sessionModule from '@/lib/session'
import { buscarArticulos, getStockBajoCount, getSucursalesActivas } from './actions'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/r2', () => ({
  subirImagen: vi.fn(),
  IMAGENES_TIPOS_PERMITIDOS: [],
  IMAGEN_MAX_BYTES: 0,
}))

function productosQuery(rows: unknown[] = []) {
  const range = vi.fn().mockResolvedValue({ data: rows, count: rows.length, error: null })
  const order = vi.fn().mockReturnValue({ range })
  const eq = vi.fn()
  const query = { eq, or: vi.fn().mockReturnThis(), order }
  eq.mockReturnValue(query)
  return { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(query) }), eq }
}

describe('articulos actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('limita la busqueda a la empresa y sucursal solicitada', async () => {
    const supabase = productosQuery()
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: supabase as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId: 'sucursal-1',
    })

    await buscarArticulos('', 1, null, null, 'sucursal-2')

    expect(supabase.eq).toHaveBeenCalledWith('empresa_id', 'empresa-1')
    expect(supabase.eq).toHaveBeenCalledWith('sucursal_id', 'sucursal-2')
  })

  it('consulta consolidado cuando no se indica sucursal', async () => {
    const supabase = productosQuery()
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: supabase as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId: null,
    })

    await buscarArticulos('', 1, null, null, null)

    expect(supabase.eq).toHaveBeenCalledWith('empresa_id', 'empresa-1')
    expect(supabase.eq).not.toHaveBeenCalledWith('sucursal_id', expect.anything())
  })

  it('lista solo sucursales activas de la empresa', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'sucursal-1', nombre: 'Principal' }] })
    const eqActivo = vi.fn().mockReturnValue({ order })
    const eqEmpresa = vi.fn().mockReturnValue({ eq: eqActivo })
    const supabase = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: eqEmpresa }) }) }
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: supabase as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId: null,
    })

    await expect(getSucursalesActivas()).resolves.toEqual([{ id: 'sucursal-1', nombre: 'Principal' }])
    expect(eqEmpresa).toHaveBeenCalledWith('empresa_id', 'empresa-1')
    expect(eqActivo).toHaveBeenCalledWith('activo', true)
  })

  it('pasa la sucursal seleccionada al contador de stock bajo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 4 })
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: { rpc } as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId: 'sucursal-1',
    })

    await expect(getStockBajoCount('sucursal-2')).resolves.toBe(4)
    expect(rpc).toHaveBeenCalledWith('ra_contar_stock_bajo', {
      p_empresa_id: 'empresa-1',
      p_sucursal_id: 'sucursal-2',
    })
  })
})
