import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  avanzarEstadoGuia,
  buscarProductosEnSucursal,
  crearGuia,
  obtenerPreviewSerieGuia,
  recibirGuia,
} from './actions'
import * as sessionModule from '@/lib/session'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('guias actions — buscarProductosEnSucursal', () => {
  let mockFrom: ReturnType<typeof vi.fn>
  let mockRpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom = vi.fn()
    mockRpc = vi.fn()
    const session = {
      supabase: { from: mockFrom, rpc: mockRpc } as never,
      user: { id: 'usuario-1' } as never,
      perfil: {
        id: 'usuario-1',
        empresa_id: 'empresa-1',
        rol: 'administrador',
        activo: true,
      } as never,
      sucursalId: 'sucursal-1',
    }
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      ...session,
    })
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue(session)
  })

  it('no consulta cuando falta texto o sucursal origen', async () => {
    await expect(buscarProductosEnSucursal('   ', 'sucursal-1')).resolves.toEqual([])
    await expect(buscarProductosEnSucursal('manguera', '')).resolves.toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('restringe la búsqueda a empresa, sucursal origen y stock positivo', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      gt: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.gt.mockReturnValue(query)
    query.or.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.limit.mockResolvedValue({
      data: [{
        id: 'producto-arriola',
        catalogo_id: 'catalogo-seguro',
        stock_actual: 19,
        ra_catalogo_repuestos: {
          nombre: 'SEGURO DE MANGUERA',
          codigo_oem: '703436901',
        },
      }],
      error: null,
    })
    mockFrom.mockReturnValue(query)

    const result = await buscarProductosEnSucursal('seguro', 'arriola-1')

    expect(mockFrom).toHaveBeenCalledWith('ra_productos')
    expect(query.eq).toHaveBeenCalledWith('empresa_id', 'empresa-1')
    expect(query.eq).toHaveBeenCalledWith('sucursal_id', 'arriola-1')
    expect(query.eq).toHaveBeenCalledWith('activo', true)
    expect(query.gt).toHaveBeenCalledWith('stock_actual', 0)
    expect(result).toEqual([{
      productoId: 'producto-arriola',
      catalogoId: 'catalogo-seguro',
      nombre: 'SEGURO DE MANGUERA',
      codigoOem: '703436901',
      stockDisponible: 19,
    }])
  })

  it('no expone sugerencias si la consulta falla', async () => {
    const query = {
      select: vi.fn(), eq: vi.fn(), gt: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.gt.mockReturnValue(query)
    query.or.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.limit.mockResolvedValue({ data: null, error: { message: 'fallo' } })
    mockFrom.mockReturnValue(query)

    await expect(buscarProductosEnSucursal('seguro', 'arriola-1')).resolves.toEqual([])
  })

  it('crea la guía mediante una única RPC, sin inserciones directas', async () => {
    mockRpc.mockResolvedValue({
      data: { status: 'created', guia: { id: 'guia-1', estado: 'borrador', items: 1 } },
      error: null,
    })

    const result = await crearGuia(
      'origen-1', 'destino-1', ' traslado ',
      [{ catalogo_id: 'catalogo-1', nombre: 'No es autoritativo', cantidad: 2 }]
    )

    expect(result).toEqual({ id: 'guia-1', error: null })
    expect(mockRpc).toHaveBeenCalledWith('ra_crear_guia', {
      p_sucursal_origen_id: 'origen-1',
      p_sucursal_destino_id: 'destino-1',
      p_notas: 'traslado',
      p_items: [{ catalogo_id: 'catalogo-1', cantidad: 2 }],
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('obtiene el preview sin reservar ni aceptar números del cliente', async () => {
    mockRpc.mockResolvedValue({
      data: { serie: '001', siguiente_correlativo: 6, numero_preview: '001-00000006' },
      error: null,
    })

    await expect(obtenerPreviewSerieGuia('origen-1')).resolves.toEqual({
      preview: { serie: '001', siguienteCorrelativo: 6, numeroPreview: '001-00000006' },
      error: null,
    })
    expect(mockRpc).toHaveBeenCalledWith('ra_obtener_preview_serie_guia', {
      p_sucursal_id: 'origen-1',
    })
  })

  it('traduce errores de creación y recepción desde las RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RA_GUIDE_SERIES_NOT_CONFIGURED' },
    })
    await expect(crearGuia(
      'origen-1', 'destino-1', null,
      [{ catalogo_id: 'catalogo-1', nombre: 'Artículo', cantidad: 1 }]
    )).resolves.toEqual({ id: null, error: 'La sucursal origen no tiene una serie de guías configurada.' })

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RA_STOCK_INSUFFICIENT' },
    })
    await expect(recibirGuia('guia-1')).resolves.toBe(
      'El stock disponible en origen ya no alcanza para recibir esta guía.'
    )
  })

  it('usa la RPC de transición y conserva sus errores de dominio', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RA_GUIDE_INVALID_STATE' },
    })

    await expect(avanzarEstadoGuia('guia-1', 'en_transito')).resolves.toBe(
      'La guía ya no está en el estado requerido para esta operación.'
    )
    expect(mockRpc).toHaveBeenCalledWith('ra_avanzar_estado_guia', {
      p_guia_id: 'guia-1',
      p_nuevo_estado: 'en_transito',
    })
  })
})
