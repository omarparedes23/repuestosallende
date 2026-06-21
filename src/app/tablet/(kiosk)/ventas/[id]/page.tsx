import { notFound } from 'next/navigation'
import { getVentaDetalle } from '../actions'
import { VentaDetalle } from './components/VentaDetalle'

type Props = {
  params: Promise<{ id: string }>
}

export default async function VentaDetallePage({ params }: Props) {
  const { id } = await params
  const { data: venta } = await getVentaDetalle(id)

  if (!venta) notFound()

  return (
    <div className="h-full">
      <VentaDetalle venta={venta} />
    </div>
  )
}
