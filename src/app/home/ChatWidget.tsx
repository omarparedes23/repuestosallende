'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Wrench } from 'lucide-react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const URL_REGEX = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+)/g
const BOLD_REGEX = /\*\*(.+?)\*\*/g

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX)
  return parts.flatMap((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0
      const trailingMatch = part.match(/([.,!?)]+)$/)
      const trailing = trailingMatch ? trailingMatch[1] : ''
      const cleanUrl = trailing ? part.slice(0, -trailing.length) : part
      const href = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`
      return [
        <a
          key={`url-${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#FFD700', textDecoration: 'underline' }}
          className="hover:opacity-80 transition-opacity"
        >
          {cleanUrl}
        </a>,
        trailing,
      ]
    }
    // Parsear **bold** dentro del texto plano
    const boldParts = part.split(BOLD_REGEX)
    return boldParts.map((bp, j) =>
      j % 2 === 1 ? <strong key={`b-${i}-${j}`}>{bp}</strong> : bp
    )
  })
}

function renderWithLinks(text: string) {
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>
      {renderInline(line)}
      {i < arr.length - 1 && <br />}
    </span>
  ))
}

const STORAGE_KEY = 'ra_chat_history'
const MAX_MESSAGES = 50

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de Repuestos Allende. ¿Qué repuesto necesitas?',
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cargar historial de la sesión al montar
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Message[]
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed)
      }
    } catch {}
  }, [])

  // Persistir historial en sessionStorage (máx 50 mensajes)
  useEffect(() => {
    if (messages.length <= 1) return
    try {
      const capped = messages.length > MAX_MESSAGES
        ? [INITIAL_MESSAGE, ...messages.slice(-(MAX_MESSAGES - 1))]
        : messages
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(capped))
    } catch {}
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMessage: Message = { role: 'user', content: text }
    const history = [...messages, userMessage]

    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setIsStreaming(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-MAX_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.body) throw new Error('No stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: accumulated }
          return updated
        })
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content:
            'Hubo un problema al procesar tu mensaje. Por favor intenta nuevamente o escríbenos al WhatsApp wa.me/51935034586.',
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Ventana de chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-40 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[370px] flex flex-col overflow-hidden rounded-2xl"
            style={{
              height: '500px',
              boxShadow: '0 8px 40px -8px rgba(0,45,98,0.35), 0 20px 40px -15px rgba(0,0,0,0.2)',
              border: '1px solid #E5E7EB',
              background: '#FFFFFF',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ backgroundColor: '#002D62' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#FFD700' }}
                >
                  <Wrench size={15} style={{ color: '#002D62' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: '#FFFFFF' }}>
                    Repuestos Allende
                  </p>
                  <p className="text-xs leading-tight" style={{ color: '#FFD700' }}>
                    Asistente virtual
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="transition-opacity hover:opacity-70"
                style={{ color: '#FFFFFF' }}
                aria-label="Cerrar chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mensajes */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
              style={{ backgroundColor: '#F9FAFB' }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl"
                    style={
                      msg.role === 'user'
                        ? {
                            backgroundColor: '#002D62',
                            color: '#FFFFFF',
                            borderBottomRightRadius: '4px',
                          }
                        : {
                            backgroundColor: '#FFFFFF',
                            color: '#374151',
                            border: '1px solid #E5E7EB',
                            borderBottomLeftRadius: '4px',
                          }
                    }
                  >
                    {msg.role === 'assistant' ? renderWithLinks(msg.content) : msg.content}
                    {msg.role === 'assistant' &&
                      isStreaming &&
                      i === messages.length - 1 &&
                      !msg.content && (
                        <span className="inline-flex gap-1 py-0.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]"
                            style={{ backgroundColor: '#002D62', opacity: 0.5 }}
                          />
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]"
                            style={{ backgroundColor: '#002D62', opacity: 0.5 }}
                          />
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]"
                            style={{ backgroundColor: '#002D62', opacity: 0.5 }}
                          />
                        </span>
                      )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              className="px-4 py-3 flex gap-2"
              style={{ borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="¿Qué repuesto necesitas?"
                disabled={isStreaming}
                className="flex-1 rounded-full px-4 py-2 text-sm outline-none transition-colors disabled:opacity-50"
                style={{
                  border: '2px solid #E5E7EB',
                  color: '#111827',
                  backgroundColor: '#F9FAFB',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#002D62')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="flex items-center justify-center w-9 h-9 rounded-full transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
                style={{ backgroundColor: '#002D62' }}
                aria-label="Enviar mensaje"
              >
                <Send size={15} style={{ color: '#FFD700' }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setIsOpen((prev) => !prev)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-24 right-4 sm:right-6 z-50 w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: '#002D62',
          boxShadow: '0 0 24px -5px rgba(0,45,98,0.5), 0 4px 20px rgba(0,0,0,0.3)',
        }}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
            >
              <X size={26} style={{ color: '#FFD700' }} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle size={26} style={{ color: '#FFD700' }} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  )
}
