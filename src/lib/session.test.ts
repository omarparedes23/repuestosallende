import { beforeEach, describe, expect, it, vi } from 'vitest'

const EMPRESA = '11111111-1111-4111-8111-111111111111'
const SUCURSAL = '22222222-2222-4222-8222-222222222222'
const USER_ID = '33333333-3333-4333-8333-333333333333'

const cookieStore = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined) }),
}))

type Mock = {
  perfil: Record<string, unknown> | null
  sucursalExiste: boolean
  claims: { sub: string } | null
  sucursalQueries: number
}
const state: Mock = { perfil: null, sucursalExiste: false, claims: null, sucursalQueries: 0 }

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: state.claims ? { claims: state.claims } : null, error: null }),
      getUser: async () => ({ data: { user: state.claims ? { id: state.claims.sub } : null } }),
    },
    from: (tabla: string) => {
      const result = () => {
        if (tabla === 'ra_sucursales') {
          state.sucursalQueries += 1
          return { data: state.sucursalExiste ? { id: SUCURSAL } : null, error: null }
        }
        return { data: state.perfil, error: null }
      }
      const chain: Record<string, unknown> = {}
      for (const method of ['select', 'eq']) chain[method] = () => chain
      chain.single = async () => result()
      chain.maybeSingle = async () => result()
      return chain
    },
  }),
}))

import { getSessionFast } from './session'

const admin = { id: USER_ID, nombre: 'Ana', empresa_id: EMPRESA, sucursal_id: null, rol: 'administrador', activo: true }

describe('getSessionFast', () => {
  beforeEach(() => {
    cookieStore.clear()
    state.perfil = admin
    state.sucursalExiste = false
    state.claims = { sub: USER_ID }
    state.sucursalQueries = 0
  })

  it('returns no user when the token has no verified claims', async () => {
    state.claims = null
    const session = await getSessionFast()
    expect(session.user).toBeNull()
    expect(session.perfil).toBeNull()
  })

  it('exposes only the verified user id from the claims', async () => {
    const session = await getSessionFast()
    expect(session.user).toEqual({ id: USER_ID })
  })

  it('ignores the cookie for vendedores and uses the profile sucursal', async () => {
    state.perfil = { ...admin, rol: 'vendedor', sucursal_id: SUCURSAL }
    cookieStore.set('ra_sucursal_activa', '99999999-9999-4999-8999-999999999999')
    const session = await getSessionFast()
    expect(session.sucursalId).toBe(SUCURSAL)
    expect(state.sucursalQueries).toBe(0)
  })

  it('accepts the admin cookie only when the sucursal belongs to the empresa', async () => {
    cookieStore.set('ra_sucursal_activa', SUCURSAL)
    state.sucursalExiste = true
    expect((await getSessionFast()).sucursalId).toBe(SUCURSAL)
  })

  it('rejects a forged admin cookie that points to a foreign or inactive sucursal', async () => {
    cookieStore.set('ra_sucursal_activa', SUCURSAL)
    state.sucursalExiste = false
    expect((await getSessionFast()).sucursalId).toBeNull()
  })

  it('rejects a cookie that is not a uuid without querying the database', async () => {
    cookieStore.set('ra_sucursal_activa', "x' or 1=1 --")
    expect((await getSessionFast()).sucursalId).toBeNull()
    expect(state.sucursalQueries).toBe(0)
  })

  it('returns no sucursal for an admin without cookie', async () => {
    expect((await getSessionFast()).sucursalId).toBeNull()
  })
})
