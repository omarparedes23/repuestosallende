import { useEffect, useState } from 'react'
import { buscarClientes, type ClienteResumen } from '../../../clientes/actions'

const DEBOUNCE_MS = 300

/**
 * Estado y búsqueda (con debounce) del selector de cliente.
 * `onError` recibe el mensaje si la búsqueda falla.
 */
export function useClienteSelector(onError: (message: string) => void) {
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<ClienteResumen[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Vaciar el texto limpia los resultados en el mismo evento (no en un efecto).
  const setQuery = (value: string) => {
    setQueryState(value)
    if (!value.trim()) setResults([])
  }

  const abrir = () => setShowSearch(true)

  const cerrar = () => {
    setShowSearch(false)
    setQueryState('')
    setResults([])
  }

  useEffect(() => {
    if (!query.trim()) return
    const timer = setTimeout(async () => {
      setIsSearching(true)
      const { data, error } = await buscarClientes(query)
      if (error) onError(error)
      setResults(data ?? [])
      setIsSearching(false)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, onError])

  return { query, setQuery, results, isSearching, showSearch, abrir, cerrar }
}

export type ClienteSelector = ReturnType<typeof useClienteSelector>
