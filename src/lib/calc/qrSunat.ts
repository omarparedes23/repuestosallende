import type { RaTipoComprobante } from '@/lib/types/database'

const TIPO_DOC_SUNAT: Record<string, string> = {
  DNI: '1',
  RUC: '6',
  CE: '4',
  PASAPORTE: '7',
}

const TIPO_COMPROBANTE_SUNAT: Record<string, string> = {
  boleta: '03',
  factura: '01',
}

export function armarQrSunat(input: {
  rucEmisor: string
  tipoComprobante: RaTipoComprobante
  serie: string
  correlativo: number
  igv: number
  monto: number
  fecha: string
  tipoDocumento: string | null
  nroDocumento: string | null
  hash: string
}): string {
  const tipo = TIPO_COMPROBANTE_SUNAT[input.tipoComprobante] ?? '03'
  const tipoDoc = TIPO_DOC_SUNAT[input.tipoDocumento ?? ''] ?? '1'
  const numDoc = input.nroDocumento ?? ''
  return [
    input.rucEmisor,
    tipo,
    input.serie,
    input.correlativo,
    input.igv.toFixed(2),
    input.monto.toFixed(2),
    input.fecha,
    tipoDoc,
    numDoc,
    input.hash,
  ].join('|')
}
