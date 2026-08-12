'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TicketReceipt, type TicketReceiptData } from './TicketReceipt'

type Props = {
  data: TicketReceiptData
  onClose: () => void
}

export function TicketPrintPortal({ data, onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300)
    return () => clearTimeout(timer)
  }, [])

  return createPortal(
    <div
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
