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
  tipo: 'BOLETA' | 'FACTURA'
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
}

export type OseComprobanteResult = {
  exito: boolean
  sunat_aceptada?: boolean
  id_externo?: string
  pdf_url?: string
  xml_url?: string
  hash?: string
  error?: string
}

export async function emitirComprobante(
  input: OseComprobanteInput
): Promise<OseComprobanteResult> {
  const url = process.env.OSE_SUNAT_URL
  const apiKey = process.env.OSE_SUNAT_API_KEY

  if (!url || !apiKey) {
    return { exito: false, error: 'OSE_SUNAT no configurado' }
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
  }

  try {
    const res = await fetch(`${url}/api/v1/comprobantes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[OSE-SUNAT] HTTP error:', res.status, text)
      return { exito: false, error: `HTTP ${res.status}` }
    }

    const json = await res.json()
    const estado: string = json.estado ?? ''
    const exito = estado === 'EMITIDA' || estado === 'PENDIENTE'

    if (!exito) {
      const msg = json.errorMensaje ?? json.detail ?? estado ?? 'Error desconocido'
      console.error('[OSE-SUNAT] Rechazado:', msg)
      return { exito: false, error: msg }
    }

    return {
      exito: true,
      sunat_aceptada: estado === 'EMITIDA',
      id_externo: json.id,
      pdf_url: json.pdfUrl,
      xml_url: json.xmlUrl,
      hash: json.sunatHash,
    }
  } catch (err) {
    console.error('[OSE-SUNAT] Error de red:', err)
    return { exito: false, error: 'Error de red al conectar con OSE-SUNAT' }
  }
}
