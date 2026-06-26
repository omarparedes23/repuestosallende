'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trash2, ChevronLeft } from 'lucide-react'
import { buscarProductosParaCompra } from '../../../compras/actions'
import { crearGuia } from '../../actions'
import type { ItemGuia } from '../../actions'

type Sucursal = { id: string; nombre: string }
type ItemForm = ItemGuia & { key: string }

type Props = { sucursales: Sucursal[] }

export function NuevaGuiaForm({ sucursales }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [origenId, setOrigenId] = useState(sucursales[0]?.id ?? '')
  const [destinoId, setDestinoId] = useState(sucursales[1]?.id ?? '')
  const [serie, setSerie] = useState('')
  const [correlativo, setCorrelativo] = useState('')
  const [notas, setNotas] = useState('')

  const [productoQuery, setProductoQuery] = useState('')
  const [productoSugerencias, setProductoSugerencias] = useState<any[]>([])
  const [items, setItems] = useState<ItemForm[]>([])
  const [error, setError] = useState<string | null>(null)

  const productoTimer = useRef<NodeJS.Timeout | null>(null)

  function onProductoInput(q: string) {
    setProductoQuery(q)
    if (productoTimer.current) clearTimeout(productoTimer.current)
    if (!q.trim()) { setProductoSugerencias([]); return }
    productoTimer.current = setTimeout(async () => {
      const res = await buscarProductosParaCompra(q)
      setProductoSugerencias(res)
    }, 250)
  }

  function agregarProducto(p: any) {
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
        { key: `${p.catalogo_id}-${Date.now()}`, catalogo_id: p.catalogo_id, nombre: p.nombre, cantidad: 1 },
      ])
    }
    setProductoQuery('')
    setProductoSugerencias([])
  }

  function actualizarCantidad(key: string, cantidad: number) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, cantidad } : i)))
  }

  function eliminarItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  function handleSubmit() {
    if (!origenId || !destinoId) { setError('Selecciona origen y destino.'); return }
    if (origenId === destinoId) { setError('Origen y destino deben ser distintos.'); return }
    if (items.length === 0) { setError('Agrega al menos un artículo.'); return }

    setError(null)
    startTransition(async () => {
      const result = await crearGuia(
        origenId, destinoId,
        serie.trim() || null,
        correlativo.trim() || null,
        notas.trim() || null,
        items.map(({ key: _key, ...rest }) => rest)
      )
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/panel/guias')
      }
    })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} style={{ color: '#374151' }} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Nueva guía de remisión</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Transferencia entre sucursales</p>
        </div>
      </div>

      {/* Sección 1: Origen y destino */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <h2 className="text-base font-bold" style={{ color: '#002D62' }}>1. Origen y destino</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Sucursal origen</label>
            <select
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62] bg-white"
              style={{ borderColor: '#D1D5DB' }}
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Sucursal destino</label>
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62] bg-white"
              style={{ borderColor: '#D1D5DB' }}
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Serie</label>
            <input
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              placeholder="T001"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Correlativo</label>
            <input
              value={correlativo}
              onChange={(e) => setCorrelativo(e.target.value)}
              placeholder="00001"
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
            placeholder="Motivo del traslado..."
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none resize-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>
      </div>

      {/* Sección 2: Artículos */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <h2 className="text-base font-bold" style={{ color: '#002D62' }}>2. Artículos a trasladar</h2>
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
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                  style={{ color: '#111827' }}
                >
                  {p.nombre}
                  {p.codigo_oem && (
                    <span className="ml-2 text-xs font-mono" style={{ color: '#9CA3AF' }}>{p.codigo_oem}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

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
                {['Artículo', 'Cantidad', ''].map((h) => (
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
                  <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{item.nombre}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidad(item.key, parseInt(e.target.value) || 1)}
                      className="w-20 rounded-lg border-2 px-2 py-1.5 text-sm text-center outline-none focus:border-[#002D62]"
                      style={{ borderColor: '#D1D5DB' }}
                    />
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

      {/* Submit */}
      <div className="space-y-3">
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
            {isPending ? 'Creando...' : 'Crear guía'}
          </button>
        </div>
      </div>
    </div>
  )
}
