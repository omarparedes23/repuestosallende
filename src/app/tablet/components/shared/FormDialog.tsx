'use client'

import { X } from 'lucide-react'

type Props = {
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function FormDialog({ title, onClose, children, size = 'sm' }: Props) {
  const maxW =
    size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-3xl' : size === 'md' ? 'max-w-md' : 'max-w-sm'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`w-full ${maxW} rounded-2xl overflow-hidden shadow-xl`}
        style={{ backgroundColor: '#FFFFFF', maxHeight: '85vh' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#E5E7EB' }}
        >
          <h2 className="text-base font-bold" style={{ color: '#002D62' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl"
            style={{ backgroundColor: '#F3F4F6' }}
            aria-label="Cerrar"
          >
            <X size={18} style={{ color: '#374151' }} />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 64px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
