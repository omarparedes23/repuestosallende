import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sessionModule from '@/lib/session'
import { buscarArticulos, getMovimientosKardex, getStockBajoCount, getSucursalesActivas, resolverDocumentoKardex } from './actions'

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

  it('deriva catálogo y sucursal desde el producto antes de consultar kardex', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { catalogo_id: 'catalogo-1', sucursal_id: 'sucursal-1' }, error: null,
    })
    const productoEmpresa = vi.fn().mockReturnValue({ maybeSingle })
    const productoId = vi.fn().mockReturnValue({ eq: productoEmpresa })
    const kardexRange = vi.fn().mockResolvedValue({ data: [], count: 0, error: null })
    const kardexOrder = vi.fn().mockReturnValue({ range: kardexRange })
    const kardexSucursal = vi.fn().mockReturnValue({ order: kardexOrder })
    const kardexCatalogo = vi.fn().mockReturnValue({ eq: kardexSucursal })
    const kardexEmpresa = vi.fn().mockReturnValue({ eq: kardexCatalogo })
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: productoId }) })
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: kardexEmpresa }) }),
    }
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: supabase as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId: null,
    })

    await expect(getMovimientosKardex('11111111-1111-4111-8111-111111111111')).resolves.toMatchObject({ total: 0, error: null })
    expect(productoId).toHaveBeenCalledWith('id', '11111111-1111-4111-8111-111111111111')
    expect(productoEmpresa).toHaveBeenCalledWith('empresa_id', 'empresa-1')
    expect(kardexEmpresa).toHaveBeenCalledWith('empresa_id', 'empresa-1')
    expect(kardexCatalogo).toHaveBeenCalledWith('catalogo_id', 'catalogo-1')
    expect(kardexSucursal).toHaveBeenCalledWith('sucursal_id', 'sucursal-1')
  })

  it('resuelve cada documento de kardex por motivo, sin cruzar tipos', () => {
    const compraId = '11111111-1111-4111-8111-111111111111'
    const ventaId = '22222222-2222-4222-8222-222222222222'
    const guiaId = '33333333-3333-4333-8333-333333333333'
    const compras = new Map([[compraId, { nro_documento: 'F001-45', tipo_documento: 'factura' }]])
    const ventas = new Map([[ventaId, { numero_completo: 'B001-00000088' }]])
    const guias = new Map([[guiaId, { serie: 'T001', correlativo: 9 }]])

    expect(resolverDocumentoKardex('compra', compraId, compras, ventas, guias)).toEqual({
      documento: { etiqueta: 'Compra · F001-45', href: `/panel/compras/${compraId}` },
      documentoNoDisponible: false,
    })
    expect(resolverDocumentoKardex('venta', ventaId, compras, ventas, guias)).toEqual({
      documento: { etiqueta: 'Venta · B001-00000088', href: null },
      documentoNoDisponible: false,
    })
    expect(resolverDocumentoKardex('traslado', guiaId, compras, ventas, guias)).toEqual({
      documento: { etiqueta: 'Guía · T001-00000009', href: `/panel/guias/${guiaId}` },
      documentoNoDisponible: false,
    })
  })

  it('conserva un movimiento con referencia histórica ausente', () => {
    expect(resolverDocumentoKardex('venta', '44444444-4444-4444-8444-444444444444', new Map(), new Map(), new Map())).toEqual({
      documento: null,
      documentoNoDisponible: true,
    })
  })

  it('no inventa documento para ajustes aunque tengan referencia', () => {
    expect(resolverDocumentoKardex('ajuste_manual', '55555555-5555-4555-8555-555555555555', new Map(), new Map(), new Map())).toEqual({
      documento: null,
      documentoNoDisponible: false,
    })
  })
})
