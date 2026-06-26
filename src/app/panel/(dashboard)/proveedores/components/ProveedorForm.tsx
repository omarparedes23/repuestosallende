'use client'

import { useActionState } from 'react'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { upsertProveedor } from '../actions'
import type { RaProveedor } from '@/lib/types/database'

type Props = {
  open: boolean
  onClose: () => void
  proveedor?: RaProveedor | null
}

export function ProveedorForm({ open, onClose, proveedor }: Props) {
  const [error, formAction, isPending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await upsertProveedor(prev, fd)
      if (!result) onClose()
      return result
    },
    null
  )

  if (!open) return null

  return (
    <FormDialog
      title={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      onClose={onClose}
      size="md"
    >
      <form action={formAction} className="p-5 space-y-4">
        {proveedor && <input type="hidden" name="id" value={proveedor.id} />}

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#002D62' }}>
            Nombre <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            name="nombre"
            defaultValue={proveedor?.nombre ?? ''}
            required
            placeholder="Ej: Distribuidora Lima S.A."
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>RUC</label>
            <input
              name="ruc"
              defaultValue={proveedor?.ruc ?? ''}
              placeholder="20123456789"
              maxLength={11}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Teléfono</label>
            <input
              name="telefono"
              defaultValue={proveedor?.telefono ?? ''}
              placeholder="999 000 000"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Email</label>
          <input
            name="email"
            type="email"
            defaultValue={proveedor?.email ?? ''}
            placeholder="proveedor@empresa.com"
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Dirección</label>
          <input
            name="direccion"
            defaultValue={proveedor?.direccion ?? ''}
            placeholder="Av. Industrial 123, Lima"
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Contacto</label>
            <input
              name="contacto"
              defaultValue={proveedor?.contacto ?? ''}
              placeholder="Nombre del vendedor"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Notas</label>
          <textarea
            name="notas"
            defaultValue={proveedor?.notas ?? ''}
            rows={2}
            placeholder="Observaciones..."
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none resize-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
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
            {isPending ? 'Guardando...' : proveedor ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
        </div>
      </form>
    </FormDialog>
  )
}
