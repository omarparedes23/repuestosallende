import { createClient } from '@/lib/supabase/server'
import { KioskPosClient } from './components/KioskPosClient'

// Top 9 marcas por unidades vendidas (ultimos 12 meses, dbo.VentaDet/Venta en el
// ERP FastERP, ver mem topic architecture/pos-filtro-marcas) - orden fijo de mas a
// menos vendida, no viene de una columna "orden" en ra_marcas_repuesto.
const MARCAS_DESTACADAS = ['FREY', 'MEYLE', 'HENGST', 'INA', 'FEBI', 'MANN', 'MAHLE', 'TRW', 'KS']

export default async function PosPage() {
  const supabase = (await createClient()) as any

  const { data: marcasData } = await supabase
    .from('ra_marcas_repuesto')
    .select('id, nombre')
    .eq('activo', true)
    .in('nombre', MARCAS_DESTACADAS)

  const marcas = MARCAS_DESTACADAS
    .map((nombre) => marcasData?.find((m: { id: string; nombre: string }) => m.nombre === nombre))
    .filter((m: unknown): m is { id: string; nombre: string } => !!m)

  return (
    <div className="h-full">
      <KioskPosClient marcas={marcas} />
    </div>
  )
}
