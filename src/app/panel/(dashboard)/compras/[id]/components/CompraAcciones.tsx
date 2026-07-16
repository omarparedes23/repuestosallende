'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { anularCompra } from '../../actions'

type Props = { id: string }

export function CompraAcciones({ id }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAnular() {
    if (!window.confirm('¿Anular esta compra? Revierte el stock recibido. Esta acción no se puede deshacer.')) return
    setError(null)
    startTransition(async () => {
      const err = await anularCompra(id)
      if (err) setError(err)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleAnular}
        disabled={isPending}
        className="px-4 py-2.5 rounded-xl text-sm font-bold border-2 disabled:opacity-50"
        style={{ borderColor: '#DC2626', color: '#DC2626' }}
      >
        {isPending ? 'Procesando...' : 'Anular'}
      </button>
      {error && (
        <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
