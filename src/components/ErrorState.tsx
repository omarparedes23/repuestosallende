'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

type ErrorStateProps = {
  error: Error & { digest?: string }
  onRetry: () => void
  title?: string
  description?: string
  fullScreen?: boolean
}

export function ErrorState({
  error,
  onRetry,
  title = 'No pudimos cargar esta sección',
  description = 'Ocurrió un problema al obtener la información. Intenta nuevamente en unos segundos.',
  fullScreen = false,
}: ErrorStateProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-4 px-6 py-16 text-center ${fullScreen ? 'min-h-screen' : 'min-h-[50vh]'}`}
    >
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <p className="max-w-md text-sm text-slate-600">{description}</p>
      <Button size="lg" onClick={onRetry}>
        Reintentar
      </Button>
      {error.digest && (
        <p className="text-xs text-slate-400">Código de referencia: {error.digest}</p>
      )}
    </div>
  )
}
