import { buscarClientes } from './actions'
import { ClientesView } from './components/ClientesView'

export default async function ClientesPage() {
  const { data: initialClientes } = await buscarClientes('')

  return (
    <div className="h-full">
      <ClientesView initialClientes={initialClientes ?? []} />
    </div>
  )
}
