'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { CatalogoEditForm } from './CatalogoEditForm'

type Props = {
  catalogoId: string
  className?: string
}

export function EditarRepuestoBoton({ catalogoId, className }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label="Editar producto"
        className={
          className ??
          'flex items-center justify-center w-8 h-8 rounded-full bg-white/90 shadow-sm hover:bg-white transition-colors'
        }
      >
        <Pencil className="w-4 h-4" style={{ color: '#002D62' }} />
      </button>

      <CatalogoEditForm
        open={open}
        catalogoId={catalogoId}
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  )
}
