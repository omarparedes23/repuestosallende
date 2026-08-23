'use client'

import { useRef, useState, useTransition } from 'react'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { crearCliente, actualizarCliente, consultarDocumento } from '../actions'
import type { ClienteResumen } from '../actions'

type Props = {
  cliente?: ClienteResumen | null
  onClose: () => void
}

const TIPO_DOC = ['DNI', 'RUC', 'CE', 'PASAPORTE'] as const
type TipoDocSeleccion = (typeof TIPO_DOC)[number] | ''
const esTipoDocSeleccion = (v: string): v is TipoDocSeleccion =>
  v === '' || (TIPO_DOC as readonly string[]).includes(v)
const TIPO_DOC_CONSULTABLE = new Set(['DNI', 'RUC'])

export function ClienteFormSheet({ cliente, onClose }: Props) {
  const isEditing = !!cliente
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocSeleccion>(
    cliente?.tipo_documento ?? 'DNI'
  )
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [isConsultando, setIsConsultando] = useState(false)
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null)
  const nroDocumentoRef = useRef<HTMLInputElement>(null)

  const handleBuscarDocumento = () => {
    const numero = nroDocumentoRef.current?.value.trim() ?? ''
    if (!TIPO_DOC_CONSULTABLE.has(tipoDocumento ?? '')) return
    setErrorConsulta(null)
    setIsConsultando(true)
    startTransition(async () => {
      const { data, error } = await consultarDocumento(tipoDocumento as 'DNI' | 'RUC', numero)
      setIsConsultando(false)
      if (error) {
        setErrorConsulta(error)
        return
      }
      if (data) setNombre(data.nombre)
    })
  }

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
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
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
              value={tipoDocumento ?? ''}
              onChange={(e) => {
                const { value } = e.target
                if (esTipoDocSeleccion(value)) setTipoDocumento(value)
              }}
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
            <div className="flex gap-2">
              <input
                ref={nroDocumentoRef}
                name="nro_documento"
                defaultValue={cliente?.nro_documento ?? ''}
                placeholder="12345678"
                className="w-full rounded-xl border-2 px-3 py-3 text-sm outline-none focus:border-[#002D62]"
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
          <p className="text-xs font-medium" style={{ color: '#DC2626' }}>
            {errorConsulta}
          </p>
        )}

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
