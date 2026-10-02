import { getVentasDelDia } from './actions'
import { VentasList } from './components/VentasList'

export default async function VentasPage() {
  const { data: ventas, error } = await getVentasDelDia()
  if (error) throw new Error(error)

  return (
    <div className="h-full">
      <VentasList ventas={ventas ?? []} />
    </div>
  )
}
