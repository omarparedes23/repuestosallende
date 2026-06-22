'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { siteConfig, whatsappUrl } from '@/lib/site.config'
import { WhatsAppIcon } from './shared/icons'

export function WhatsAppFloat() {
  const [visible, setVisible] = useState(false)
  const [bubbleOpen, setBubbleOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {visible && bubbleOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-2xl p-4 max-w-[260px] relative border border-slate-100"
          >
            <button
              onClick={() => setBubbleOpen(false)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"
              aria-label="Cerrar mensaje"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <p className="text-sm text-slate-700 font-medium leading-snug">
              ¿Buscas un repuesto? 💬
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-snug">
              Escríbenos y te asesoramos al instante.
            </p>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-center bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold py-2 rounded-lg transition-colors"
            >
              Abrir chat
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => (window.location.href = whatsappUrl())}
            className="relative w-14 h-14 rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.5)] flex items-center justify-center group"
            aria-label={`Escríbenos por WhatsApp al ${siteConfig.telefonoDisplay}`}
            onMouseEnter={() => setBubbleOpen(true)}
          >
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />
            <WhatsAppIcon className="w-7 h-7 text-white relative z-10" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
