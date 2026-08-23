export type PendingSaleAttemptV1<T = unknown> = {
  version: 1
  operationId: string
  userId: string
  empresaId: string
  createdAt: string
  payload: T
  state: 'ready' | 'sending' | 'unknown'
}

const PREFIX = 'ra:pending-sale:v1'

function key(userId: string, empresaId: string) {
  return `${PREFIX}:${empresaId}:${userId}`
}

export function loadPendingSale<T>(userId: string, empresaId: string): PendingSaleAttemptV1<T> | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const value = JSON.parse(localStorage.getItem(key(userId, empresaId)) ?? 'null')
    if (value?.version !== 1 || value.userId !== userId || value.empresaId !== empresaId || typeof value.operationId !== 'string') return null
    return value as PendingSaleAttemptV1<T>
  } catch {
    return null
  }
}

export function savePendingSale<T>(attempt: PendingSaleAttemptV1<T>) {
  localStorage.setItem(key(attempt.userId, attempt.empresaId), JSON.stringify(attempt))
}

export function markPendingSaleUnknown<T>(attempt: PendingSaleAttemptV1<T>) {
  savePendingSale({ ...attempt, state: 'unknown' })
}

export function clearPendingSale(userId: string, empresaId: string) {
  localStorage.removeItem(key(userId, empresaId))
}
