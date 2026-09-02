import { notFound } from 'next/navigation'
import { getSessionFast } from '@/lib/session'
import { getVentaDetalle } from '../actions'
import { VentaDetalle } from './components/VentaDetalle'

type Props = {
  params: Promise<{ id: string }>
}

export default async function VentaDetallePage({ params }: Props) {
  const { id } = await params
  const [{ data: venta }, { perfil }] = await Promise.all([getVentaDetalle(id), getSessionFast()])

  if (!venta) notFound()

  return (
    <div className="h-full">
      <VentaDetalle
        venta={venta}
        puedeEnviarSunat={perfil?.rol === 'administrador' || perfil?.rol === 'superadmin'}
        puedeSolicitarDevolucion={perfil?.rol === 'vendedor'}
      />
    </div>
  )
}
