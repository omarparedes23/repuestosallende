import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  tone: 'warning' | 'danger'
  children: ReactNode
}

const TONES = {
  warning: { backgroundColor: '#FEF3C7', color: '#92400E' },
  danger: { backgroundColor: '#FEE2E2', color: '#DC2626' },
} as const

/** Aviso con icono (role="alert"), usado para advertencias y errores de validación. */
export function AlertBox({ tone, children }: Props) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium"
      style={TONES[tone]}
      role="alert"
    >
      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}
