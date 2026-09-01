export type DocumentoKardex = {
  etiqueta: string
  href: string | null
}

function formatoGuia(serie: string | null, correlativo: number | null): string | null {
  if (!serie || correlativo === null) return null
  return `${serie}-${String(correlativo).padStart(8, '0')}`
}

export function resolverDocumentoKardex(
  motivo: string,
  referenciaId: string | null,
  compras: Map<string, { nro_documento: string | null; tipo_documento: string }>,
  ventas: Map<string, { numero_completo: string | null }>,
  guias: Map<string, { serie: string | null; correlativo: number | null }>
): { documento: DocumentoKardex | null; documentoNoDisponible: boolean } {
  if (!referenciaId) return { documento: null, documentoNoDisponible: false }

  if (motivo === 'compra') {
    const compra = compras.get(referenciaId)
    return compra
      ? {
          documento: {
            etiqueta: `Compra · ${compra.nro_documento ?? 'Sin documento'}`,
            href: `/panel/compras/${referenciaId}`,
          },
          documentoNoDisponible: false,
        }
      : { documento: null, documentoNoDisponible: true }
  }

  if (motivo === 'venta') {
    const venta = ventas.get(referenciaId)
    return venta
      ? {
          documento: { etiqueta: `Venta · ${venta.numero_completo ?? referenciaId.slice(0, 8).toUpperCase()}`, href: null },
          documentoNoDisponible: false,
        }
      : { documento: null, documentoNoDisponible: true }
  }

  if (motivo === 'traslado') {
    const guia = guias.get(referenciaId)
    return guia
      ? {
          documento: { etiqueta: `Guía · ${formatoGuia(guia.serie, guia.correlativo) ?? 'Sin numerar'}`, href: `/panel/guias/${referenciaId}` },
          documentoNoDisponible: false,
        }
      : { documento: null, documentoNoDisponible: true }
  }

  return { documento: null, documentoNoDisponible: false }
}
