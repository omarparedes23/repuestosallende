'use client'

import { useActionState, useState } from 'react'
import { Landmark, Store } from 'lucide-react'
import { abrirCaja } from '../actions'
import { cambiarSucursal } from '@/app/tablet/sucursal/actions'
import type { RaRol } from '@/lib/types/database'

interface Props {
  empresaId: string
  sucursalId: string
  rol: RaRol
}

export function AbrirCajaScreen({ empresaId, sucursalId, rol }: Props) {
  const [error, formAction, isPending] = useActionState(abrirCaja, null)
  const [operationId] = useState(() => crypto.randomUUID())
  void empresaId
  void sucursalId

  const puedeAbrir = rol === 'administrador' || rol === 'superadmin'

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: '#F0F4FF' }}
    >
      <div className="w-full max-w-sm space-y-8 text-center">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mx-auto"
          style={{ backgroundColor: '#002D62' }}
        >
          <Landmark size={40} color="#FFD700" />
        </div>

        {puedeAbrir ? (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold" style={{ color: '#002D62' }}>
                Abrir caja del día
              </h2>
              <p className="text-sm" style={{ color: '#6B7280' }}>
                Ingresa el monto inicial en efectivo para comenzar a operar.
              </p>
            </div>

            {['administrador', 'superadmin'].includes(rol) && (
              <form action={cambiarSucursal}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ color: '#002D62' }}
                >
                  <Store size={17} />
                  Cambiar sucursal
                </button>
              </form>
            )}

            <form action={formAction} className="space-y-5">
              <input type="hidden" name="operation_id" value={operationId} />
              <div className="space-y-2 text-left">
                <label
                  htmlFor="monto_inicial"
                  className="block text-sm font-semibold"
                  style={{ color: '#002D62' }}
                >
                  Monto inicial (S/.)
                </label>
                <input
                  id="monto_inicial"
                  name="monto_inicial"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                  className="w-full rounded-xl border-2 px-4 py-4 text-xl font-bold outline-none transition-colors focus:border-[#002D62]"
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
                className="w-full rounded-xl py-4 text-base font-bold transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#002D62', color: '#FFD700' }}
              >
                {isPending ? 'Abriendo caja...' : 'Abrir caja'}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold" style={{ color: '#002D62' }}>
              Tienda sin caja abierta
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              La caja de esta tienda aún no ha sido abierta hoy. Contacta al administrador para que la abra y puedas comenzar a vender.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
