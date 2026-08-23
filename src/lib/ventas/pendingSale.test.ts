import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPendingSale, loadPendingSale, markPendingSaleUnknown, savePendingSale } from './pendingSale'

describe('pendingSale', () => {
  const values = new Map<string, string>()
  beforeEach(() => {
    values.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
  })

  it('persiste y recupera el mismo operationId por usuario y empresa', () => {
    const attempt = { version: 1 as const, operationId: 'op-1', userId: 'u1', empresaId: 'e1', createdAt: 'now', payload: { total: 1 }, state: 'sending' as const }
    savePendingSale(attempt)
    expect(loadPendingSale('u1', 'e1')).toEqual(attempt)
    expect(loadPendingSale('u2', 'e1')).toBeNull()
  })

  it('conserva el intento desconocido hasta cierre explícito', () => {
    const attempt = { version: 1 as const, operationId: 'op-1', userId: 'u1', empresaId: 'e1', createdAt: 'now', payload: {}, state: 'sending' as const }
    markPendingSaleUnknown(attempt)
    expect(loadPendingSale('u1', 'e1')?.state).toBe('unknown')
    clearPendingSale('u1', 'e1')
    expect(loadPendingSale('u1', 'e1')).toBeNull()
  })
})
