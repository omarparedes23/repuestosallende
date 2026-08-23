'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TicketReceipt, type TicketReceiptData } from './TicketReceipt'

type Props = {
  data: TicketReceiptData
  onClose: () => void
}

export function TicketPrintPortal({ data, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300)

    // Chromium a veces no repinta el overlay fixed/sticky al salir de
    // @media print, dejando el botón "Cerrar" oculto aunque el CSS ya
    // no aplique. Forzamos un reflow tras cerrar el diálogo de impresión.
    const forceRepaint = () => {
      const el = rootRef.current
      if (!el) return
      el.style.display = 'none'
      void el.offsetHeight
      el.style.display = ''
    }
    window.addEventListener('afterprint', forceRepaint)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', forceRepaint)
    }
  }, [])

  return createPortal(
    <div
      ref={rootRef}
      className="ticket-print-root fixed inset-0 z-[100] overflow-auto bg-white flex flex-col items-center"
    >
      <div className="no-print sticky top-0 z-10 w-full flex justify-end p-3" style={{ backgroundColor: '#FFFFFF' }}>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
        >
          Cerrar
        </button>
      </div>
      <TicketReceipt data={data} />
    </div>,
    document.body
  )
}
