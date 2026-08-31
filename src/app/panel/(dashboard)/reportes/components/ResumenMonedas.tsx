export function ResumenMonedas({ titulo, totales }: { titulo: string; totales: Record<string, number> }) {
  const entries = Object.entries(totales)
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>{titulo}</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {entries.length === 0 ? <span className="text-sm" style={{ color: '#9CA3AF' }}>Sin movimientos en el rango</span> : entries.map(([moneda, monto]) => (
          <span key={moneda} className="text-lg font-bold" style={{ color: '#111827' }}>{moneda === 'USD' ? '$' : 'S/'} {monto.toFixed(2)} <small className="text-xs" style={{ color: '#6B7280' }}>{moneda}</small></span>
        ))}
      </div>
    </div>
  )
}
