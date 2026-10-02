import { buscarClientes } from './actions'
import { ClientesView } from './components/ClientesView'

export default async function ClientesPage() {
  const { data: initialClientes, error } = await buscarClientes('')
  if (error) throw new Error(error)

  return (
    <div className="h-full">
      <ClientesView initialClientes={initialClientes ?? []} />
    </div>
  )
}
