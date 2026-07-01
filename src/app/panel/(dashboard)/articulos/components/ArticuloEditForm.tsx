'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { updatePreciosArticulo, updateCompatibilidad, subirImagenArticulo } from '../actions'
import type { ArticuloRow, ModeloOption } from '../actions'

type Props = {
  open: boolean
  onClose: () => void
  articulo: ArticuloRow | null
  modelos: ModeloOption[]
}

export function ArticuloEditForm({ open, onClose, articulo, modelos }: Props) {
  const router = useRouter()
  const [error, formAction, isPending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const precioResult = await updatePreciosArticulo(prev, fd)
      if (precioResult) return precioResult

      const modeloIds = fd.getAll('modelos') as string[]
      const compatResult = await updateCompatibilidad(articulo!.catalogo_id, modeloIds)
      if (compatResult) return compatResult

      const imagen = fd.get('imagen')
      if (imagen instanceof File && imagen.size > 0) {
        const imagenResult = await subirImagenArticulo(articulo!.catalogo_id, fd)
        if (imagenResult) return imagenResult
      }

      onClose()
      router.refresh()
      return null
    },
    null
  )

  if (!open || !articulo) return null

  return (
    <FormDialog
      title={`Editar — ${articulo.nombre}`}
      onClose={onClose}
      size="md"
    >
      <form action={formAction} className="p-5 space-y-4">
        <input type="hidden" name="id" value={articulo.id} />

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
            Foto del producto
          </label>
          <div className="flex items-center gap-3">
            {articulo.imagen_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={articulo.imagen_url}
                alt={articulo.nombre}
                className="w-16 h-16 rounded-xl object-contain border-2 shrink-0"
                style={{ borderColor: '#D1D5DB' }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center text-[10px] text-center shrink-0"
                style={{ borderColor: '#D1D5DB', color: '#9CA3AF' }}
              >
                Sin foto
              </div>
            )}
            <input
              name="imagen"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="flex-1 text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:cursor-pointer"
              style={{ color: '#374151' }}
            />
          </div>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>JPG, PNG o WEBP. Máx. 5MB.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#002D62' }}>
              Precio venta (S/)
            </label>
            <input
              name="precio_venta"
              type="number"
              step="0.01"
              min="0"
              defaultValue={articulo.precio_venta ?? ''}
              placeholder="0.00"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#002D62' }}>
              Precio venta (USD)
            </label>
            <input
              name="precio_venta_dolar"
              type="number"
              step="0.01"
              min="0"
              defaultValue={articulo.precio_venta_dolar ?? ''}
              placeholder="0.00"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
              Precio mayorista
            </label>
            <input
              name="precio_mayorista"
              type="number"
              step="0.01"
              min="0"
              defaultValue={articulo.precio_mayorista ?? ''}
              placeholder="0.00"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
              Precio compra
            </label>
            <input
              name="precio_compra"
              type="number"
              step="0.01"
              min="0"
              defaultValue={articulo.precio_compra ?? ''}
              placeholder="0.00"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
            Stock mínimo
          </label>
          <input
            name="stock_minimo"
            type="number"
            step="1"
            min="0"
            defaultValue={articulo.stock_minimo}
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
            Modelos compatibles
          </label>
          <div
            className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl border-2 p-3 max-h-40 overflow-y-auto"
            style={{ borderColor: '#D1D5DB' }}
          >
            {modelos.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                <input
                  type="checkbox"
                  name="modelos"
                  value={m.id}
                  defaultChecked={articulo.modelos_compatibles.includes(m.id)}
                  className="rounded"
                />
                {m.nombre}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: '#D1D5DB', color: '#374151' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </FormDialog>
  )
}
