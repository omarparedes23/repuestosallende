import type { ReporteFiltros } from '../actions'

const PAGE_SIZE = 100

export function PaginacionReporte({ ruta, filtros, totalFilas }: { ruta: string; filtros: ReporteFiltros; totalFilas: number }) {
  const pagina = Math.max(1, filtros.pagina ?? 1)
  const paginas = Math.max(1, Math.ceil(totalFilas / PAGE_SIZE))
  if (totalFilas === 0) return null
  const href = (destino: number) => {
    const [base, queryInicial = ''] = ruta.split('?')
    const params = new URLSearchParams(queryInicial)
    for (const [clave, valor] of Object.entries(filtros)) if (valor && clave !== 'pagina') params.set(clave, String(valor))
    if (destino > 1) params.set('pagina', String(destino))
    return `${base}?${params.toString()}`
  }
  return <div className="flex items-center justify-between text-sm" style={{ color: '#6B7280' }}>
    <span>{totalFilas} registros · página {pagina} de {paginas}</span>
    <div className="flex gap-2"><a aria-disabled={pagina === 1} href={pagina === 1 ? undefined : href(pagina - 1)} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-50" style={{ borderColor: '#D1D5DB', pointerEvents: pagina === 1 ? 'none' : 'auto', opacity: pagina === 1 ? 0.45 : 1 }}>Anterior</a><a aria-disabled={pagina === paginas} href={pagina === paginas ? undefined : href(pagina + 1)} className="rounded-lg border px-3 py-1.5 font-semibold" style={{ borderColor: '#D1D5DB', pointerEvents: pagina === paginas ? 'none' : 'auto', opacity: pagina === paginas ? 0.45 : 1 }}>Siguiente</a></div>
  </div>
}
