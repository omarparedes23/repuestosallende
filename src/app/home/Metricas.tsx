'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { metricas } from '@/lib/home/content'

/**
 * Contador que anima de 0 al valor numérico cuando entra en viewport.
 * Respeta prefers-reduced-motion (gracias a MotionConfig reducedMotion="user").
 */
function Contador({ valor, sufijo }: { valor: string; sufijo?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (!inView) return
    const objetivo = parseInt(valor, 10)
    if (Number.isNaN(objetivo)) {
      // Si el valor no es numérico (p.ej. "100%"), lo mostramos directo.
      setDisplay(valor)
      return
    }
    const duracion = 1500
    const inicio = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min((t - inicio) / duracion, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      const actual = Math.round(eased * objetivo)
      setDisplay(actual.toLocaleString('es-PE'))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, valor])

  return (
    <span ref={ref} className="tabular-nums">
      {display}
      {sufijo}
    </span>
  )
}

export function Metricas() {
  return (
    <section className="py-20 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
          {metricas.map((m) => (
            <div key={m.etiqueta} className="text-center">
              <div className="text-4xl sm:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-navy to-blue-700 mb-2">
                <Contador valor={m.valor} sufijo={m.sufijo} />
              </div>
              <p className="text-gray-tech text-sm sm:text-base font-medium uppercase tracking-wider">
                {m.etiqueta}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
