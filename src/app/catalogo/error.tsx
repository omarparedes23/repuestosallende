'use client'

import { ErrorState } from '@/components/ErrorState'

export default function CatalogoError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <ErrorState error={error} onRetry={unstable_retry} title="No pudimos cargar el catálogo" />
}
