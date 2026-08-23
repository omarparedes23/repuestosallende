'use client'

import { useEffect } from 'react'
import { usePosStore } from '@/app/tablet/stores/posStore'

export function SessionHydrator({ cajaId, userId, empresaId }: { cajaId: string; userId: string; empresaId: string }) {
  const setCajaId = usePosStore((s) => s.setCajaId)
  const setSessionScope = usePosStore((s) => s.setSessionScope)

  useEffect(() => {
    setCajaId(cajaId)
    setSessionScope(userId, empresaId)
  }, [cajaId, userId, empresaId, setCajaId, setSessionScope])

  return null
}
