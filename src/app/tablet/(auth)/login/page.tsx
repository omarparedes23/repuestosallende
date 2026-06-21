'use client'

import { useActionState } from 'react'
import { signIn } from '@/app/tablet/actions/auth'

export default function TabletLoginPage() {
  const [error, formAction, isPending] = useActionState(signIn, null)

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: '#F0F4FF' }}>
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-2xl font-bold text-white"
            style={{ backgroundColor: '#002D62' }}
          >
            RA
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#002D62' }}>
            Repuestos Allende
          </h1>
          <p className="text-base" style={{ color: '#6B7280' }}>
            Sistema POS — Ingresa con tu cuenta
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-semibold"
              style={{ color: '#002D62' }}
            >
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              required
              autoComplete="email"
              className="w-full rounded-xl border-2 px-4 py-4 text-base outline-none transition-colors focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB', fontSize: '1rem' }}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-semibold"
              style={{ color: '#002D62' }}
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border-2 px-4 py-4 text-base outline-none transition-colors focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB', fontSize: '1rem' }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl py-4 text-base font-bold transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#002D62', color: '#FFD700', fontSize: '1rem' }}
          >
            {isPending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: '#9CA3AF' }}>
          Sistema POS para tablet · Repuestos Allende S.A.C.
        </p>
      </div>
    </div>
  )
}
