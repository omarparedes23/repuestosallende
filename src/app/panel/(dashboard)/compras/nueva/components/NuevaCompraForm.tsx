'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Trash2, ChevronLeft } from 'lucide-react'
import { buscarProveedores, buscarProductosParaCompra, registrarCompra } from '../../actions'
import type { ItemCompra } from '../../actions'

type Proveedor = { id: string; nombre: string }
type ProductoSugerido = {
  catalogo_id: string
  nombre: string
  codigo_oem: string | null
  precio_compra: number | null
}

type ItemForm = ItemCompra & { key: string }

export function NuevaCompraForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Proveedor
  const [proveedorQuery, setProveedorQuery] = useState('')
  const [proveedorSugerencias, setProveedorSugerencias] = useState<Proveedor[]>([])
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null)

  // Productos
  const [productoQuery, setProductoQuery] = useState('')
  const [productoSugerencias, setProductoSugerencias] = useState<ProductoSugerido[]>([])
  const [items, setItems] = useState<ItemForm[]>([])

  // Extras
  const [nroDocumento, setNroDocumento] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  const proveedorTimer = useRef<NodeJS.Timeout | null>(null)
  const productoTimer = useRef<NodeJS.Timeout | null>(null)

  function onProveedorInput(q: string) {
    setProveedorQuery(q)
    if (proveedorTimer.current) clearTimeout(proveedorTimer.current)
    if (!q.trim()) { setProveedorSugerencias([]); return }
    proveedorTimer.current = setTimeout(async () => {
      const res = await buscarProveedores(q)
      setProveedorSugerencias(res)
    }, 250)
  }

  function seleccionarProveedor(p: Proveedor) {
    setProveedorSeleccionado(p)
    setProveedorQuery(p.nombre)
    setProveedorSugerencias([])
  }

  function onProductoInput(q: string) {
    setProductoQuery(q)
    if (productoTimer.current) clearTimeout(productoTimer.current)
    if (!q.trim()) { setProductoSugerencias([]); return }
    productoTimer.current = setTimeout(async () => {
      const res = await buscarProductosParaCompra(q)
      setProductoSugerencias(res)
    }, 250)
  }

  function agregarProducto(p: ProductoSugerido) {
    const existe = items.find((i) => i.catalogo_id === p.catalogo_id)
    if (existe) {
      setItems((prev) =>
        prev.map((i) =>
          i.catalogo_id === p.catalogo_id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      )
    } else {
      setItems((prev) => [
        ...prev,
        {
          key: `${p.catalogo_id}-${Date.now()}`,
          catalogo_id: p.catalogo_id,
          nombre_producto: p.nombre,
          cantidad: 1,
          precio_unitario: p.precio_compra ?? 0,
        },
      ])
    }
    setProductoQuery('')
    setProductoSugerencias([])
  }

  function actualizarItem(key: string, field: 'cantidad' | 'precio_unitario', value: number) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i))
    )
  }

  function eliminarItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)
  const igv = subtotal * 0.18
  const total = subtotal + igv

  function handleSubmit() {
    if (!proveedorSeleccionado) { setError('Selecciona un proveedor.'); return }
    if (items.length === 0) { setError('Agrega al menos un artículo.'); return }

    setError(null)
    startTransition(async () => {
      const result = await registrarCompra(
        proveedorSeleccionado.id,
        nroDocumento.trim() || null,
        notas.trim() || null,
        items.map(({ key: _key, ...rest }) => rest)
      )
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/panel/compras')
      }
    })
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} style={{ color: '#374151' }} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Nueva compra</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Registra una compra a proveedor</p>
        </div>
      </div>

      {/* Sección 1: Proveedor */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <h2 className="text-base font-bold" style={{ color: '#002D62' }}>1. Proveedor</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 relative">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
              Proveedor <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              value={proveedorQuery}
              onChange={(e) => onProveedorInput(e.target.value)}
              placeholder="Buscar proveedor..."
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
            {proveedorSugerencias.length > 0 && (
              <div
                className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
                style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}
              >
                {proveedorSugerencias.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => seleccionarProveedor(p)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                    style={{ color: '#111827' }}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Nro. documento / factura</label>
            <input
              value={nroDocumento}
              onChange={(e) => setNroDocumento(e.target.value)}
              placeholder="F001-00123"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Observaciones..."
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none resize-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>
      </div>

      {/* Sección 2: Artículos */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <h2 className="text-base font-bold" style={{ color: '#002D62' }}>2. Artículos</h2>

        {/* Buscador de productos */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input
            value={productoQuery}
            onChange={(e) => onProductoInput(e.target.value)}
            placeholder="Buscar artículo por nombre o código OEM..."
            className="w-full rounded-xl border-2 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
          {productoSugerencias.length > 0 && (
            <div
              className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
              style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}
            >
              {productoSugerencias.map((p) => (
                <button
                  key={p.catalogo_id}
                  type="button"
                  onClick={() => agregarProducto(p)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <span style={{ color: '#111827' }}>{p.nombre}</span>
                    {p.codigo_oem && (
                      <span className="ml-2 text-xs font-mono" style={{ color: '#9CA3AF' }}>{p.codigo_oem}</span>
                    )}
                  </div>
                  {p.precio_compra != null && (
                    <span className="text-xs font-semibold" style={{ color: '#059669' }}>
                      S/ {p.precio_compra.toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items agregados */}
        {items.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed flex items-center justify-center py-10"
            style={{ borderColor: '#E5E7EB' }}
          >
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Busca y agrega artículos arriba</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB' }}>
                {['Artículo', 'Cantidad', 'Precio unit.', 'Subtotal', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#6B7280' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>
                    {item.nombre_producto}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => actualizarItem(item.key, 'cantidad', parseInt(e.target.value) || 1)}
                      className="w-20 rounded-lg border-2 px-2 py-1.5 text-sm text-center outline-none focus:border-[#002D62]"
                      style={{ borderColor: '#D1D5DB' }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.precio_unitario}
                      onChange={(e) => actualizarItem(item.key, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      className="w-28 rounded-lg border-2 px-2 py-1.5 text-sm text-right outline-none focus:border-[#002D62]"
                      style={{ borderColor: '#D1D5DB' }}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#111827' }}>
                    S/ {(item.cantidad * item.precio_unitario).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => eliminarItem(item.key)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} style={{ color: '#DC2626' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Totales + Submit */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between" style={{ color: '#6B7280' }}>
            <span>Subtotal</span>
            <span>S/ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between" style={{ color: '#6B7280' }}>
            <span>IGV (18%)</span>
            <span>S/ {igv.toFixed(2)}</span>
          </div>
          <div
            className="flex justify-between text-base font-bold pt-2 border-t"
            style={{ borderColor: '#E5E7EB', color: '#002D62' }}
          >
            <span>Total</span>
            <span>S/ {total.toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: '#D1D5DB', color: '#374151' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            {isPending ? 'Registrando...' : 'Registrar compra'}
          </button>
        </div>
      </div>
    </div>
  )
}
