'use client'

import { useActionState } from 'react'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { updatePreciosArticulo } from '../actions'
import type { ArticuloRow } from '../actions'

type Props = {
  open: boolean
  onClose: () => void
  articulo: ArticuloRow | null
}

export function ArticuloEditForm({ open, onClose, articulo }: Props) {
  const [error, formAction, isPending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await updatePreciosArticulo(prev, fd)
      if (!result) onClose()
      return result
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#002D62' }}>
              Precio venta
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
        </div>

        <div className="grid grid-cols-2 gap-3">
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
