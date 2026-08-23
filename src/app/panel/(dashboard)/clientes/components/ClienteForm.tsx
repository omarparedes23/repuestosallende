'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { upsertCliente, consultarDocumento } from '../actions'
import type { RaCliente } from '@/lib/types/database'

const TIPO_DOC_CONSULTABLE = new Set(['DNI', 'RUC'])

type Props = {
  open: boolean
  onClose: () => void
  cliente?: RaCliente | null
}

export function ClienteForm({ open, onClose, cliente }: Props) {
  const [tieneCredito, setTieneCredito] = useState(cliente?.tiene_credito ?? false)
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '')
  const [tipoDocumento, setTipoDocumento] = useState(cliente?.tipo_documento ?? '')
  const [isConsultando, startConsulta] = useTransition()
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null)
  const nroDocumentoRef = useRef<HTMLInputElement>(null)

  const [error, formAction, isPending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await upsertCliente(prev, fd)
      if (!result) onClose()
      return result
    },
    null
  )

  const handleBuscarDocumento = () => {
    const numero = nroDocumentoRef.current?.value.trim() ?? ''
    if (!TIPO_DOC_CONSULTABLE.has(tipoDocumento ?? '')) return
    setErrorConsulta(null)
    startConsulta(async () => {
      const { data, error } = await consultarDocumento(tipoDocumento as 'DNI' | 'RUC', numero)
      if (error) {
        setErrorConsulta(error)
        return
      }
      if (data) {
        setNombre(data.nombre)
        if (data.direccion) setDireccion(data.direccion)
      }
    })
  }

  if (!open) return null

  return (
    <FormDialog
      title={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={onClose}
      size="md"
    >
      <form action={formAction} className="p-5 space-y-4">
        {cliente && <input type="hidden" name="id" value={cliente.id} />}

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#002D62' }}>
            Nombre <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            name="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej: Juan Pérez"
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Tipo documento</label>
            <select
              name="tipo_documento"
              value={tipoDocumento ?? ''}
              onChange={(e) => setTipoDocumento(e.target.value)}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62] bg-white"
              style={{ borderColor: '#D1D5DB' }}
            >
              <option value="">Sin documento</option>
              <option value="DNI">DNI</option>
              <option value="RUC">RUC</option>
              <option value="CE">Carné de extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Nro. documento</label>
            <div className="flex gap-2">
              <input
                ref={nroDocumentoRef}
                name="nro_documento"
                defaultValue={cliente?.nro_documento ?? ''}
                placeholder="12345678"
                className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
                style={{ borderColor: '#D1D5DB' }}
              />
              {TIPO_DOC_CONSULTABLE.has(tipoDocumento ?? '') && (
                <button
                  type="button"
                  onClick={handleBuscarDocumento}
                  disabled={isConsultando}
                  className="shrink-0 px-3 rounded-xl text-xs font-bold disabled:opacity-50"
                  style={{ backgroundColor: '#002D62', color: '#FFD700' }}
                >
                  {isConsultando ? '...' : 'Buscar'}
                </button>
              )}
            </div>
          </div>
        </div>

        {errorConsulta && (
          <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{errorConsulta}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Teléfono</label>
            <input
              name="telefono"
              defaultValue={cliente?.telefono ?? ''}
              placeholder="999 000 000"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Email</label>
            <input
              name="email"
              type="email"
              defaultValue={cliente?.email ?? ''}
              placeholder="cliente@email.com"
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Dirección</label>
          <input
            name="direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Av. Lima 123"
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        <div className="rounded-xl border-2 p-4 space-y-3" style={{ borderColor: '#E5E7EB' }}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="tiene_credito"
              checked={tieneCredito}
              onChange={(e) => setTieneCredito(e.target.checked)}
              className="w-4 h-4 rounded accent-[#002D62]"
            />
            <span className="text-sm font-semibold" style={{ color: '#374151' }}>Habilitar crédito</span>
          </label>
          {tieneCredito && (
            <div className="space-y-1">
              <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Límite de crédito (S/)</label>
              <input
                name="limite_credito"
                type="number"
                step="0.01"
                min="0"
                defaultValue={cliente?.limite_credito ?? 0}
                className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
                style={{ borderColor: '#D1D5DB' }}
              />
            </div>
          )}
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
            {isPending ? 'Guardando...' : cliente ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </FormDialog>
  )
}
