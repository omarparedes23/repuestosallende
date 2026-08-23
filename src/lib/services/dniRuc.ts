type RucApiResponse = {
  ruc: string
  razonSocial: string
  direccion: string | null
  estado: string | null
  condicion: string | null
}

type DniApiResponse = {
  dni: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
}

type ConsultaResult<T> = { exito: true; data: T } | { exito: false; error: string }

async function consultarApisPeru<T>(path: string): Promise<ConsultaResult<T>> {
  const token = process.env.APISPERU_TOKEN

  if (!token) {
    return { exito: false, error: 'APISPERU_TOKEN no configurado' }
  }

  try {
    const res = await fetch(`https://dniruc.apisperu.com/api/v1/${path}?token=${token}`)
    const json = await res.json()

    if (json.success === false) {
      return { exito: false, error: json.message ?? 'No se encontraron resultados.' }
    }

    if (!res.ok) {
      return { exito: false, error: `HTTP ${res.status}` }
    }

    return { exito: true, data: json as T }
  } catch {
    // No registrar el error original: fetch puede incluir en su causa la URL
    // completa, cuyo query param contiene APISPERU_TOKEN.
    console.error('[APIsPeru] Error de red en la consulta')
    return { exito: false, error: 'Error de red al consultar el documento' }
  }
}

export async function consultarRuc(ruc: string): Promise<ConsultaResult<RucApiResponse>> {
  if (!/^\d{11}$/.test(ruc)) {
    return { exito: false, error: 'El RUC debe tener 11 dígitos' }
  }
  return consultarApisPeru<RucApiResponse>(`ruc/${ruc}`)
}

export async function consultarDni(dni: string): Promise<ConsultaResult<DniApiResponse>> {
  if (!/^\d{8}$/.test(dni)) {
    return { exito: false, error: 'El DNI debe tener 8 dígitos' }
  }
  return consultarApisPeru<DniApiResponse>(`dni/${dni}`)
}
