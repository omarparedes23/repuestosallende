'use client'

import { useEffect } from 'react'
import { usePosStore } from '@/app/tablet/stores/posStore'

export function SessionHydrator({ cajaId }: { cajaId: string }) {
  const setCajaId = usePosStore((s) => s.setCajaId)

  useEffect(() => {
    setCajaId(cajaId)
  }, [cajaId, setCajaId])

  return null
}
