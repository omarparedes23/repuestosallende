import { getVentasDelDia } from './actions'
import { VentasList } from './components/VentasList'

export default async function VentasPage() {
  const { data: ventas } = await getVentasDelDia()

  return (
    <div className="h-full">
      <VentasList ventas={ventas ?? []} />
    </div>
  )
}
