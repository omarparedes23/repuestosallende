import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getCuentasPorCobrarGlobal, getSucursalesParaCobro } from './actions'
import { TesoreriaView } from './components/TesoreriaView'

export default async function TesoreriaPage() {
  const { perfil, sucursalId } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const [{ data: movimientos }, sucursales] = await Promise.all([
    getCuentasPorCobrarGlobal(),
    getSucursalesParaCobro(),
  ])

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Tesorería</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
          Cuentas por cobrar de todos los clientes — cobrá directamente desde acá, sin buscar cliente por cliente.
        </p>
      </div>

      <TesoreriaView
        movimientos={movimientos ?? []}
        sucursales={sucursales}
        sucursalInicialId={sucursalId}
      />
    </div>
  )
}
