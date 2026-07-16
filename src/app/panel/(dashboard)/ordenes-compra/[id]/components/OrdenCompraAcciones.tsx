'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmarOrdenCompra, anularOrdenCompra } from '../../actions'

type Props = {
  id: string
  estado: 'borrador' | 'confirmada' | 'recibida' | 'anulada'
}

export function OrdenCompraAcciones({ id, estado }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConfirmar() {
    setError(null)
    startTransition(async () => {
      const err = await confirmarOrdenCompra(id)
      if (err) setError(err)
      else router.refresh()
    })
  }

  function handleAnular() {
    if (!window.confirm('¿Anular esta orden de compra? Esta acción no se puede deshacer.')) return
    setError(null)
    startTransition(async () => {
      const err = await anularOrdenCompra(id)
      if (err) setError(err)
      else router.refresh()
    })
  }

  const puedeConfirmar = estado === 'borrador'
  const puedeAnular = estado === 'borrador' || estado === 'confirmada'

  if (!puedeConfirmar && !puedeAnular) return null

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {puedeConfirmar && (
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            {isPending ? 'Procesando...' : 'Confirmar'}
          </button>
        )}
        {puedeAnular && (
          <button
            type="button"
            onClick={handleAnular}
            disabled={isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-bold border-2 disabled:opacity-50"
            style={{ borderColor: '#DC2626', color: '#DC2626' }}
          >
            {isPending ? 'Procesando...' : 'Anular'}
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
