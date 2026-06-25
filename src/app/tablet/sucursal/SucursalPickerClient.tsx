'use client'

import { useActionState } from 'react'
import { seleccionarSucursal } from './actions'
import type { RaSucursal } from '@/lib/types/database'

export function SucursalPickerClient({ sucursales }: { sucursales: RaSucursal[] }) {
  const [error, formAction, isPending] = useActionState(seleccionarSucursal, null)

  if (sucursales.length === 0) {
    return (
      <div
        className="rounded-xl px-6 py-8 text-center text-sm"
        style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
      >
        No hay tiendas activas configuradas. Contacta al administrador del sistema.
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-3">
        {sucursales.map((s) => (
          <label
            key={s.id}
            className="flex items-start gap-4 rounded-xl border-2 px-5 py-4 cursor-pointer transition-colors hover:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          >
            <input
              type="radio"
              name="sucursal_id"
              value={s.id}
              required
              className="mt-1 accent-[#002D62]"
            />
            <div>
              <p className="font-semibold text-base" style={{ color: '#002D62' }}>
                {s.nombre}
              </p>
              {s.direccion && (
                <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
                  {s.direccion}
                </p>
              )}
            </div>
          </label>
        ))}
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
        className="w-full rounded-xl py-4 text-base font-bold transition-opacity disabled:opacity-60"
        style={{ backgroundColor: '#002D62', color: '#FFD700' }}
      >
        {isPending ? 'Ingresando...' : 'Entrar a esta tienda'}
      </button>
    </form>
  )
}
