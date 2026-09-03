import type { RaMoneda } from '@/lib/types/database'

const TIPO_DOC_SUNAT: Record<string, string> = {
  DNI: '1',
  RUC: '6',
  CE: '4',
  PASAPORTE: '7',
}

export type OseItem = {
  descripcion: string
  cantidad: number
  valorUnitario: number  // precio sin IGV
  subtotalBase: number   // valorUnitario * cantidad - descuento (sin IGV)
}

export type OseComprobanteInput = {
  tipo: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'
  serie: string
  correlativo: number
  rucEmisor: string
  razonSocial: string
  fechaEmision: string  // YYYY-MM-DD
  cliente: {
    nombre: string
    tipoDocumento: string | null
    nroDocumento: string | null
  }
  items: OseItem[]
  subtotal: number  // total base sin IGV
  igv: number
  total: number
  moneda: RaMoneda      // default 'PEN'
  tipoCambio?: number   // solo se envía si moneda !== 'PEN'
  notaCredito?: {
    comprobanteReferenciadoId: string
    tipoDocReferenciado: '01' | '03'
    motivoCodigo: '06' | '07'
    motivoDescripcion: string
  }
}

export type OseComprobanteResult = {
  kind: 'accepted' | 'submitted' | 'uncertain' | 'temporary_error' | 'rejected'
  exito: boolean
  sunat_aceptada?: boolean
  id_externo?: string
  pdf_url?: string
  xml_url?: string
  hash?: string
  error?: string
  error_code?: string
  http_status?: number
  response_payload?: Record<string, unknown>
}

function detalleErrorOse(json: Record<string, unknown>, fallback: string) {
  const base = typeof json.errorMensaje === 'string'
    ? json.errorMensaje
    : typeof json.detail === 'string'
      ? json.detail
      : typeof json.title === 'string'
        ? json.title
        : fallback
  const errors = json.errors
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return base
  const detalles = Object.entries(errors as Record<string, unknown>)
    .map(([field, value]) => `${field}: ${String(value)}`)
    .join('; ')
  return detalles ? `${base} — ${detalles}` : base
}

export async function emitirComprobante(
  input: OseComprobanteInput,
  idempotencyKey?: string
): Promise<OseComprobanteResult> {
  const url = process.env.OSE_SUNAT_URL
  const apiKey = process.env.OSE_SUNAT_API_KEY

  if (!url || !apiKey) {
    return { kind: 'temporary_error', exito: false, error: 'OSE_SUNAT no configurado' }
  }

  const sinCliente = !input.cliente.nroDocumento
  const tipoDocCodigo = TIPO_DOC_SUNAT[input.cliente.tipoDocumento ?? ''] ?? '1'
  const igvRate = input.subtotal > 0 ? input.igv / input.subtotal : 0.18
  const moneda: RaMoneda = input.moneda || 'PEN'

  const payload = {
    tipo: input.tipo,
    serie: input.serie,
    correlativo: input.correlativo,
    rucEmisor: input.rucEmisor,
    razonSocialEmisor: input.razonSocial,
    fechaEmision: input.fechaEmision,
    moneda,
    ...(moneda !== 'PEN' ? { tipoCambio: input.tipoCambio } : {}),
    cliente: {
      nombre: sinCliente ? 'Consumidor Final' : input.cliente.nombre,
      tipoDocCodigo: sinCliente ? '1' : tipoDocCodigo,
      numDoc: sinCliente ? '00000000' : input.cliente.nroDocumento,
    },
    items: input.items.map((item) => {
      const igvItem = +(item.subtotalBase * igvRate).toFixed(2)
      const totalItem = +(item.subtotalBase + igvItem).toFixed(2)
      const precioConIgv = item.cantidad > 0
        ? +(totalItem / item.cantidad).toFixed(6)
        : item.valorUnitario
      return {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        valorUnitario: item.valorUnitario,
        precioUnitario: precioConIgv,
        subtotal: item.subtotalBase,
        igv: igvItem,
        total: totalItem,
        afectoIgv: true,
      }
    }),
    totales: {
      gravada: input.subtotal,
      descuento: 0,
      igv: input.igv,
      totalPagar: input.total,
    },
    ...(input.tipo === 'NOTA_CREDITO' && input.notaCredito ? { notaCredito: input.notaCredito } : {}),
  }

  try {
    const res = await fetch(`${url}/api/v1/comprobantes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json().catch(() => ({})) as Record<string, unknown>
    const estado = typeof json.estado === 'string' ? json.estado : ''
    const common = {
      id_externo: typeof json.id === 'string' ? json.id : undefined,
      pdf_url: typeof json.pdfUrl === 'string' ? json.pdfUrl : undefined,
      xml_url: typeof json.xmlUrl === 'string' ? json.xmlUrl : undefined,
      hash: typeof json.sunatHash === 'string' ? json.sunatHash : undefined,
      http_status: res.status,
      response_payload: json,
    }
    if (estado === 'EMITIDA') return { kind: 'accepted', exito: true, sunat_aceptada: true, ...common }
    if (estado === 'RESERVADO' || estado === 'ENVIANDO' || res.status === 202)
      return { kind: 'submitted', exito: true, sunat_aceptada: false, ...common }
    if (estado === 'RESULTADO_INCIERTO')
      return { kind: 'uncertain', exito: false, error: detalleErrorOse(json, 'Resultado incierto; requiere reconciliación'), ...common }
    const errorCode = typeof json.errorCodigo === 'string'
      ? json.errorCodigo
      : typeof json.code === 'string'
        ? json.code
        : undefined
    const message = detalleErrorOse(json, errorCode ?? `HTTP ${res.status}`)
    if (estado === 'ERROR_REINTENTABLE' || res.status === 503)
      return { kind: 'temporary_error', exito: false, error: message, error_code: errorCode, ...common }
    if (estado === 'RECHAZADA' || res.status === 409 || res.status === 422 || (res.status >= 400 && res.status < 500))
      return { kind: 'rejected', exito: false, error: message, error_code: errorCode, ...common }
    if (!res.ok) return { kind: 'temporary_error', exito: false, error: message, error_code: errorCode, ...common }

    return {
      kind: 'uncertain', exito: false, error: `Estado OSE no reconocido: ${estado || 'vacío'}`, ...common,
    }
  } catch (err) {
    console.error('[OSE-SUNAT] Error de red:', err)
    return { kind: 'uncertain', exito: false, error: 'Error de red al conectar con OSE-SUNAT' }
  }
}

export async function consultarComprobantePorNumero(tipo: 'BOLETA' | 'FACTURA', serie: string, correlativo: number) {
  const url = process.env.OSE_SUNAT_URL
  const apiKey = process.env.OSE_SUNAT_API_KEY
  if (!url || !apiKey) return null
  const query = new URLSearchParams({ tipo, serie, correlativo: String(correlativo) })
  const response = await fetch(`${url}/api/v1/comprobantes/por-numero?${query}`, {
    headers: { 'X-Api-Key': apiKey }, cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`OSE lookup HTTP ${response.status}`)
  return response.json()
}
