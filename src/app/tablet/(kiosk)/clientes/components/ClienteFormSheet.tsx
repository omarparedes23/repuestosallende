'use client'

import { useState, useTransition } from 'react'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { crearCliente, actualizarCliente } from '../actions'
import type { ClienteResumen } from '../actions'

type Props = {
  cliente?: ClienteResumen | null
  onClose: () => void
}

const TIPO_DOC = ['DNI', 'RUC', 'CE', 'PASAPORTE'] as const

export function ClienteFormSheet({ cliente, onClose }: Props) {
  const isEditing = !!cliente
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const action = isEditing
        ? actualizarCliente.bind(null, cliente.id)
        : crearCliente
      const result = await action(null, formData)
      if (result === null) {
        onClose()
      } else {
        setError(result)
      }
    })
  }

  return (
    <FormDialog
      title={isEditing ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
            Nombre <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            name="nombre"
            defaultValue={cliente?.nombre ?? ''}
            required
            placeholder="Nombre completo o razón social"
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
            Tipo de cliente
          </label>
          <div className="flex rounded-xl overflow-hidden border-2" style={{ borderColor: '#D1D5DB' }}>
            {(['minorista', 'mayorista'] as const).map((tipo) => (
              <label
                key={tipo}
                className="flex-1 flex items-center justify-center gap-2 py-3 cursor-pointer text-sm font-semibold"
              >
                <input
                  type="radio"
                  name="tipo_cliente"
                  value={tipo}
                  defaultChecked={
                    cliente?.tipo_cliente === tipo || (!cliente && tipo === 'minorista')
                  }
                  className="sr-only"
                />
                <span className="capitalize">{tipo}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
              Tipo doc.
            </label>
            <select
              name="tipo_documento"
              defaultValue={cliente?.tipo_documento ?? 'DNI'}
              className="w-full rounded-xl border-2 px-3 py-3 text-sm outline-none"
              style={{ borderColor: '#D1D5DB' }}
            >
              <option value="">Sin documento</option>
              {TIPO_DOC.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
              Nro. documento
            </label>
            <input
              name="nro_documento"
              defaultValue={cliente?.nro_documento ?? ''}
              placeholder="12345678"
              className="w-full rounded-xl border-2 px-3 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
            Teléfono
          </label>
          <input
            name="telefono"
            type="tel"
            defaultValue={cliente?.telefono ?? ''}
            placeholder="999 999 999"
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-4 rounded-xl text-base font-bold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
        >
          {isPending
            ? isEditing ? 'Guardando...' : 'Creando...'
            : isEditing ? 'Guardar cambios' : 'Crear cliente'}
        </button>
      </form>
    </FormDialog>
  )
}
