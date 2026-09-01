'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, PackageSearch } from 'lucide-react'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { getMovimientosKardex } from '../actions'
import type { ArticuloRow, MovimientoKardex } from '../actions'

const FILAS_POR_PAGINA = 25

const MOTIVO_LABEL: Record<string, string> = {
  compra: 'Compra',
  venta: 'Venta',
  traslado: 'Traslado',
  ajuste_manual: 'Ajuste manual',
  devolucion: 'Devolución',
  merma: 'Merma',
}

const TIPO_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  entrada: { bg: '#F0FDF4', color: '#059669', label: 'Entrada' },
  salida: { bg: '#FEF2F2', color: '#DC2626', label: 'Salida' },
  ajuste: { bg: '#FFFBEB', color: '#D97706', label: 'Ajuste' },
}

function formatoFecha(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(value))
}

function Documento({ movimiento }: { movimiento: MovimientoKardex }) {
  if (movimiento.documento) {
    return movimiento.documento.href ? (
      <Link href={movimiento.documento.href} className="font-medium hover:underline" style={{ color: '#002D62' }}>
        {movimiento.documento.etiqueta}
      </Link>
    ) : <span style={{ color: '#374151' }}>{movimiento.documento.etiqueta}</span>
  }

  if (movimiento.documentoNoDisponible) {
    return <span style={{ color: '#9CA3AF' }}>Documento no disponible</span>
  }

  return <span style={{ color: '#9CA3AF' }}>—</span>
}

type Props = {
  open: boolean
  articulo: ArticuloRow | null
  sucursalNombre: string | null
  onClose: () => void
}

export function KardexDialog({ open, articulo, sucursalNombre, onClose }: Props) {
  const [movimientos, setMovimientos] = useState<MovimientoKardex[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !articulo) return

    let vigente = true
    const articuloId = articulo.id
    async function cargar() {
      const result = await getMovimientosKardex(articuloId, pagina)
      if (!vigente) return
      setMovimientos(result.data)
      setTotal(result.total)
      setError(result.error)
      setLoading(false)
    }
    void cargar()

    return () => { vigente = false }
  }, [open, articulo, pagina])

  if (!open || !articulo) return null

  const totalPaginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA))

  return (
    <FormDialog title={`Movimientos — ${articulo.nombre}`} onClose={onClose} size="xl">
      <div className="p-5 space-y-4">
        <div className="rounded-xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ backgroundColor: '#F8FAFC', color: '#374151' }}>
          <span><strong>Código:</strong> {articulo.codigo_oem ?? '—'}</span>
          <span><strong>Sucursal:</strong> {sucursalNombre ?? '—'}</span>
          <span><strong>Stock actual:</strong> {articulo.stock_actual}</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-14 text-sm" style={{ color: '#6B7280' }}>
            <Loader2 size={18} className="animate-spin" /> Cargando movimientos…
          </div>
        )}

        {!loading && error && (
          <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>{error}</p>
        )}

        {!loading && !error && movimientos.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-14">
            <PackageSearch size={32} style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#6B7280' }}>Este artículo aún no tiene movimientos de kardex.</p>
          </div>
        )}

        {!loading && !error && movimientos.length > 0 && (
          <>
            <div className="md:hidden space-y-3">
              {movimientos.map((m) => {
                const estilo = TIPO_STYLE[m.tipo] ?? TIPO_STYLE.ajuste
                return (
                  <div key={m.id} className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#E5E7EB' }}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: estilo.bg, color: estilo.color }}>{estilo.label}</span>
                      <span className="text-xs" style={{ color: '#6B7280' }}>{formatoFecha(m.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: '#374151' }}>{MOTIVO_LABEL[m.motivo] ?? m.motivo}</p>
                    <p className="text-sm" style={{ color: '#374151' }}>Cantidad: {m.cantidad} · Stock: {m.stock_anterior} → {m.stock_nuevo}</p>
                    <p className="text-xs"><Documento movimiento={m} /></p>
                    {m.notas && <p className="text-xs" style={{ color: '#6B7280' }}>{m.notas}</p>}
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
              <table className="w-full text-sm">
                <thead><tr style={{ backgroundColor: '#F9FAFB' }}>
                  {['Fecha', 'Tipo', 'Motivo', 'Cantidad', 'Stock', 'Documento', 'Notas'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>{h}</th>)}
                </tr></thead>
                <tbody>{movimientos.map((m) => {
                  const estilo = TIPO_STYLE[m.tipo] ?? TIPO_STYLE.ajuste
                  return <tr key={m.id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: '#374151' }}>{formatoFecha(m.created_at)}</td>
                    <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: estilo.bg, color: estilo.color }}>{estilo.label}</span></td>
                    <td className="px-4 py-3" style={{ color: '#374151' }}>{MOTIVO_LABEL[m.motivo] ?? m.motivo}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: estilo.color }}>{m.tipo === 'salida' ? '−' : '+'}{m.cantidad}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#374151' }}>{m.stock_anterior} → {m.stock_nuevo}</td>
                    <td className="px-4 py-3 text-xs"><Documento movimiento={m} /></td>
                    <td className="px-4 py-3 text-xs max-w-48" style={{ color: '#6B7280' }}>{m.notas ?? '—'}</td>
                  </tr>
                })}</tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !error && total > FILAS_POR_PAGINA && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs" style={{ color: '#6B7280' }}>Página {pagina} de {totalPaginas} — {total} movimientos</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setLoading(true); setPagina((p) => Math.max(1, p - 1)) }} disabled={pagina === 1} className="p-2 rounded-lg border disabled:opacity-40" style={{ borderColor: '#D1D5DB' }} aria-label="Página anterior"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => { setLoading(true); setPagina((p) => Math.min(totalPaginas, p + 1)) }} disabled={pagina === totalPaginas} className="p-2 rounded-lg border disabled:opacity-40" style={{ borderColor: '#D1D5DB' }} aria-label="Página siguiente"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </FormDialog>
  )
}
