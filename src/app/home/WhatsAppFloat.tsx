'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { siteConfig, whatsappUrl } from '@/lib/site.config'
import { WhatsAppIcon } from './shared/icons'

export function WhatsAppFloat() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed bottom-20 left-6 z-50">
      <AnimatePresence>
        {visible && (
          <motion.a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-14 h-14 rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.5)] flex items-center justify-center"
            aria-label={`Escríbenos por WhatsApp al ${siteConfig.telefonoDisplay}`}
          >
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />
            <WhatsAppIcon className="w-7 h-7 text-white relative z-10" />
          </motion.a>
        )}
      </AnimatePresence>
    </div>
  )
}
